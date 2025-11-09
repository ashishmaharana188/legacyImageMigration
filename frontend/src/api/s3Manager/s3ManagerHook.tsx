import { useState, useCallback, useMemo } from "react";
import axios from "axios";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useDebounce } from "../../hooks/useDebounce";
import { S3Item, S3File, S3ApiResponse, useS3BrowserProps, useS3UploadProps } from "./s3ManagerType";
import { fetchS3Objects, searchS3Folders, deleteS3Object, uploadOriginalToS3, uploadSplitFilesToS3 } from "./s3ManagerService";

export const useS3BrowserHook = ({ updateTaskLog, clearTaskLog }: useS3BrowserProps) => {
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
      updateTaskLog("s3Browser", { message: `${key} deleted successfully.` });
      queryClient.invalidateQueries({ queryKey: ["s3Objects", currentPrefix] });
    },
    onError: (error: unknown, key) => {
      if (axios.isAxiosError(error)) {
        updateTaskLog("s3Browser", {
          message: `Failed to delete ${key}: ${
            error.response?.data?.error || "An unknown error occurred."
          }`,
        });
      } else {
        updateTaskLog("s3Browser", {
          message: `Failed to delete ${key}: An unknown error occurred.`,
        });
      }
    },
  });

  const handleDeleteS3File = useCallback(
    async (key: string) => {
      if (!window.confirm(`Are you sure you want to delete "${key}"?`)) {
        return;
      }
      updateTaskLog("s3Browser", { message: `Deleting ${key}` });
      deleteMutation.mutate(key);
    },
    [deleteMutation, updateTaskLog]
  );

  const items = useMemo(() => {
    const newItems: S3Item[] = [];
    s3Data?.pages.forEach((page: S3ApiResponse) => {
      (page.directories ?? []).forEach((dir: string) => newItems.push({ key: dir, type: "dir" }));
      (page.files ?? []).forEach((file: S3File) => newItems.push({ ...file, type: "file" }));
    });
    return newItems;
  }, [s3Data]);

  const searchResults = useMemo(() => {
    const items: S3Item[] = [];
    searchData?.pages.forEach((page: S3ApiResponse) => {
      page.directories.forEach((dir: string) => items.push({ key: dir, type: "dir" }));
    });
    return items;
  }, [searchData]);

  const handleDirectoryClick = useCallback((directoryKey: string) => {
    clearTaskLog("s3Browser");
    setCurrentPrefix(directoryKey);
    setIsFilterMode(false);
    setSearchTerm("");
  }, [clearTaskLog]);

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
        const newPrefix = pathParts.slice(0, pathParts.length - 1).join("/") + "/";
        setCurrentPrefix(newPrefix);
      } else {
        // If only one part (e.g., 'Data/'), go to default
        setCurrentPrefix(defaultPrefix);
      }
    } else {
      // Already at default, just refetch
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

export const useS3UploadHook = ({ updateTaskLog, setUploadStatuses }: useS3UploadProps) => {
  const [loading, setLoading] = useState(false);

  const handleUploadToS3 = useCallback(async (localDir: string, prefix: string) => {
    setLoading(true);
    updateTaskLog("s3Upload", { message: "Initiating S3 original file upload..." });
    setUploadStatuses((prev) => [...prev, { id: Date.now(), name: "Original File Upload", status: "pending", fileName: "Original File" }]);
    try {
      const response = await uploadOriginalToS3(localDir, prefix);
      updateTaskLog("s3Upload", { message: `Original file upload successful: ${response.message}` });
      setUploadStatuses((prev) => prev.map((upload) => upload.fileName === "Original File Upload" ? { ...upload, status: "completed" } : upload));
    } catch (error) {
      const errorMessage = axios.isAxiosError(error) ? error.response?.data?.error || error.message : String(error);
      updateTaskLog("s3Upload", { message: `Original file upload failed: ${errorMessage}` });
      setUploadStatuses((prev) => prev.map((upload) => upload.fileName === "Original File Upload" ? { ...upload, status: "failed", error: errorMessage } : upload));
    } finally {
      setLoading(false);
    }
  }, [updateTaskLog, setUploadStatuses]);

  const handleUploadSplitFilesToS3 = useCallback(async (localDir: string, prefix: string) => {
    setLoading(true);
    updateTaskLog("s3Upload", { message: "Initiating S3 split files upload..." });
    setUploadStatuses((prev) => [...prev, { id: Date.now(), name: "Split Files Upload", status: "pending", fileName: "Split Files" }]);
    try {
      const response = await uploadSplitFilesToS3(localDir, prefix);
      updateTaskLog("s3Upload", { message: `Split files upload successful: ${response.message}` });
      setUploadStatuses((prev) => prev.map((upload) => upload.fileName === "Split Files Upload" ? { ...upload, status: "completed" } : upload));
    } catch (error) {
      const errorMessage = axios.isAxiosError(error) ? error.response?.data?.error || error.message : String(error);
      updateTaskLog("s3Upload", { message: `Split files upload failed: ${errorMessage}` });
      setUploadStatuses((prev) => prev.map((upload) => upload.fileName === "Split Files Upload" ? { ...upload, status: "failed", error: errorMessage } : upload));
    } finally {
      setLoading(false);
    }
  }, [updateTaskLog, setUploadStatuses]);

  return {
    loading,
    handleUploadToS3,
    handleUploadSplitFilesToS3,
  };
};
