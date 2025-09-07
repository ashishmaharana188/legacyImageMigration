import React, { useState, useCallback, useEffect, useMemo } from "react";
import axios, { AxiosError } from "axios";
import S3BrowserUI from "../ui/S3BrowserUI";

interface S3File {
  key: string;
  lastModified?: string;
}

interface S3BrowserTaskProps {
  setLogs: React.Dispatch<
    React.SetStateAction<{ status: string; errors: string[] }>
  >;
}

const S3BrowserTask: React.FC<S3BrowserTaskProps> = ({ setLogs }) => {
  const [s3Files, setS3Files] = useState<S3File[]>([]);
  const [s3Directories, setS3Directories] = useState<string[]>([]);
  const [currentPrefix, setCurrentPrefix] = useState<string>("");
  const [nextContinuationToken, setNextContinuationToken] = useState<
    string | undefined
  >(undefined);
  const [isFilterMode, setIsFilterMode] = useState<boolean>(false);
  const [transactionNumberPattern, setTransactionNumberPattern] =
    useState<string>("");
  const [filenamePattern, setFilenamePattern] = useState<string>("");
  const [searchResults, setSearchResults] = useState<S3File[]>([]);
  const [clientPage, setClientPage] = useState<number>(1);
  const [searchPage, setSearchPage] = useState<number>(1);
  const itemsPerPage = 10;

  const totalPages = Math.ceil(
    (s3Files.length + s3Directories.length) / itemsPerPage
  );
  const totalSearchPages = Math.ceil(searchResults.length / itemsPerPage);

  const paginatedItems = useMemo(() => {
    const allItems = [
      ...s3Directories.map((dir) => ({ key: dir, type: "dir" })),
      ...s3Files.map((file) => ({ ...file, type: "file" })),
    ];
    const startIndex = (clientPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return allItems.slice(startIndex, endIndex);
  }, [s3Files, s3Directories, clientPage, itemsPerPage]);

  const paginatedSearchResults = useMemo(() => {
    const startIndex = (searchPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return searchResults.slice(startIndex, endIndex);
  }, [searchResults, searchPage, itemsPerPage]);

  const fetchS3Objects = useCallback(
    async (prefix: string = "Data/", continuationToken?: string) => {
      setLogs((prev) => ({
        ...prev,
        status: "Fetching S3 objects...",
        errors: [],
      }));
      try {
        const res = await axios.get("http://localhost:3000/s3-list-objects", {
          params: { prefix, continuationToken },
        });
        const {
          files,
          directories,
          nextContinuationToken: newContinuationToken,
        } = res.data;

        setS3Files((prev) => (continuationToken ? [...prev, ...files] : files));
        setS3Directories((prev) =>
          continuationToken ? [...prev, ...directories] : directories
        );
        setCurrentPrefix(prefix);
        setNextContinuationToken(newContinuationToken);
        setLogs((prev) => ({
          ...prev,
          status: "S3 objects fetched successfully.",
        }));
      } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
          setLogs((prev) => ({
            ...prev,
            status: "Failed to fetch S3 objects.",
            errors: [
              ...prev.errors,
              error.response?.data?.error || "An unknown error occurred.",
            ],
          }));
        } else {
          setLogs((prev) => ({
            ...prev,
            status: "Failed to fetch S3 objects.",
            errors: [...prev.errors, "An unknown error occurred."],
          }));
        }
      }
    },
    [setLogs]
  );

  useEffect(() => {
    fetchS3Objects();
  }, [fetchS3Objects]);

  const handleLoadMore = useCallback(() => {
    if (nextContinuationToken) {
      fetchS3Objects(currentPrefix, nextContinuationToken);
    }
  }, [nextContinuationToken, fetchS3Objects, currentPrefix]);

  const handleDeleteS3File = useCallback(
    async (key: string) => {
      // Add confirmation dialog
      if (!window.confirm(`Are you sure you want to delete "${key}"?`)) {
        return; // User cancelled the deletion
      }
      setLogs((prev) => ({
        ...prev,
        status: `Deleting ${key}...`,
        errors: [],
      }));
      try {
        await axios.post("http://localhost:3000/s3-delete-object", {
          keys: [key],
        });
        setLogs((prev) => ({
          ...prev,
          status: `${key} deleted successfully.`,
        }));
        fetchS3Objects(currentPrefix); // Refresh the list
      } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
          setLogs((prev) => ({
            ...prev,
            status: `Failed to delete ${key}.`,
            errors: [
              ...prev.errors,
              error.response?.data?.error || "An unknown error occurred.",
            ],
          }));
        } else {
          setLogs((prev) => ({
            ...prev,
            status: `Failed to delete ${key}.`,
            errors: [...prev.errors, "An unknown error occurred."],
          }));
        }
      }
    },
    [setLogs, fetchS3Objects, currentPrefix]
  );

  const handleDirectoryClick = useCallback(
    (directoryKey: string) => {
      setS3Files([]); // Clear current files
      setS3Directories([]); // Clear current directories
      setClientPage(1); // Reset pagination
      fetchS3Objects(directoryKey);
    },
    [fetchS3Objects]
  );

  const handleBreadcrumbClick = useCallback(
    (index: number) => {
      const pathParts = currentPrefix.split("/").filter(Boolean);
      const newPrefix = pathParts.slice(0, index + 1).join("/") + "/";
      setS3Files([]);
      setS3Directories([]);
      setClientPage(1);
      fetchS3Objects(newPrefix);
    },
    [currentPrefix, fetchS3Objects]
  );

  const handleSearch = useCallback(async () => {
    setLogs((prev) => ({ ...prev, status: "Searching S3...", errors: [] }));
    try {
      const res = await axios.get("http://localhost:3000/s3-search", {
        params: {
          transactionNumberPattern,
          filenamePattern,
        },
      });
      setSearchResults(res.data.files);
      setSearchPage(1); // Reset search pagination
      setLogs((prev) => ({ ...prev, status: "S3 search complete." }));
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        setLogs((prev) => ({
          ...prev,
          status: "S3 search failed.",
          errors: [
            ...prev.errors,
            error.response?.data?.error || "An unknown error occurred.",
          ],
        }));
      } else {
        setLogs((prev) => ({
          ...prev,
          status: "S3 search failed.",
          errors: [...prev.errors, "An unknown error occurred."],
        }));
      }
    }
  }, [setLogs, transactionNumberPattern, filenamePattern]);

  return (
    <S3BrowserUI
      s3Files={s3Files}
      s3Directories={s3Directories}
      currentPrefix={currentPrefix}
      nextContinuationToken={nextContinuationToken}
      isFilterMode={isFilterMode}
      transactionNumberPattern={transactionNumberPattern}
      filenamePattern={filenamePattern}
      searchResults={searchResults}
      clientPage={clientPage}
      searchPage={searchPage}
      itemsPerPage={itemsPerPage}
      totalPages={totalPages}
      totalSearchPages={totalSearchPages}
      paginatedItems={paginatedItems}
      paginatedSearchResults={paginatedSearchResults}
      setIsFilterMode={setIsFilterMode}
      setTransactionNumberPattern={setTransactionNumberPattern}
      setFilenamePattern={setFilenamePattern}
      setClientPage={setClientPage}
      setSearchPage={setSearchPage}
      handleLoadMore={handleLoadMore}
      handleDeleteS3File={handleDeleteS3File}
      handleDirectoryClick={handleDirectoryClick}
      handleBreadcrumbClick={handleBreadcrumbClick}
      handleSearch={handleSearch}
      fetchS3Objects={fetchS3Objects} // Pass fetchS3Objects to UI component
    />
  );
};

export default S3BrowserTask;
