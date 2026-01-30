import { FileResponseSummary } from "./uploadProcessorType";

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
  restData: any
) => {
  updateTaskLog("uploadAndScript", {
    id: logId,
    message: "Completed Successfully",
    status: "success",
    totalRows: summary?.totalRows,
    successfulRows: summary?.successfulRows,
    badRows: (summary?.errors || 0) + (summary?.notFound || 0),
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
    message: `Failed: ${errorMessage}`,
    status: "failed",
  });
};
