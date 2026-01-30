import { UploadStatus, LogEntry, S3UploadProgress } from "../types";
import React from "react";

interface MessageProcessorProps {
  updateTaskLog: (taskKey: string, log: LogEntry) => void;
  setUploadStatuses: React.Dispatch<React.SetStateAction<UploadStatus[]>>;
  setS3UploadProgress: React.Dispatch<React.SetStateAction<S3UploadProgress>>;
  setIsConnected: React.Dispatch<React.SetStateAction<boolean>>;
  progressAccumulator: React.MutableRefObject<S3UploadProgress>;
}

export const createWebSocketMessageProcessor = ({
  updateTaskLog,
  setUploadStatuses,
  setS3UploadProgress,
  setIsConnected,
  progressAccumulator,
}: MessageProcessorProps) => {
  const processMessage = (data: any) => {
    if (!data || !data.type) return;

    switch (data.type) {
      // 1. [FIX] Handle Excel Progress Updates
      case "excelProcessingUpdate":
        updateTaskLog("upload-status", {
          id: "upload-status",
          status: "Processing",
          totalRows: data.totalRows,
          processedRows: data.processedRows,
          successfulRows: data.successfulRows,
          errors: data.errors,
          notFound: data.notFound,
          progress:
            data.totalRows > 0
              ? Math.round((data.processedRows / data.totalRows) * 100)
              : 0,
          message: `Processing Row ${data.processedRows} / ${data.totalRows}`,
        });
        break;

      // 2. Handle File Upload Status
      case "uploadProgress":
        setUploadStatuses((prev) => {
          const newStatus: UploadStatus = {
            fileName: data.fileName,
            progress: data.progress,
            status: "Uploading",
          };
          const index = prev.findIndex((f) => f.fileName === data.fileName);
          if (index > -1) {
            const updated = [...prev];
            updated[index] = { ...updated[index], ...newStatus };
            return updated;
          }
          return [...prev, newStatus];
        });
        break;

      // 3. Handle Sanity Check Updates
      case "sanityCheckUpdate":
        updateTaskLog("sanityCheck", {
          id: "sanityCheck",
          status: "Running",
          message: data.message,
          progress: data.progress,
          duplicates: data.duplicates,
        });
        break;

      // 4. Handle S3 Upload Progress
      case "s3UploadProgress":
        if (data.payload) {
          const { processedDirectories, totalDirectories, currentDirectory } =
            data.payload;

          // Update the accumulator ref
          progressAccumulator.current = {
            processedDirectories,
            totalDirectories,
            currentDirectory,
          };

          // Update React State
          setS3UploadProgress({
            processedDirectories,
            totalDirectories,
            currentDirectory,
          });
        }
        break;

      // 5. Connection Status
      case "welcome":
        setIsConnected(true);
        break;

      default:
        // console.warn("Unknown message type:", data.type);
        break;
    }
  };

  return { processMessage };
};
