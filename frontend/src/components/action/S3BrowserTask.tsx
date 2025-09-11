import React, { useState, useCallback, useEffect, useMemo } from "react";
import axios from "axios";
import S3BrowserUI from "../ui/S3BrowserUI";

interface S3File {
  key: string;
  lastModified?: string;
}

interface S3Item extends S3File {
  type: "file" | "dir";
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
  const [searchResults, setSearchResults] = useState<S3Item[]>([]);
  const [clientPage, setClientPage] = useState<number>(1);
  const [searchContinuationToken, setSearchContinuationToken] = useState<
    string | undefined
  >(undefined);
  const [searchPage, setSearchPage] = useState<number>(1);
  const DISPLAY_ITEMS_PER_PAGE = 10;
  const FETCH_LIMIT = 100; // Number of items to fetch from backend at once
  

  const totalPages = Math.ceil(
    (s3Files.length + s3Directories.length) / DISPLAY_ITEMS_PER_PAGE
  );
  const totalSearchPages = Math.ceil(searchResults.length / DISPLAY_ITEMS_PER_PAGE);

  const paginatedItems = useMemo(() => {
    const allItems = [
      ...s3Directories.map((dir) => ({ key: dir, type: "dir" as const })),
      ...s3Files.map((file) => ({ ...file, type: "file" as const })),
    ];
    const startIndex = (clientPage - 1) * DISPLAY_ITEMS_PER_PAGE;
    const endIndex = startIndex + DISPLAY_ITEMS_PER_PAGE;
    return allItems.slice(startIndex, endIndex);
  }, [s3Files, s3Directories, clientPage, DISPLAY_ITEMS_PER_PAGE]);

  const paginatedSearchResults = useMemo(() => {
    const startIndex = (searchPage - 1) * DISPLAY_ITEMS_PER_PAGE;
    const endIndex = startIndex + DISPLAY_ITEMS_PER_PAGE;
    return searchResults.slice(startIndex, endIndex);
  }, [searchResults, searchPage, DISPLAY_ITEMS_PER_PAGE]);

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

        // Sort files by lastModified in descending order
        const sortedFiles = files.sort((a: S3File, b: S3File) => {
          const dateA = a.lastModified ? new Date(a.lastModified).getTime() : 0;
          const dateB = b.lastModified ? new Date(b.lastModified).getTime() : 0;
          return dateB - dateA;
        });

        // Sort directories alphabetically
        const sortedDirectories = directories.sort((a: string, b: string) =>
          a.localeCompare(b)
        );

        setS3Files((prev) =>
          continuationToken ? [...prev, ...sortedFiles] : sortedFiles
        );
        setS3Directories((prev) =>
          continuationToken ? [...prev, ...sortedDirectories] : sortedDirectories
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
      if (!window.confirm(`Are you sure you want to delete "${key}"?`)) {
        return;
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
        fetchS3Objects(currentPrefix);
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
      setS3Files([]);
      setS3Directories([]);
      setClientPage(1);
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

  const handleSearch = useCallback(
    async (continuationToken?: string) => {
      setLogs((prev) => ({ ...prev, status: "Searching S3...", errors: [] }));
      try {
        const res = await axios.get("http://localhost:3000/s3-search", {
          params: {
            prefix: currentPrefix,
            transactionNumberPattern,
            filenamePattern,
            continuationToken,
          },
        });

        const results: S3Item[] = res.data.files.map((item: S3File) => ({
          ...item,
          type: item.key.endsWith("/") ? ("dir" as const) : ("file" as const),
        }));

        let processedResults: S3Item[] = [];

        if (!transactionNumberPattern && filenamePattern) {
          // Scenario: filenamePattern is present, but transactionNumberPattern is not.
          // Extract unique transaction folders from the search results.
          const transactionFolders = new Set<string>();
          results.forEach((item) => {
            const match = item.key.match(/(CLIENT_CODE_\d+_TRANSACTION_NUMBER_\d+\/)/);
            if (match) {
              transactionFolders.add(match[1]);
            }
          });
          processedResults = Array.from(transactionFolders).map((folder) => ({
            key: folder,
            type: "dir" as const,
          }));
        } else {
          // Normal search or transactionPattern is present
          processedResults = results;
        }

        setSearchResults((prev) =>
          continuationToken ? [...prev, ...processedResults] : processedResults
        );
        setSearchContinuationToken(res.data.nextContinuationToken);
        if (!continuationToken) {
          setSearchPage(1);
        }
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
    },
    [setLogs, transactionNumberPattern, filenamePattern, currentPrefix]
  );

  const handleLoadMoreSearch = useCallback(() => {
    if (searchContinuationToken) {
      handleSearch(searchContinuationToken);
    }
  }, [searchContinuationToken, handleSearch]);

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
      searchContinuationToken={searchContinuationToken}
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
      handleLoadMoreSearch={handleLoadMoreSearch}
      fetchS3Objects={fetchS3Objects}
    />
  );
};

export default S3BrowserTask;