export const createWebSocketMessageProcessor = ({
  updateTaskLog,
  setUploadStatuses,
}: any) => {
  return {
    processMessage: (message: any) => {
      if (
        message.type === "excelProcessingUpdate" ||
        message.type === "excelProcessingComplete"
      ) {
        const total = message.totalRows || 0;
        const current = message.processedRows || 0;
        const progress = total > 0 ? Math.round((current / total) * 100) : 0;

        // Update the Sidebar Bar
        setUploadStatuses((prev: any[]) => {
          const filtered = prev.filter(
            (s) => s.fileName !== "excel_processing"
          );
          return [
            ...filtered,
            {
              fileName: "excel_processing",
              progress,
              status:
                message.type === "excelProcessingComplete"
                  ? "Done"
                  : "Processing",
              totalFiles: total,
              processedFiles: current,
              successfulFiles: message.successfulRows,
              errorFiles: message.errors,
              notFoundFiles: message.notFound,
            },
          ];
        });

        // Update the Execution Summary Log
        updateTaskLog("uploadAndScript", {
          id: "upload-status",
          message: "Transferring Files...",
          status: "in-progress",
          totalRows: total,
          successfulRows: message.successfulRows,
          badRows: (message.errors || 0) + (message.notFound || 0),
          progress,
          processedFiles: current,
          notFoundFiles: message.notFound,
        });
      }
    },
  };
};
