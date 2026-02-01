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
      // 1. Excel Migration
      case "excelProcessingUpdate":
        updateTaskLog("uploadAndScript", {
          id: "LIVE_EXCEL_PROGRESS",
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

      // 2. [NEW] Split Processor Updates
      case "splitProgressUpdate":
      case "splitProgressComplete":
        const totalExpected = data.totalExpectedPagesFromCsv || 0;
        const generated = data.totalSplitFilesGenerated || 0;
        const progress =
          totalExpected > 0 ? Math.round((generated / totalExpected) * 100) : 0;

        updateTaskLog("splitFiles", {
          id: "LIVE_SPLIT_PROGRESS", // Consolidated ID for Split
          status: data.status || "Processing",
          totalRows: totalExpected, // Mapping "Pages" to "Total" for the UI
          processedRows: generated,
          successfulRows: generated,
          errors: data.splitErrors || 0,
          progress: progress,
          message: data.message || `Generated ${generated} files...`,
        });
        break;

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

      case "sanityCheckUpdate":
        updateTaskLog("sanityCheck", {
          id: "sanityCheck",
          status: "Running",
          message: data.message,
          progress: data.progress,
          duplicates: data.duplicates,
        });
        break;

      case "s3UploadProgress":
        if (data.payload) {
          const { processedDirectories, totalDirectories, currentDirectory } =
            data.payload;
          progressAccumulator.current = {
            processedDirectories,
            totalDirectories,
            currentDirectory,
          };
          setS3UploadProgress({
            processedDirectories,
            totalDirectories,
            currentDirectory,
          });
        }
        break;

      case "welcome":
        setIsConnected(true);
        break;

      default:
        break;
    }
  };

  return { processMessage };
};
