import { useState, useCallback, useMemo } from "react";
import axios from "axios";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useDebounce } from "../../hooks/useDebounce";
import {
  S3Item,
  S3File,
  S3ApiResponse,
  S3UploadOptions,
  useS3BrowserProps,
  useS3UploadProps,
} from "./s3ManagerType";
import {
  fetchS3Objects,
  searchS3Folders,
  deleteS3Object,
  uploadOriginalToS3,
  uploadSplitFilesToS3,
} from "./s3ManagerService";

export const useS3BrowserHook = ({
  updateTaskLog,
  clearTaskLog,
}: useS3BrowserProps) => {
  const queryClient = useQueryClient();
  const [currentPrefix, setCurrentPrefix] = useState<string>("Data/");
  const [isFilterMode, setIsFilterMode] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  const {
    data: s3Data,
    fetchNextPage: handleLoadMore,
    hasNextPage,
    isLoading,
    refetch: refetchS3Objects,
  } = useInfiniteQuery({
    queryKey: ["s3Objects", currentPrefix],
    queryFn: ({ pageParam }: { pageParam?: string }) =>
      fetchS3Objects({ pageParam, prefix: currentPrefix }),
    getNextPageParam: (lastPage) => lastPage.nextContinuationToken,
    initialPageParam: undefined,
  });

  const {
    data: searchData,
    fetchNextPage: handleLoadMoreSearch,
    hasNextPage: hasNextSearchPage,
    isLoading: isSearching,
  } = useInfiniteQuery({
    queryKey: ["s3Search", currentPrefix, debouncedSearchTerm],
    queryFn: ({ pageParam }: { pageParam?: string }) =>
      searchS3Folders({
        pageParam,
        prefix: currentPrefix,
        pattern: debouncedSearchTerm,
      }),
    getNextPageParam: (lastPage) => lastPage.nextContinuationToken,
    enabled: debouncedSearchTerm.length > 0 && isFilterMode,
    initialPageParam: undefined,
  });

  const deleteMutation = useMutation({
    mutationFn: (key: string) => deleteS3Object(key),
    onSuccess: (_, key) => {
      updateTaskLog("s3Browser", {
        id: `DEL_OK_${Date.now()}`,
        message: `${key} deleted successfully.`,
        timestamp: new Date().toISOString(),
      });
      queryClient.invalidateQueries({ queryKey: ["s3Objects", currentPrefix] });
    },
    onError: (error: unknown, key) => {
      const errorMessage = axios.isAxiosError(error)
        ? error.response?.data?.error || "An unknown error occurred."
        : "An unknown error occurred.";

      updateTaskLog("s3Browser", {
        id: `DEL_ERR_${Date.now()}`,
        status: "Error",
        message: `Failed to delete ${key}: ${errorMessage}`,
        timestamp: new Date().toISOString(),
      });
    },
  });

  const handleDeleteS3File = useCallback(
    async (key: string) => {
      if (!window.confirm(`Are you sure you want to delete "${key}"?`)) {
        return;
      }
      updateTaskLog("s3Browser", {
        id: `DEL_START_${Date.now()}`,
        message: `Deleting ${key}...`,
        timestamp: new Date().toISOString(),
      });
      deleteMutation.mutate(key);
    },
    [deleteMutation, updateTaskLog]
  );

  const items = useMemo(() => {
    const newItems: S3Item[] = [];
    s3Data?.pages.forEach((page: S3ApiResponse) => {
      (page.directories ?? []).forEach((dir: string) =>
        newItems.push({ key: dir, type: "dir" })
      );
      (page.files ?? []).forEach((file: S3File) =>
        newItems.push({ ...file, type: "file" })
      );
    });
    return newItems;
  }, [s3Data]);

  const searchResults = useMemo(() => {
    const items: S3Item[] = [];
    searchData?.pages.forEach((page: S3ApiResponse) => {
      page.directories.forEach((dir: string) =>
        items.push({ key: dir, type: "dir" })
      );
    });
    return items;
  }, [searchData]);

  const handleDirectoryClick = useCallback(
    (directoryKey: string) => {
      clearTaskLog("s3Browser");
      setCurrentPrefix(directoryKey);
      setIsFilterMode(false);
      setSearchTerm("");
    },
    [clearTaskLog]
  );

  const handleBreadcrumbClick = useCallback(
    (index: number) => {
      clearTaskLog("s3Browser");
      const pathParts = currentPrefix.split("/").filter(Boolean);
      const newPrefix = pathParts.slice(0, index + 1).join("/") + "/";
      setCurrentPrefix(newPrefix);
    },
    [currentPrefix, clearTaskLog]
  );

  const handleReload = useCallback(() => {
    clearTaskLog("s3Browser");
    const defaultPrefix = "Data/";
    if (currentPrefix !== defaultPrefix) {
      const pathParts = currentPrefix.split("/").filter(Boolean);
      if (pathParts.length > 1) {
        const newPrefix =
          pathParts.slice(0, pathParts.length - 1).join("/") + "/";
        setCurrentPrefix(newPrefix);
      } else {
        setCurrentPrefix(defaultPrefix);
      }
    } else {
      refetchS3Objects();
    }
  }, [refetchS3Objects, clearTaskLog, currentPrefix, setCurrentPrefix]);

  return {
    items,
    currentPrefix,
    isLoading,
    isSearching,
    searchResults,
    isFilterMode,
    searchTerm,
    hasNextPage,
    hasNextSearchPage,
    setIsFilterMode,
    setSearchTerm,
    handleLoadMore,
    handleLoadMoreSearch,
    handleDeleteS3File,
    handleDirectoryClick,
    handleBreadcrumbClick,
    handleReload,
  };
};

export const useS3UploadHook = ({
  updateTaskLog,
  setUploadStatuses,
  clearTaskLog,
}: useS3UploadProps) => {
  const [originalLoading, setOriginalLoading] = useState(false);
  const [splitLoading, setSplitLoading] = useState(false);

  const handleUploadToS3 = useCallback(
    async (localDir: string, prefix: string, options?: S3UploadOptions) => {
      setOriginalLoading(true);
      clearTaskLog("s3Upload");

      updateTaskLog("s3Upload", {
        id: `UP_ORIG_START_${Date.now()}`,
        status: "Starting",
        message: "Initiating S3 original file upload...",
        progress: 0,
        total: 0,
        completed: 0,
        timestamp: new Date().toISOString(),
      });

      setUploadStatuses((prev) => [
        ...prev.filter(
          (upload) =>
            upload.fileName !== "Original File" &&
            upload.uploadKind !== "Originals"
        ),
        {
          fileName: "Original File",
          status: "pending",
          progress: 0,
          uploadKind: "Originals",
          totalFiles: 0,
          processedFiles: 0,
          successfulFiles: 0,
          errorFiles: 0,
        },
      ]);

      try {
        const response = await uploadOriginalToS3(localDir, prefix, options);
        updateTaskLog("s3Upload", {
          id: `UP_ORIG_OK_${Date.now()}`,
          message: `Original file upload successful: ${response.message}`,
          status: "Success",
          timestamp: new Date().toISOString(),
        });
        setUploadStatuses((prev) =>
          prev.map((upload) =>
            upload.fileName === "Original File"
              ? {
                  ...upload,
                  status: "completed",
                  progress: 100,
                  successfulFiles: response.successfulFilesCount || 1,
                  totalFiles:
                    (response.successfulFilesCount || 0) +
                    (response.failedFilesCount || 0),
                }
              : upload
          )
        );
      } catch (error) {
        const errorMessage = axios.isAxiosError(error)
          ? error.response?.data?.error || error.message
          : String(error);
        updateTaskLog("s3Upload", {
          id: `UP_ORIG_ERR_${Date.now()}`,
          status: "Error",
          message: `Original file upload failed: ${errorMessage}`,
          timestamp: new Date().toISOString(),
        });
        setUploadStatuses((prev) =>
          prev.map((upload) =>
            upload.fileName === "Original File"
              ? {
                  ...upload,
                  status: "failed",
                  progress: 0,
                  errorMessage: errorMessage,
                }
              : upload
          )
        );
      } finally {
        setOriginalLoading(false);
      }
    },
    [updateTaskLog, setUploadStatuses, clearTaskLog]
  );

  const handleUploadSplitFilesToS3 = useCallback(
    async (localDir: string, prefix: string, options?: S3UploadOptions) => {
      setSplitLoading(true);
      clearTaskLog("s3Upload");

      updateTaskLog("s3Upload", {
        id: `UP_SPLIT_START_${Date.now()}`,
        status: "Starting",
        message: "Initiating S3 split files upload...",
        progress: 0,
        total: 0,
        completed: 0,
        timestamp: new Date().toISOString(),
      });

      setUploadStatuses((prev) => [
        ...prev.filter(
          (upload) =>
            upload.fileName !== "Split Files" && upload.uploadKind !== "Splits"
        ),
        {
          fileName: "Split Files",
          status: "pending",
          progress: 0,
          uploadKind: "Splits",
          totalFiles: 0,
          processedFiles: 0,
          successfulFiles: 0,
          errorFiles: 0,
        },
      ]);

      try {
        const response = await uploadSplitFilesToS3(localDir, prefix, options);
        updateTaskLog("s3Upload", {
          id: `UP_SPLIT_OK_${Date.now()}`,
          message: `Split files upload successful: ${response.message}`,
          status: "Success",
          timestamp: new Date().toISOString(),
        });
        setUploadStatuses((prev) =>
          prev.map((upload) =>
            upload.fileName === "Split Files"
              ? {
                  ...upload,
                  status: "completed",
                  progress: 100,
                  successfulFiles: response.successfulFilesCount || 0,
                  totalFiles:
                    (response.successfulFilesCount || 0) +
                    (response.failedFilesCount || 0),
                }
              : upload
          )
        );
      } catch (error) {
        const errorMessage = axios.isAxiosError(error)
          ? error.response?.data?.error || error.message
          : String(error);
        updateTaskLog("s3Upload", {
          id: `UP_SPLIT_ERR_${Date.now()}`,
          status: "Error",
          message: `Split files upload failed: ${errorMessage}`,
          timestamp: new Date().toISOString(),
        });
        setUploadStatuses((prev) =>
          prev.map((upload) =>
            upload.fileName === "Split Files"
              ? {
                  ...upload,
                  status: "failed",
                  progress: 0,
                  errorMessage: errorMessage,
                }
              : upload
          )
        );
      } finally {
        setSplitLoading(false);
      }
    },
    [updateTaskLog, setUploadStatuses, clearTaskLog]
  );

  return {
    originalLoading,
    splitLoading,
    handleUploadToS3,
    handleUploadSplitFilesToS3,
  };
};
