import React, { useState, useCallback, useMemo, useEffect } from "react";
import axios from "axios";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import S3BrowserUI from "../ui/S3BrowserUI";
import { useDebounce } from "../../hooks/useDebounce";
import { webSocketService } from "../../services/webSocketService";
import {
  API_BASE_URL,
  configPromise,
} from "../../api/uploadProcessor/uploadProcessorService";

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

interface FileResponse {
  successfulFilesCount?: number;
  failedFilesCount?: number;
  message?: string;
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

const S3BrowserTask: React.FC<S3BrowserTaskProps> = ({
  updateTaskLog,
  clearTaskLog,
}) => {
  const queryClient = useQueryClient();
  const [currentPrefix, setCurrentPrefix] = useState<string>("Data/");
  const [isFilterMode, setIsFilterMode] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  // --- WebSocket Listener for S3 Progress ---
  useEffect(() => {
    const handleMessage = (message: any) => {
      if (message.type === "s3-upload-total-directories") {
        updateTaskLog("s3Browser", {
          message: `Starting S3 Upload: ${message.totalDirectories} directories to process.`,
          status: "in-progress",
        });
      } else if (message.type === "s3-directory-progress") {
        const percent =
          message.totalDirectories > 0
            ? Math.round(
                (message.completedDirectories / message.totalDirectories) * 100
              )
            : 0;

        updateTaskLog("s3Browser", {
          id: "s3-progress-monitor",
          message: `Uploading: ${message.currentDirectory} (${percent}%)`,
          status: "in-progress",
        });
      }
    };

    webSocketService.addListener(handleMessage);
    return () => webSocketService.removeListener(handleMessage);
  }, [updateTaskLog]);

  // --- S3 Upload Handlers ---
  const handleUploadToS3 = useCallback(async () => {
    updateTaskLog("s3Browser", {
      message: "Initiating S3 upload...",
      status: "in-progress",
    });

    try {
      await configPromise;
      const res = await axios.post<FileResponse>(
        `${API_BASE_URL}/upload-to-s3`
      );
      const {
        successfulFilesCount = 0,
        failedFilesCount = 0,
        message: resMessage,
      } = res.data;

      let finalMessage = resMessage || "S3 upload completed.";
      if (failedFilesCount > 0 && successfulFilesCount > 0) {
        finalMessage = `S3 upload completed: ${successfulFilesCount} Successful - ${failedFilesCount} Failed.`;
      } else if (successfulFilesCount > 0 || failedFilesCount === 0) {
        finalMessage = `S3 upload completed successfully. Total: ${successfulFilesCount}.`;
      }

      updateTaskLog("s3Browser", {
        message: finalMessage,
        status: "success",
        ...res.data,
      });
      queryClient.invalidateQueries({ queryKey: ["s3Objects"] });
    } catch (error: any) {
      const errorMessage = `Upload to S3 failed: ${
        error.response?.data?.message || error.message
      }`;
      updateTaskLog("s3Browser", {
        message: errorMessage,
        status: "failed",
      });
    }
  }, [updateTaskLog, queryClient]);

  const handleUploadSplitFilesToS3 = useCallback(async () => {
    updateTaskLog("s3Browser", {
      message: "Initiating split file S3 upload...",
      status: "in-progress",
    });

    try {
      await configPromise;
      const res = await axios.post<FileResponse>(
        `${API_BASE_URL}/upload-split-to-s3`,
        {}
      );
      const {
        successfulFilesCount = 0,
        failedFilesCount = 0,
        message: resMessage,
      } = res.data;

      let finalMessage = resMessage || "S3 split files upload completed.";
      if (failedFilesCount > 0) {
        finalMessage = `Result: ${successfulFilesCount} Successful, ${failedFilesCount} Failed`;
      } else if (successfulFilesCount > 0) {
        finalMessage = `Success. Total uploaded: ${successfulFilesCount}.`;
      }

      updateTaskLog("s3Browser", {
        message: finalMessage,
        status: "success",
        ...res.data,
      });
      queryClient.invalidateQueries({ queryKey: ["s3Objects"] });
    } catch (error: any) {
      const errorMessage = `Upload of split files to S3 failed: ${
        error.response?.data?.message || error.message
      }`;
      updateTaskLog("s3Browser", {
        message: errorMessage,
        status: "failed",
      });
    }
  }, [updateTaskLog, queryClient]);

  // --- S3 Fetching Logic ---
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
      page.directories.forEach((dir: string) =>
        items.push({ key: dir, type: "dir" })
      );
      page.files.forEach((file: S3File) =>
        items.push({ ...file, type: "file" })
      );
    });
    return items;
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
      handleUploadToS3={handleUploadToS3}
      handleUploadSplitFilesToS3={handleUploadSplitFilesToS3}
    />
  );
};

export default S3BrowserTask;
