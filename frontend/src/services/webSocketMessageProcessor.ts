import { TaskLogContextType, UploadStatus } from "../types/index";

export const createWebSocketMessageProcessor = ({
  updateTaskLog,
  setUploadStatuses,
}: {
  updateTaskLog: TaskLogContextType["updateTaskLog"];
  setUploadStatuses: TaskLogContextType["setUploadStatuses"];
}) => {
  return {
    processMessage: (message: any) => {
      if (
        message.type === "excelProcessingUpdate" ||
        message.type === "excelProcessingComplete"
      ) {
        const isComplete = message.type === "excelProcessingComplete";
        const total = message.totalRows || 0;
        const current = message.processedRows || 0;
        const progress = total > 0 ? Math.round((current / total) * 100) : 0;

        // A. Update Sidebar Progress Bar
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

        // B. Update Live Execution Summary Log
        updateTaskLog("uploadAndScript", {
          id: "upload-status", // Aligns with ID set in uploadProcessorUtil.tsx
          message: isComplete ? "Processing Complete" : "Transferring Files...",
          status: isComplete ? "success" : "in-progress",
          totalRows: total,
          successfulRows: message.successfulRows || 0,
          badRows: (message.errors || 0) + (message.notFound || 0), // Combines missing + system errors
          progress,
          processedFiles: current,
          notFoundFiles: message.notFound || 0,
        });
      }
    },
  };
};
