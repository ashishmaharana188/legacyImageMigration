import { TaskLogContextType, UploadStatus } from "../types/index";

// Add this to webSocketMessageProcessor.ts or types/index.ts
export interface WebSocketMessage {
  type: string;
  totalRows?: number;
  processedRows?: number;
  successfulRows?: number;
  errors?: number;
  notFound?: number;
  status?: string;
  [key: string]: any;
}

export const createWebSocketMessageProcessor = ({
  updateTaskLog,
  setUploadStatuses,
}: {
  updateTaskLog: TaskLogContextType["updateTaskLog"];
  setUploadStatuses: TaskLogContextType["setUploadStatuses"];
}) => {
  return {
    processMessage: (message: any) => {
      // --- DEBUGGING BLOCK ---
      if (message.type === "excelProcessingUpdate") {
        console.log("[DEBUG-FRONTEND-WS] Update Received:", message);
      }
      // ---------------------

      if (
        message.type === "excelProcessingUpdate" ||
        message.type === "excelProcessingComplete"
      ) {
        const isComplete = message.type === "excelProcessingComplete";
        const total = message.totalRows || 0;
        const current = message.processedRows || 0;
        const progress = total > 0 ? Math.round((current / total) * 100) : 0;

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

        // This calls the Context Updater
        updateTaskLog("uploadAndScript", {
          id: "upload-status",
          message: isComplete ? "Processing Complete" : "Transferring Files...",
          status: isComplete ? "success" : "in-progress",
          totalRows: total,
          successfulRows: message.successfulRows || 0,
          badRows: (message.errors || 0) + (message.notFound || 0),
          progress,
          processedFiles: current,
          notFoundFiles: message.notFound || 0,
        });
      }
    },
  };
};
