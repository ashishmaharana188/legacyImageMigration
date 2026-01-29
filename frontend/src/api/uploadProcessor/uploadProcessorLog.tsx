import {
  UploadStatus,
  FileResponse,
  FileResponseSummary,
} from "./uploadProcessorType";

type UpdateTaskLogFunction = (task: string, log: unknown) => void;

export const logUploadStart = (
  updateTaskLog: UpdateTaskLogFunction,
  operationName: string,
  logId: string
) => {
  updateTaskLog("uploadAndScript", {
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
  restData: Omit<FileResponse, "summary">
) => {
  const totalRows = summary?.totalRows || 0;
  const successfulRows = summary?.successfulRows || 0;
  const badRows = summary?.errors || 0;

  const finalMessage =
    badRows > 0
      ? `${operationName} completed with ${badRows} errors.`
      : `${operationName} successful.`;

  updateTaskLog("uploadAndScript", {
    id: logId,
    message: finalMessage,
    status: badRows > 0 ? "failed" : "success",
    totalRows,
    successfulRows,
    badRows,
    ...restData,
  });
};

export const logUploadFailure = (
  updateTaskLog: UpdateTaskLogFunction,
  operationName: string,
  logId: string,
  errorMessage: string
) => {
  updateTaskLog("uploadAndScript", {
    id: logId,
    message: `${operationName} failed: ${errorMessage}`,
    status: "failed",
  });
};

export const updateUploadStatuses = (
  setUploadStatuses: React.Dispatch<React.SetStateAction<UploadStatus[]>>,
  finalStatus: "success" | "failed" | "in-progress",
  summary: FileResponseSummary | undefined,
  errorMessage?: string
) => {
  setUploadStatuses((prev) => {
    const filtered = prev.filter((s) => s.fileName !== "excel_upload_progress");
    return [
      ...filtered,
      {
        fileName: "excel_upload_progress",
        status:
          finalStatus === "in-progress"
            ? "Uploading"
            : finalStatus === "success"
            ? "Done"
            : "Failed",
        progress: finalStatus === "success" ? 100 : 0,
        totalFiles: summary?.totalRows,
        processedFiles: (summary?.successfulRows || 0) + (summary?.errors || 0),
        successfulFiles: summary?.successfulRows,
        errorFiles: summary?.errors,
        errorMessage,
      },
    ];
  });
};
