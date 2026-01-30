import {
  TaskLogContextType,
  UploadStatus,
  S3UploadProgress,
} from "../types/index";

// Define the expected props interface to prevent future type errors
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
  // S3 specific props
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
      // [DEBUG] Monitor incoming traffic
      if (message.type === "excelProcessingUpdate") {
        // console.log("[WS-PROCESSOR] Excel Update:", message);
      }

      // --- 1. EXCEL UPLOAD LOGIC ---
      if (
        message.type === "excelProcessingUpdate" ||
        message.type === "excelProcessingComplete"
      ) {
        const isComplete = message.type === "excelProcessingComplete";
        const total = message.totalRows || 0;
        const current = message.processedRows || 0;
        const progress = total > 0 ? Math.round((current / total) * 100) : 0;

        // Update Sidebar
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

        // Update Context Logs (Live)
        updateTaskLog("uploadAndScript", {
          id: "upload-status",
          message: isComplete ? "Processing Complete" : "Transferring Files...",
          status: isComplete ? "success" : "in-progress",
          totalRows: total,
          successfulRows: message.successfulRows || 0,
          badRows: (message.errors || 0) + (message.notFound || 0),
          notFoundFiles: message.notFound || 0,
          progress,
          processedFiles: current,
        });
      }

      // --- 2. S3 UPLOAD LOGIC (Restored) ---
      if (
        message.type === "s3UploadProgress" &&
        setS3UploadProgress &&
        progressAccumulator
      ) {
        // Update the ref to avoid state thrashing
        progressAccumulator.current = {
          processedDirectories: message.processedDirectories || 0,
          totalDirectories: message.totalDirectories || 0,
          currentDirectory: message.currentDirectory || "",
        };
        // State update happens via the Interval in WebSocketProvider
      }

      // --- 3. CONNECTION STATUS LOGIC ---
      if (message.type === "connectionStatus" && setIsConnected) {
        setIsConnected(message.status === "connected");
      }
    },
  };
};
