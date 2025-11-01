import { UploadStatus, FileResponse, FileResponseSummary } from "./uploadProcessorType";

type UpdateTaskLogFunction = (task: string, log: unknown) => void;
type ClearTaskLogFunction = (task: string) => void;

export const logUploadStart = (
  updateTaskLog: UpdateTaskLogFunction,
  operationName: string,
  logId: string
) => {
  updateTaskLog("uploadFiles", {
    id: logId,
    message: `${operationName}...`,
    status: "in-progress",
  });
};

export const logUploadSuccess = (
  updateTaskLog: UpdateTaskLogFunction,
  operationName: string,
  logId: string,
  summary: FileResponseSummary | undefined,
  restData: Omit<FileResponse, 'summary'>
) => {
  const totalRows = summary?.totalRows || 0;
  const successfulRows = summary?.successfulRows || 0;
  const badRows = summary?.errors || 0;

  let finalMessage = `${operationName} successful`;
  let finalStatus: "success" | "failed" | "in-progress" = "success";

  if (badRows > 0) {
    finalMessage = `${operationName} completed: ${successfulRows} Successful, ${badRows} Failed out of ${totalRows} rows.`;
    finalStatus = "failed";
  } else if (totalRows > 0) {
    finalMessage = `${operationName} successful. Total rows: ${totalRows}, Successful: ${successfulRows}.`;
  } else {
    finalMessage = `No rows processed during ${operationName}.`;
  }

  updateTaskLog("uploadFiles", {
    id: logId,
    message: finalMessage,
    status: finalStatus,
    totalRows: totalRows,
    successfulRows: successfulRows,
    badRows: badRows,
    ...restData,
  });
};

export const logUploadFailure = (
  updateTaskLog: UpdateTaskLogFunction,
  operationName: string,
  logId: string,
  errorMessage: string
) => {
  updateTaskLog("uploadFiles", {
    id: logId,
    message: `${operationName} failed: ${errorMessage}`,
    status: "failed",
  });
};

export const clearUploadLogs = (clearTaskLog: ClearTaskLogFunction) => {
  clearTaskLog("uploadFiles");
};

export const updateUploadStatuses = (
  setUploadStatuses: React.Dispatch<React.SetStateAction<UploadStatus[]>>,
  finalStatus: "success" | "failed" | "in-progress",
  summary: FileResponseSummary | undefined,
  errorMessage?: string
) => {
  if (setUploadStatuses) {
    setUploadStatuses((prev) => {
      const newStatuses = prev.filter(
        (s) => s.fileName !== "excel_upload_progress"
      );

      if (finalStatus === "in-progress") {
        newStatuses.push({
          fileName: "excel_upload_progress",
          status: "Uploading",
          progress: 0,
          isDirectory: false,
        });
      } else {
        const totalRows = summary?.totalRows || 0;
        const successfulRows = summary?.successfulRows || 0;
        const badRows = summary?.errors || 0;

        newStatuses.push({
          fileName: "excel_upload_progress",
          status: finalStatus === "success" ? "Done" : "Failed",
          progress: (successfulRows / totalRows) * 100 || 0,
          totalFiles: totalRows,
          processedFiles: successfulRows + badRows,
          successfulFiles: successfulRows,
          errorFiles: badRows,
          notFoundFiles: summary?.notFound || 0,
          errorMessage: errorMessage,
        });
      }
      return newStatuses;
    });
  }
};
