import {
  UploadStatus,
  FileResponse,
  FileResponseSummary,
} from "./uploadProcessorType";

type UpdateTaskLogFunction = (task: string, log: unknown) => void;

const LOG_KEY = "excel_processing";

export const logUploadStart = (
  updateTaskLog: (task: string, log: any) => void,
  operationName: string,
  logId: string
) => {
  updateTaskLog("uploadAndScript", {
    id: logId,
    message: `${operationName}...`,
    status: "in-progress",
    totalRows: 0,
    successfulRows: 0,
    badRows: 0,
    progress: 0,
    processedFiles: 0,
    notFoundFiles: 0,
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

  // FIX: Combine actual errors AND missing files into "Failed" count
  const badRows = (summary?.errors || 0) + (summary?.notFound || 0);

  const finalMessage =
    badRows > 0
      ? `${operationName} completed with ${badRows} issues.`
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
    const filtered = prev.filter((s) => s.fileName !== LOG_KEY);
    return [
      ...filtered,
      {
        fileName: LOG_KEY,
        status:
          finalStatus === "in-progress"
            ? "Uploading"
            : finalStatus === "success"
            ? "Done"
            : "Failed",
        progress: finalStatus === "success" ? 100 : 0,
        totalFiles: summary?.totalRows,
        processedFiles:
          (summary?.successfulRows || 0) +
          (summary?.errors || 0) +
          (summary?.notFound || 0),
        successfulFiles: summary?.successfulRows,
        errorFiles: summary?.errors,
        notFoundFiles: summary?.notFound,
        errorMessage,
      },
    ];
  });
};
