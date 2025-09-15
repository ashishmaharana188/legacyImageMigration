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
  updateTaskLog: (task: string, log: any) => void;
}

const S3BrowserTask: React.FC<S3BrowserTaskProps> = ({ updateTaskLog }) => {
  const [s3Files, setS3Files] = useState<S3File[]>([]);
  const [s3Directories, setS3Directories] = useState<string[]>([]);
  const [currentPrefix, setCurrentPrefix] = useState<string>("");
  const [nextContinuationToken, setNextContinuationToken] = useState<
    string | undefined
  >(undefined);
  const [isFilterMode, setIsFilterMode] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchResults, setSearchResults] = useState<S3Item[]>([]);
  const [clientPage, setClientPage] = useState<number>(1);
  const [searchPage, setSearchPage] = useState<number>(1);
  const DISPLAY_ITEMS_PER_PAGE = 10;

  const totalPages = Math.ceil(
    (s3Files.length + s3Directories.length) / DISPLAY_ITEMS_PER_PAGE
  );
  const totalSearchPages = Math.ceil(
    searchResults.length / DISPLAY_ITEMS_PER_PAGE
  );

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
      updateTaskLog('s3Browser', { message: "Fetching S3 objects..." });
      try {
        const res = await axios.get("http://localhost:3000/s3-list-objects", {
          params: { prefix, continuationToken },
        });
        const {
          files,
          directories,
          nextContinuationToken: newContinuationToken,
        } = res.data;

        const sortedFiles = files.sort((a: S3File, b: S3File) => {
          const dateA = a.lastModified ? new Date(a.lastModified).getTime() : 0;
          const dateB = b.lastModified ? new Date(b.lastModified).getTime() : 0;
          return dateB - dateA;
        });

        const sortedDirectories = directories.sort((a: string, b: string) =>
          a.localeCompare(b)
        );

        setS3Files((prev) =>
          continuationToken ? [...prev, ...sortedFiles] : sortedFiles
        );
        setS3Directories((prev) =>
          continuationToken
            ? [...prev, ...sortedDirectories]
            : sortedDirectories
        );
        setCurrentPrefix(prefix);
        setNextContinuationToken(newContinuationToken);
        updateTaskLog('s3Browser', { message: "S3 objects fetched successfully." });
      } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
          updateTaskLog('s3Browser', { message: `Failed to fetch S3 objects: ${error.response?.data?.error || "An unknown error occurred."}` });
        } else {
          updateTaskLog('s3Browser', { message: "Failed to fetch S3 objects: An unknown error occurred." });
        }
      }
    },
    [updateTaskLog]
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
      updateTaskLog('s3Browser', { message: `Deleting ${key}...` });
      try {
        await axios.post("http://localhost:3000/s3-delete-object", {
          keys: [key],
        });
        updateTaskLog('s3Browser', { message: `${key} deleted successfully.` });
        fetchS3Objects(currentPrefix);
      } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
          updateTaskLog('s3Browser', { message: `Failed to delete ${key}: ${error.response?.data?.error || "An unknown error occurred."}` });
        } else {
          updateTaskLog('s3Browser', { message: `Failed to delete ${key}: An unknown error occurred.` });
        }
      }
    },
    [updateTaskLog, fetchS3Objects, currentPrefix]
  );

  const handleDirectoryClick = useCallback(
    (directoryKey: string) => {
      setS3Files([]);
      setS3Directories([]);
      setClientPage(1);
      setIsFilterMode(false);
      setSearchTerm("");
      setSearchResults([]);
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
    async (searchTerm: string) => {
      if (!searchTerm) {
        setSearchResults([]);
        return;
      }
      setIsSearching(true);
      setSearchResults([]);
      updateTaskLog("s3Browser", { message: "Searching S3..." });
      setSearchPage(1);

      let continuationToken: string | undefined;
      try {
        do {
          const res = await axios.get(
            "http://localhost:3000/s3-search-folders",
            {
              params: {
                prefix: currentPrefix,
                pattern: searchTerm,
                continuationToken,
              },
            }
          );

          const {
            directories,
            nextContinuationToken: newSearchContinuationToken,
          } = res.data;

          const newResults: S3Item[] = [
            ...directories.map((dir: string) => ({
              key: dir,
              type: "dir" as const,
            })),
          ];

          setSearchResults((prev) => [...prev, ...newResults]);
          continuationToken = newSearchContinuationToken;
        } while (continuationToken);

        updateTaskLog("s3Browser", { message: "S3 search complete." });
      } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
          updateTaskLog("s3Browser", {
            message: `S3 search failed: ${
              error.response?.data?.error || "An unknown error occurred."
            }`,
          });
        } else {
          updateTaskLog("s3Browser", {
            message: "S3 search failed: An unknown error occurred.",
          });
        }
      } finally {
        setIsSearching(false);
      }
    },
    [updateTaskLog, currentPrefix]
  );

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      handleSearch(searchTerm);
    }, 500); // 500ms debounce delay

    return () => {
      clearTimeout(debounceTimer);
    };
  }, [searchTerm, handleSearch]);

  const handleReload = useCallback(() => {
    fetchS3Objects(currentPrefix);
  }, [fetchS3Objects, currentPrefix]);

  return (
    <S3BrowserUI
      s3Files={s3Files}
      s3Directories={s3Directories}
      currentPrefix={currentPrefix}
      nextContinuationToken={nextContinuationToken}
      isFilterMode={isFilterMode}
      searchTerm={searchTerm}
      isSearching={isSearching}
      searchResults={searchResults}
      clientPage={clientPage}
      searchPage={searchPage}
      totalPages={totalPages}
      totalSearchPages={totalSearchPages}
      paginatedItems={paginatedItems}
      paginatedSearchResults={paginatedSearchResults}
      setIsFilterMode={setIsFilterMode}
      setSearchTerm={setSearchTerm}
      setClientPage={setClientPage}
      setSearchPage={setSearchPage}
      handleLoadMore={handleLoadMore}
      handleDeleteS3File={handleDeleteS3File}
      handleDirectoryClick={handleDirectoryClick}
      handleBreadcrumbClick={handleBreadcrumbClick}
      handleSearch={() => handleSearch(searchTerm)}
      handleReload={handleReload}
    />
  );
};

export default S3BrowserTask;
