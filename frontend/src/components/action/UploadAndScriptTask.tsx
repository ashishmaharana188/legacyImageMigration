import React, { useState, useCallback, useEffect, useRef } from "react";
import UploadProcessorUI from "../../api/uploadProcessor/uploadProcessorUI";
import SplitProcessorUI from "../../api/splitProcessor/splitProcessorUI";
import { webSocketService } from "../../services/webSocketService";
import { API_BASE_URL, configPromise } from "../../api/uploadProcessor/uploadProcessorService";
import { useUploadProcessorHook } from "../../api/uploadProcessor/uploadProcessorHook";
import { useSplitProcessorHook } from "../../api/splitProcessor/splitProcessorHook";
import { UploadStatus, FileResponse, UploadProgressResponse, SplitFileResponse } from "../../api/uploadProcessor/uploadProcessorType";

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

  const { 
    selectedFile,
    uploadMessage,
    loading: uploadLoading,
    isUploading,
    handleFileChange,
    handleUpload,
    handleFallback,
    setSelectedFile
  } = useUploadProcessorHook({
    updateTaskLog,
    clearTaskLog,
    setUploadStatuses,
  });

  const {
    loading: splitLoading,
    splitMessage,
    handleSplitFiles,
    handleSplitFilesWithMuPDF,
    splitFiles
  } = useSplitProcessorHook({
    updateTaskLog,
    clearTaskLog,
    setUploadStatuses,
  });

  const loading = uploadLoading || splitLoading;

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
          await configPromise;
          const res = await axios.get<UploadProgressResponse>(
            `${API_BASE_URL}/upload-progress`
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

  const handleUploadToS3 = useCallback(async () => {
    clearTaskLog("uploadAndScript");
    const s3UploadLogId = "s3-upload-status";
    // Removed setLoading(true) from here, it should be handled inside the util or hook
    // setUploadMessage("Uploading to S3"); // This should be handled by the hook
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
      } else if (successfulFilesCount > 0 || failedFilesCount == 0) {
        finalMessage = `S3 upload completed successfully. Total files uploaded: ${successfulFilesCount}.`;
      } else {
        finalMessage = resMessage || "No files found to upload.";
        // Or 'info' if available, assuming no error if no files
      }

      // setUploadMessage(finalMessage); // This should be handled by the hook
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
      // setUploadMessage(errorMessage); // This should be handled by the hook
      updateTaskLog("uploadAndScript", {
        id: s3UploadLogId,
        message: errorMessage,
        status: "failed",
      });
    } finally {
      // setLoading(false); // This should be handled by the hook or util
    }
  }, [updateTaskLog, clearTaskLog, setUploadStatuses]);

  const handleUploadSplitFilesToS3 = useCallback(async () => {
    clearTaskLog("uploadAndScript");
    // setLoading(true); // This should be handled by the hook or util
    const splitS3UploadLogId = "split-s3-upload-status";
    // setSplitMessage("Uploading split files to S3"); // This should be handled by the hook
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
        finalMessage = `S3 split files upload completed: ${successfulFilesCount} Successful and ${failedFilesCount} Failed`;
      } else if (successfulFilesCount > 0) {
        finalMessage = `S3 split files upload completed successfully. Total files uploaded: ${successfulFilesCount}.`;
      } else {
        finalMessage = resMessage || "No split files found to upload.";
      }

      // setSplitMessage(finalMessage); // This should be handled by the hook
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
      // setSplitMessage(errorMessage); // This should be handled by the hook
      updateTaskLog("uploadAndScript", {
        id: splitS3UploadLogId,
        message: errorMessage,
        status: "failed",
      });
    } finally {
      // setLoading(false); // This should be handled by the hook or util
    }
  }, [updateTaskLog, clearTaskLog, setUploadStatuses]);


  return (
    <div>
      <UploadProcessorUI
        selectedFile={selectedFile}
        uploadMessage={uploadMessage}
        loading={loading}
        isUploading={isUploading}
        handleFileChange={handleFileChange}
        handleUpload={handleUpload}
        handleFallback={handleFallback}
      />
      <SplitProcessorUI
        loading={loading}
        splitMessage={splitMessage}
        handleSplitFiles={handleSplitFiles}
        handleSplitFilesWithMuPDF={handleSplitFilesWithMuPDF}
        selectedFile={selectedFile}
        setSelectedFile={setSelectedFile}
        splitFiles={splitFiles}
      />

    </div>
  );
};

export default UploadAndScriptTask;
