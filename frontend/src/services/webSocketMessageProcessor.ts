import { UploadStatus, LogEntry, S3UploadProgress } from "../types";
import React from "react";

export interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

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
  const processMessage = (data: WebSocketMessage) => {
    if (!data || !data.type) return;

    switch (data.type) {
      case "welcome":
        setIsConnected(true);
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

      case "splitProgressUpdate":
      case "splitProgressComplete":
        const totalExpected = data.totalExpectedPagesFromCsv || 0;
        const generated = data.totalSplitFilesGenerated || 0;
        const progress =
          totalExpected > 0 ? Math.round((generated / totalExpected) * 100) : 0;

        updateTaskLog("splitFiles", {
          id: "LIVE_SPLIT_PROGRESS",
          status: data.status || "Processing",
          totalRows: totalExpected,
          processedRows: generated,
          successfulRows: generated,
          errors: data.splitErrors || 0,
          progress: progress,
          message: data.message || `Generated ${generated} files...`,
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

      // [FIX] SQL & Mongo Updates (Uses new fields defined in Types)
      case "sqlProgressUpdate":
      case "mongoProgressUpdate": {
        const isSql = data.type === "sqlProgressUpdate";
        const liveId = isSql ? "LIVE_SQL_PROGRESS" : "LIVE_MONGO_PROGRESS";
        const metrics = data.metrics || {};

        // 1. Update the Live Progress Bar
        updateTaskLog("imageDataTransfer", {
          id: liveId,
          status: data.status,
          totalRows: data.total,
          processedRows: data.processed,
          progress:
            data.total > 0
              ? Math.round((data.processed / data.total) * 100)
              : 0,
          message:
            data.message ||
            (data.status === "Completed"
              ? "Task Completed"
              : `Processing... ${data.processed}/${data.total}`),
          subTask: data.subTask,
        });

        // 2. If Completed, create a PERMANENT log entry for history
        if (data.status === "Completed") {
          const historyId = `${data.subTask}_DONE_${Date.now()}`;
          const summaryMsg = isSql
            ? `SQL Task (${data.subTask}) Completed.`
            : `Mongo Task (${data.subTask}) Completed.`;

          updateTaskLog("imageDataTransfer", {
            id: historyId,
            status: "Success",
            message: summaryMsg,
            timestamp: new Date().toISOString(),
            metrics: metrics,
            subTask: data.subTask,
            totalRows: data.total,
            successfulRows:
              (metrics.inserted || 0) +
              (metrics.updated || 0) +
              (metrics.synced || 0),
            errors: metrics.failed || 0,
          });
        }

        // 3. If Error, create a permanent error log
        if (data.status === "Error") {
          updateTaskLog("imageDataTransfer", {
            id: `${data.subTask}_ERR_${Date.now()}`,
            status: "Error",
            message: data.message || "Unknown Error occurred",
            timestamp: new Date().toISOString(),
            subTask: data.subTask,
          });
        }
        break;
      }
    }
  };

  return { processMessage };
};
