import React, { useState, useCallback, useMemo } from "react";
import axios from "axios";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import S3BrowserUI from "../ui/S3BrowserUI";
import { useDebounce } from "../../hooks/useDebounce";

interface S3File {
  key: string;
  lastModified?: string;
}

interface S3Item {
  key: string;
  type: "file" | "dir";
  lastModified?: string;
}

interface S3ApiResponse {
  files: S3File[];
  directories: string[];
  nextContinuationToken?: string;
}

interface S3BrowserTaskProps {
  updateTaskLog: (task: string, log: any) => void;
  clearTaskLog: (task: string) => void;
}

const fetchS3Objects = async ({
  pageParam,
  prefix = "Data/",
}: {
  pageParam?: string;
  prefix?: string;
}): Promise<S3ApiResponse> => {
  const { data } = await axios.get("http://localhost:3000/s3-list-objects", {
    params: { prefix, continuationToken: pageParam },
  });
  return data;
};

const searchS3Folders = async ({
  pageParam,
  prefix = "Data/",
  pattern = "",
}: {
  pageParam?: string;
  prefix?: string;
  pattern?: string;
}): Promise<S3ApiResponse> => {
  const { data } = await axios.get("http://localhost:3000/s3-search-folders", {
    params: { prefix, pattern, continuationToken: pageParam },
  });
  return data;
};

const S3BrowserTask: React.FC<S3BrowserTaskProps> = ({ updateTaskLog }) => {
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
    mutationFn: (key: string) =>
      axios.post("http://localhost:3000/s3-delete-object", { keys: [key] }),
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

  const handleGenerateReport = useCallback(async () => {
    updateTaskLog("s3Browser", { message: `Generating report for prefix: ${currentPrefix}` });
    try {
      const response = await axios.post("http://localhost:3000/s3-generate-report", {
        prefix: currentPrefix,
      }, {
        responseType: 'blob', // Important for downloading files
      });

      // Create a blob from the response data
      const blob = new Blob([response.data], { type: "text/csv" });

      // Create a link element
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = `s3_report_${currentPrefix.replace(/\//g, "_") || "root"}.csv`;

      // Append to the document body and click it to trigger the download
      document.body.appendChild(link);
      link.click();

      // Clean up
      document.body.removeChild(link);
      window.URL.revokeObjectURL(link.href);

      updateTaskLog("s3Browser", { message: "S3 report generated and downloaded successfully." });
    } catch (error) {
      if (axios.isAxiosError(error)) {
        updateTaskLog("s3Browser", {
          message: `Failed to generate S3 report: ${
            error.response?.data?.error || "An unknown error occurred."
          }`,
        });
      } else {
        updateTaskLog("s3Browser", {
          message: `Failed to generate S3 report: An unknown error occurred.`,
        });
      }
    } finally {
      updateTaskLog("s3Browser", { message: "Report generation process finished." });
    }
  }, [currentPrefix, updateTaskLog]);

  return (
    <S3BrowserUI
      items={allS3Items}
      currentPrefix={currentPrefix}
      isLoading={isS3Loading || isFetchingNextS3Page}
      isSearching={isSearching || isFetchingNextSearchPage}
      searchResults={searchResults}
      isFilterMode={isFilterMode}
      searchTerm={searchTerm}
      hasNextPage={hasNextS3Page}
      hasNextSearchPage={hasNextSearchPage}
      setIsFilterMode={setIsFilterMode}
      setSearchTerm={setSearchTerm}
      handleLoadMore={fetchNextS3Page}
      handleLoadMoreSearch={fetchNextSearchPage}
      handleDeleteS3File={handleDeleteS3File}
      handleDirectoryClick={handleDirectoryClick}
      handleBreadcrumbClick={handleBreadcrumbClick}
      handleReload={handleReload}
      handleGenerateReport={handleGenerateReport}
    />
  );
};

export default S3BrowserTask;
