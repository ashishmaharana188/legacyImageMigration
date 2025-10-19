import React, { useState, useCallback, useEffect, useRef } from "react";
import UploadAndScriptUI from "../ui/UploadAndScriptUI";
import { webSocketService } from "../../services/webSocketService";



interface UploadAndScriptTaskProps {
  updateTaskLog: (task: string, log: any) => void;
  clearTaskLog: (task: string) => void;
  setSummaryData: React.Dispatch<
    React.SetStateAction<{ [key: string]: any[] }>
  >;
  setUploadStatuses: React.Dispatch<React.SetStateAction<UploadStatus[]>>;
}

const UploadAndScriptTask: React.FC<UploadAndScriptTaskProps> = ({
  updateTaskLog,
  clearTaskLog,
  setSummaryData,
  setUploadStatuses,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadMessage, setUploadMessage] = useState<string>("");
  const [splitMessage, setSplitMessage] = useState<string>("");
  const [splitFiles, setSplitFiles] = useState<SplitFile[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  // Refs for throttling
  const splitProgressLatestRef = useRef<any | null>(null);
  const throttleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const THROTTLE_INTERVAL = 200; // Update UI every 200ms

  const applyThrottledUpdates = useCallback(() => {
    // Apply latest split progress
    const latestSplitMessage = splitProgressLatestRef.current;
    if (latestSplitMessage) {
      setUploadStatuses((prev) => {
        const newStatuses = prev.filter(
          (s) => s.fileName !== "splitting_progress"
        );
        const isComplete = latestSplitMessage.type === "splitProgressComplete";
        const progress = isComplete
          ? 100
          : latestSplitMessage.totalExpectedSplits > 0
          ? (latestSplitMessage.totalSplitFilesGenerated /
              latestSplitMessage.totalExpectedSplits) *
            100
          : 0;

        newStatuses.push({
          fileName: "splitting_progress",
          status: isComplete
            ? "Done"
            : latestSplitMessage.status || "In Progress",
          progress: progress,
          ...latestSplitMessage,
        });
        return newStatuses;
      });
      updateTaskLog("uploadAndScript", { splitSummary: latestSplitMessage });
      splitProgressLatestRef.current = null;
    }

    throttleTimerRef.current = null;
  }, [setUploadStatuses, updateTaskLog]);

  useEffect(() => {
    const handleMessage = (message: any) => {
      let needsUpdate = false;

      if (message.type === "s3-upload-total-directories") {
        setUploadStatuses((prevStatuses) => {
          const otherStatuses = prevStatuses.filter(
            (s) => s.fileName !== "s3_upload_progress"
          );
          return [
            ...otherStatuses,
            {
              fileName: "s3_upload_progress",
              status: "Starting upload",
              progress: 0,
              totalFiles: message.totalDirectories,
              processedFiles: 0,
            },
          ];
        });
      } else if (message.type === "s3-directory-progress") {
        setUploadStatuses((prevStatuses) => {
          const otherStatuses = prevStatuses.filter(
            (s) => s.fileName !== "s3_upload_progress"
          );
          const progress =
            message.totalDirectories > 0
              ? (message.completedDirectories / message.totalDirectories) * 100
              : 0;
          return [
            ...otherStatuses,
            {
              fileName: "s3_upload_progress",
              status:
                message.completedDirectories === message.totalDirectories
                  ? "Done"
                  : `Uploading ${message.currentDirectory}...`,
              progress: progress,
              totalFiles: message.totalDirectories,
              processedFiles: message.completedDirectories,
            },
          ];
        });
      } else if (
        message.type === "splitProgressUpdate" ||
        message.type === "splitProgressComplete"
      ) {
        splitProgressLatestRef.current = message;
        needsUpdate = true;
      }

      if (needsUpdate && !throttleTimerRef.current) {
        throttleTimerRef.current = setTimeout(
          applyThrottledUpdates,
          THROTTLE_INTERVAL
        );
      }
    };

    webSocketService.addListener(handleMessage);

    return () => {
      webSocketService.removeListener(handleMessage);
      if (throttleTimerRef.current) {
        clearTimeout(throttleTimerRef.current);
      }
    };
  }, [applyThrottledUpdates, setUploadStatuses]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isUploading) {
      interval = setInterval(async () => {
        try {
          const res = await axios.get<UploadProgressResponse>(
            "http://localhost:3000/upload-progress"
          );
          const { totalRows, processedRows, successfulRows, errors, notFound } =
            res.data;

          setUploadStatuses((prev) =>
            prev.map((s) =>
              s.fileName === "excel_upload_progress"
                ? {
                    ...s,
                    progress:
                      totalRows > 0 ? (processedRows / totalRows) * 100 : 0,
                    totalFiles: totalRows,
                    processedFiles: processedRows,
                    successfulFiles: successfulRows,
                    errorFiles: errors,
                    notFoundFiles: notFound,
                  }
                : s
            )
          );
        } catch (error) {
          console.error("Failed to fetch upload progress:", error);
        }
      }, 5000); // Poll every 5 seconds
    } else if (interval) {
      clearInterval(interval);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isUploading, setUploadStatuses]);

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      handleFileChangeUtil(
        event,
        setSelectedFile,
        setUploadMessage,
        setSplitMessage,
        setSplitFiles
      );
    },
    []
  );

  const handleUpload = useCallback(async () => {
    handleUploadUtil(
      selectedFile,
      updateTaskLog,
      clearTaskLog,
      setUploadMessage,
      setLoading,
      setIsUploading,
      setUploadStatuses
    );
  }, [selectedFile, updateTaskLog, clearTaskLog]);

  const handleSplitFiles = useCallback(async () => {
    if (!selectedFile) {
      setSplitMessage("Please upload a file first.");
      return;
    }
    clearTaskLog("uploadAndScript");
    setUploadStatuses([]); // Clear previous upload progress
    setLoading(true);
    const splitLogId = "splitting-status";
    setSplitMessage("Splitting files");
    updateTaskLog("uploadAndScript", {
      id: splitLogId,
      message: "Splitting files...",
      status: "in-progress",
    });

    // Initialize splitting progress status
    setUploadStatuses((prevStatuses) => {
      const splittingStatus: UploadStatus = {
        fileName: "splitting_progress",
        status: "Starting",
        totalOriginalFilesProcessed: 0,
        totalExpectedSplits: 0,
        totalSplitFilesGenerated: 0,
        splitErrors: 0,
        currentlySplittingFiles: "",
        progress: 0,
      };
      return [...prevStatuses, splittingStatus];
    });

    try {
      const res = await axios.post<SplitFileResponse>(
        "http://localhost:3000/split-files",
        {
          filename: selectedFile.name,
        }
      );
      setSplitFiles(res.data.splitFiles || []);
      setSplitMessage(res.data.message || "Splitting successful");
      const { message: resMessage, ...restData } = res.data;
      updateTaskLog("uploadAndScript", {
        id: splitLogId,
        message: "Splitting Successful!",
        status: "success",
        ...restData,
      });
      setUploadStatuses((prevStatuses) =>
        prevStatuses.map((s) => {
          if (!s || typeof s.fileName !== "string") {
            return s; // Return item as is if it's not a valid UploadStatus
          }
          return s.fileName === "splitting_progress"
            ? { ...s, status: "Failed", progress: 0 }
            : s;
        })
      );
    } finally {
      setLoading(false);
    }
  }, [selectedFile, updateTaskLog, clearTaskLog, setUploadStatuses]);

  const handleUploadToS3 = useCallback(async () => {
    clearTaskLog("uploadAndScript");
    setLoading(true);
    const s3UploadLogId = "s3-upload-status";
    setUploadMessage("Uploading to S3");
    updateTaskLog("uploadAndScript", {
      id: s3UploadLogId,
      message: "Initiating S3 upload...",
      status: "in-progress",
    });
    setUploadStatuses([
      {
        fileName: "s3_upload_progress",
        status: "Starting",
        progress: 0,
        totalFiles: 1,
        processedFiles: 0,
      },
    ]);

    try {
      const res = await axios.post<FileResponse>(
        "http://localhost:3000/upload-to-s3"
      );
      const {
        successfulFilesCount = 0,
        failedFilesCount = 0,
        message: resMessage,
      } = res.data;

      let finalMessage = resMessage || "S3 upload completed.";

      if (failedFilesCount > 0 && successfulFilesCount > 0) {
        finalMessage = `S3 upload completed: ${successfulFilesCount} Successful - ${failedFilesCount} Failed.`;
      } else if (successfulFilesCount > 0 || failedFilesCount == 0) {
        finalMessage = `S3 upload completed successfully. Total files uploaded: ${successfulFilesCount}.`;
      } else {
        finalMessage = resMessage || "No files found to upload.";
        // Or 'info' if available, assuming no error if no files
      }

      setUploadMessage(finalMessage);
      updateTaskLog("uploadAndScript", {
        id: s3UploadLogId,
        message: finalMessage,

        ...res.data,
      });

      setUploadStatuses((prevStatuses) =>
        prevStatuses.map((s) =>
          s.fileName === "s3_upload_progress"
            ? {
                ...s,

                progress: 100,
                successfulFiles: successfulFilesCount,
                errorFiles: failedFilesCount,
              }
            : s
        )
      );
    } catch (error: any) {
      const errorMessage = `Upload to S3 failed: ${
        error.response?.data?.message || error.message
      }`;
      setUploadMessage(errorMessage);
      updateTaskLog("uploadAndScript", {
        id: s3UploadLogId,
        message: errorMessage,
        status: "failed",
      });
    } finally {
      setLoading(false);
    }
  }, [updateTaskLog, clearTaskLog, setSummaryData, setUploadStatuses]);

  const handleUploadSplitFilesToS3 = useCallback(async () => {
    clearTaskLog("uploadAndScript");
    setLoading(true);
    const splitS3UploadLogId = "split-s3-upload-status";
    setSplitMessage("Uploading split files to S3");
    updateTaskLog("uploadAndScript", {
      id: splitS3UploadLogId,
      message: "Initiating split file S3 upload...",
      status: "in-progress",
    });
    setUploadStatuses([
      {
        fileName: "s3_upload_progress",
        status: "Starting",
        progress: 0,
        totalFiles: 1,
        processedFiles: 0,
      },
    ]);
    try {
      const res = await axios.post<FileResponse>(
        "http://localhost:3000/upload-split-to-s3",
        {}
      );
      const {
        successfulFilesCount = 0,
        failedFilesCount = 0,
        message: resMessage,
      } = res.data;

      let finalMessage = resMessage || "S3 split files upload completed.";

      if (failedFilesCount > 0) {
        finalMessage = `S3 split files upload completed: ${successfulFilesCount} Successful and ${failedFilesCount} Failed`;
      } else if (successfulFilesCount > 0) {
        finalMessage = `S3 split files upload completed successfully. Total files uploaded: ${successfulFilesCount}.`;
      } else {
        finalMessage = resMessage || "No split files found to upload.";
      }

      setSplitMessage(finalMessage);
      updateTaskLog("uploadAndScript", {
        id: splitS3UploadLogId,
        message: finalMessage,

        ...res.data,
      });

      setUploadStatuses((prevStatuses) =>
        prevStatuses.map((s) =>
          s.fileName === "s3_upload_progress"
            ? {
                ...s,
                progress: 100,
                successfulFiles: successfulFilesCount,
                errorFiles: failedFilesCount,
              }
            : s
        )
      );
    } catch (error: any) {
      const errorMessage = `Upload of split files to S3 failed: ${
        error.response?.data?.message || error.message
      }`;
      setSplitMessage(errorMessage);
      updateTaskLog("uploadAndScript", {
        id: splitS3UploadLogId,
        message: errorMessage,
        status: "failed",
      });
    } finally {
      setLoading(false);
    }
  }, [updateTaskLog, clearTaskLog, setUploadStatuses]);

  const handleFallback = useCallback(async () => {
    handleFallbackUtil(
      selectedFile,
      updateTaskLog,
      clearTaskLog,
      setUploadMessage,
      setLoading
    );
  }, [selectedFile, updateTaskLog, clearTaskLog]);

  const handleSplitFilesWithMuPDF = useCallback(async () => {
    if (!selectedFile) {
      setSplitMessage("Please upload a file first.");
      return;
    }
    clearTaskLog("uploadAndScript");
    setUploadStatuses([]); // Clear previous upload progress
    setLoading(true);
    const mupdfSplitLogId = "mupdf-splitting-status";
    setSplitMessage("Splitting files with MuPDF");
    updateTaskLog("uploadAndScript", {
      id: mupdfSplitLogId,
      message: "Splitting files with MuPDF...",
      status: "in-progress",
    });

    // Initialize splitting progress status
    setUploadStatuses((prevStatuses) => {
      const splittingStatus: UploadStatus = {
        fileName: "splitting_progress",
        status: "Starting",
        totalOriginalFilesProcessed: 0,
        totalSplitFilesGenerated: 0,
        splitErrors: 0,
        currentlySplittingFiles: "",
        progress: 0,
      };
      return [...prevStatuses, splittingStatus];
    });

    try {
      const res = await axios.post<SplitFileResponse>(
        "http://localhost:3000/split-mupdf"
      );
      setSplitFiles(res.data.splitFiles || []);
      setSplitMessage(res.data.message || "Splitting successful");
      const { message: resMessage, ...restData } = res.data;
      updateTaskLog("uploadAndScript", {
        id: mupdfSplitLogId,
        message: "Splitting with MuPDF Successful!",
        status: "success",
        ...restData,
      });
    } catch (error: any) {
      const errorMessage = `Splitting failed: ${
        error.response?.data?.message || error.message || "Unknown error"
      }`;
      setSplitMessage(errorMessage);
      updateTaskLog("uploadAndScript", {
        id: mupdfSplitLogId,
        message: errorMessage,
        status: "failed",
      });
      setUploadStatuses((prevStatuses) =>
        prevStatuses.map((s) => {
          if (!s || typeof s.fileName !== "string") {
            return s; // Return item as is if it's not a valid UploadStatus
          }
          return s.fileName === "splitting_progress"
            ? { ...s, status: "Failed", progress: 0 }
            : s;
        })
      );
    } finally {
      setLoading(false);
    }
  }, [selectedFile, updateTaskLog, clearTaskLog, setUploadStatuses]);

  return (
    <UploadAndScriptUI
      selectedFile={selectedFile}
      uploadMessage={uploadMessage}
      splitMessage={splitMessage}
      splitFiles={splitFiles}
      loading={loading}
      handleFileChange={handleFileChange}
      handleUpload={handleUpload}
      handleFallback={handleFallback}
      handleSplitFiles={handleSplitFiles}
      handleSplitFilesWithMuPDF={handleSplitFilesWithMuPDF}
      handleUploadToS3={handleUploadToS3}
      handleUploadSplitFilesToS3={handleUploadSplitFilesToS3}
    />
  );
};

export default UploadAndScriptTask;
