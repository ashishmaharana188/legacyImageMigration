import { useState, useCallback, useMemo } from "react";
import axios from "axios";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useDebounce } from "../../hooks/useDebounce";
import { S3Item, S3File, S3ApiResponse, useS3BrowserProps } from "./s3ManagerType";
import { fetchS3Objects, searchS3Folders, deleteS3Object } from "./s3ManagerService";

export const useS3BrowserHook = ({ updateTaskLog, clearTaskLog }: useS3BrowserProps) => {
  const queryClient = useQueryClient();
  const [currentPrefix, setCurrentPrefix] = useState<string>("Data/");
  const [isFilterMode, setIsFilterMode] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  const {
    data: s3Data,
    fetchNextPage: fetchNextS3Page,
    hasNextPage: hasNextS3Page,
    isLoading: isS3Loading,
    isFetchingNextPage: isFetchingNextS3Page,
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
    fetchNextPage: fetchNextSearchPage,
    hasNextPage: hasNextSearchPage,
    isLoading: isSearching,
    isFetchingNextPage: isFetchingNextSearchPage,
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

  const allS3Items = useMemo(() => {
    const items: S3Item[] = [];
    s3Data?.pages.forEach((page: S3ApiResponse) => {
      page.directories.forEach((dir: string) => items.push({ key: dir, type: "dir" }));
      page.files.forEach((file: S3File) => items.push({ ...file, type: "file" }));
    });
    return items;
  }, [s3Data]);

  const searchResults = useMemo(() => {
    const items: S3Item[] = [];
    searchData?.pages.forEach((page: S3ApiResponse) => {
      page.directories.forEach((dir: string) => items.push({ key: dir, type: "dir" }));
    });
    return items;
  }, [searchData]);

  const handleDirectoryClick = useCallback((directoryKey: string) => {
    setCurrentPrefix(directoryKey);
    setIsFilterMode(false);
    setSearchTerm("");
  }, []);

  const handleBreadcrumbClick = useCallback(
    (index: number) => {
      const pathParts = currentPrefix.split("/").filter(Boolean);
      const newPrefix = pathParts.slice(0, index + 1).join("/") + "/";
      setCurrentPrefix(newPrefix);
    },
    [currentPrefix]
  );

  const handleReload = useCallback(() => {
    refetchS3Objects();
  }, [refetchS3Objects]);

  return {
    allS3Items,
    currentPrefix,
    isS3Loading,
    isFetchingNextS3Page,
    isSearching,
    isFetchingNextSearchPage,
    searchResults,
    isFilterMode,
    searchTerm,
    hasNextS3Page,
    hasNextSearchPage,
    setIsFilterMode,
    setSearchTerm,
    fetchNextS3Page,
    fetchNextSearchPage,
    handleDeleteS3File,
    handleDirectoryClick,
    handleBreadcrumbClick,
    handleReload,
  };
};