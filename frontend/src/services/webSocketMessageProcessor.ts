import { TaskLogContextType, UploadStatus } from "../types/index";

export const createWebSocketMessageProcessor = ({
  updateTaskLog,
  setUploadStatuses,
}: any) => {
  const processMessage = (message: any) => {
    if (
      message.type === "excelProcessingUpdate" ||
      message.type === "excelProcessingComplete"
    ) {
      const isComplete = message.type === "excelProcessingComplete";
      const total = message.totalRows || 0;
      const current = message.processedRows || 0;
      const progress = total > 0 ? Math.round((current / total) * 100) : 0;

      // Update Sidebar Bar
      setUploadStatuses((prev: UploadStatus[]) => {
        const others = prev.filter((s) => s.fileName !== "excel_processing");
        return [
          ...others,
          {
            fileName: "excel_processing",
            progress,
            status: isComplete ? "Complete" : "Processing...",
            totalFiles: total,
            processedFiles: current,
            successfulFiles: message.successfulRows || 0,
            errorFiles: message.errors || 0,
            notFoundFiles: message.notFound || 0,
          },
        ];
      });

      // Update Live Execution Summary
      updateTaskLog("uploadAndScript", {
        id: "upload-status", // MUST MATCH uploadProcessorUtil.tsx
        message: isComplete ? "Processing Complete" : "Transferring Files...",
        status: isComplete ? "success" : "in-progress",
        totalRows: total,
        successfulRows: message.successfulRows || 0,
        badRows: (message.errors || 0) + (message.notFound || 0),
      });
    }
  };
  return { processMessage };
};
