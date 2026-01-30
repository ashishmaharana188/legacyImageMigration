import {
  TaskLogContextType,
  UploadStatus,
  S3UploadProgress,
} from "../types/index";

// Define the expected props interface strictly
interface WebSocketProcessorProps {
  updateTaskLog: TaskLogContextType["updateTaskLog"];
  setUploadStatuses: TaskLogContextType["setUploadStatuses"];
  setS3UploadProgress?: React.Dispatch<React.SetStateAction<S3UploadProgress>>;
  setIsConnected?: React.Dispatch<React.SetStateAction<boolean>>;
  progressAccumulator?: React.MutableRefObject<S3UploadProgress>;
}

export interface WebSocketMessage {
  type: string;
  totalRows?: number;
  processedRows?: number;
  successfulRows?: number;
  errors?: number;
  notFound?: number;
  status?: string;
  processedDirectories?: number;
  totalDirectories?: number;
  currentDirectory?: string;
  [key: string]: any;
}

export const createWebSocketMessageProcessor = ({
  updateTaskLog,
  setUploadStatuses,
  setS3UploadProgress,
  setIsConnected,
  progressAccumulator,
}: WebSocketProcessorProps) => {
  return {
    processMessage: (message: WebSocketMessage) => {
      // 1. EXCEL UPLOAD LOGIC
      if (
        message.type === "excelProcessingUpdate" ||
        message.type === "excelProcessingComplete"
      ) {
        const isComplete = message.type === "excelProcessingComplete";
        const total = message.totalRows || 0;
        const current = message.processedRows || 0;
        const progress = total > 0 ? Math.round((current / total) * 100) : 0;

        // Update Sidebar/Status list
        setUploadStatuses((prev: UploadStatus[]) => {
          const others = prev.filter((s) => s.fileName !== "excel_processing");
          return [
            ...others,
            {
              fileName: "excel_processing",
              progress,
              status: isComplete ? "Done" : "Processing",
              totalFiles: total,
              processedFiles: current,
              successfulFiles: message.successfulRows,
              errorFiles: message.errors,
              notFoundFiles: message.notFound,
            },
          ];
        });

        // Update the Context Log which the SummaryDisplay reads
        updateTaskLog("uploadAndScript", {
          id: "upload-status", // MUST match the ID in ProgressTrackingTask.tsx
          message: isComplete ? "Processing Complete" : "Transferring Files...",
          status: isComplete ? "success" : "in-progress",
          totalRows: total,
          successfulRows: message.successfulRows || 0,
          badRows: (message.errors || 0) + (message.notFound || 0), // Aggregate bad rows
          notFoundFiles: message.notFound || 0,
          progress,
          processedFiles: current,
        });
      }

      // 2. S3 UPLOAD LOGIC
      if (
        message.type === "s3UploadProgress" &&
        setS3UploadProgress &&
        progressAccumulator
      ) {
        progressAccumulator.current = {
          processedDirectories: message.processedDirectories || 0,
          totalDirectories: message.totalDirectories || 0,
          currentDirectory: message.currentDirectory || "",
        };
      }

      // 3. CONNECTION STATUS LOGIC
      if (message.type === "connectionStatus" && setIsConnected) {
        setIsConnected(message.status === "connected");
      }
    },
  };
};
