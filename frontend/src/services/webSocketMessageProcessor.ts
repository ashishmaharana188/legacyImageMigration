import { S3UploadProgress, UploadStatus } from "../types";
import { TaskLogContextType } from "../types/index";

export type WebSocketMessage =
  | { type: "s3-upload-total-directories"; totalDirectories: number }
  | {
      type: "s3-directory-progress";
      completedDirectories: number;
      totalDirectories: number;
      currentDirectory: string;
    }
  | {
      type: "excelProcessingUpdate" | "excelProcessingComplete";
      totalRows?: number;
      processedRows?: number;
      successfulRows?: number;
      errors?: number;
      notFound?: number;
      status?: string;
    }
  | {
      type: "splitProgressUpdate" | "splitProgressComplete";
      taskKey: "splitFiles";
      totalSplitFilesGenerated: number;
      splitErrors: number;
      totalExpectedPagesFromCsv: number;
      status: string;
    };

interface WebSocketMessageProcessorProps {
  updateTaskLog: TaskLogContextType["updateTaskLog"];
  setUploadStatuses: TaskLogContextType["setUploadStatuses"];
  setS3UploadProgress: React.Dispatch<React.SetStateAction<S3UploadProgress>>;
  setIsConnected: React.Dispatch<React.SetStateAction<boolean>>;
  progressAccumulator: React.MutableRefObject<S3UploadProgress>;
}

export const createWebSocketMessageProcessor = ({
  updateTaskLog,
  setUploadStatuses,
  progressAccumulator,
}: WebSocketMessageProcessorProps) => {
  const processMessage = (message: WebSocketMessage) => {
    // 1. S3 Logic
    if (message.type === "s3-upload-total-directories") {
      progressAccumulator.current.totalDirectories = message.totalDirectories;
    } else if (message.type === "s3-directory-progress") {
      progressAccumulator.current.processedDirectories =
        message.completedDirectories;
      progressAccumulator.current.totalDirectories = message.totalDirectories;
      progressAccumulator.current.currentDirectory = message.currentDirectory;
    }

    // 2. Excel Upload & Transfer Logic (Throttled Iterative Updates)
    else if (
      message.type === "excelProcessingUpdate" ||
      message.type === "excelProcessingComplete"
    ) {
      setUploadStatuses((prev) => {
        const fileName = "excel_processing";
        const idx = prev.findIndex((s) => s.fileName === fileName);
        const total = message.totalRows || 0;
        const current = message.processedRows || 0;
        const progress = total > 0 ? Math.round((current / total) * 100) : 0;

        const status: UploadStatus = {
          fileName,
          progress,
          status:
            message.type === "excelProcessingComplete"
              ? "Complete"
              : message.status || "Processing",
          totalFiles: total,
          processedFiles: current,
          successfulFiles: message.successfulRows || 0,
          errorFiles: message.errors || 0,
          notFoundFiles: message.notFound || 0,
        };

        if (idx > -1) {
          const next = [...prev];
          next[idx] = { ...next[idx], ...status };
          return next;
        }
        return [...prev, status];
      });
    }

    // 3. Split Processor Logic
    else if (
      message.type === "splitProgressUpdate" ||
      message.type === "splitProgressComplete"
    ) {
      const taskKey = message.taskKey;

      setUploadStatuses((prev) => {
        const fileName = "splitting_progress";
        const idx = prev.findIndex((s) => s.fileName === fileName);
        const total = message.totalExpectedPagesFromCsv || 0;
        const current = message.totalSplitFilesGenerated || 0;
        const progress = total > 0 ? Math.round((current / total) * 100) : 0;

        const status: UploadStatus = {
          fileName,
          progress,
          status:
            message.type === "splitProgressComplete" ? "Done" : "Splitting",
          totalFiles: total,
          processedFiles: current + (message.splitErrors || 0),
          successfulFiles: current,
          errorFiles: message.splitErrors,
        };

        if (idx > -1) {
          const next = [...prev];
          next[idx] = { ...next[idx], ...status };
          return next;
        }
        return [...prev, status];
      });

      updateTaskLog(taskKey, {
        id: "splitting-live-summary",
        message: message.status,
        status:
          message.type === "splitProgressComplete" ? "success" : "in-progress",
        totalRows: message.totalExpectedPagesFromCsv,
        successfulRows: message.totalSplitFilesGenerated,
        badRows: message.splitErrors,
        splitSummary: {
          totalExpectedPagesFromCsv: message.totalExpectedPagesFromCsv,
          totalSplitFilesGenerated: message.totalSplitFilesGenerated,
          splitErrors: message.splitErrors,
        },
      });
    }
  };

  return { processMessage };
};
