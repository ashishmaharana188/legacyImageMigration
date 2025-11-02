import { UploadStatus, SplitFileResponse } from "./splitProcessorType";

type UpdateTaskLogFunction = (task: string, log: unknown) => void;
type ClearTaskLogFunction = (task: string) => void;

export const logSplitStart = (
  updateTaskLog: UpdateTaskLogFunction,
  operationName: string,
  logId: string
) => {
  updateTaskLog("splitFiles", {
    id: logId,
    message: `${operationName}...`,
    status: "in-progress",
  });
};

export const logSplitSuccess = (
  updateTaskLog: UpdateTaskLogFunction,
  operationName: string,
  logId: string,
  resData: SplitFileResponse
) => {
  const message = resData.message || `${operationName} successful`;
  updateTaskLog("splitFiles", {
    id: logId,
    message: message,
    status: "success",
    ...resData,
  });
};

export const logSplitFailure = (
  updateTaskLog: UpdateTaskLogFunction,
  operationName: string,
  logId: string,
  errorMessage: string
) => {
  updateTaskLog("splitFiles", {
    id: logId,
    message: `${operationName} failed: ${errorMessage}`,
    status: "failed",
  });
};

export const clearSplitLogs = (clearTaskLog: ClearTaskLogFunction) => {
  clearTaskLog("splitFiles");
};

export const updateSplitStatuses = (
  setUploadStatuses: React.Dispatch<React.SetStateAction<UploadStatus[]>>,
  finalStatus: "success" | "failed" | "in-progress",
  errorMessage?: string
) => {
  if (setUploadStatuses) {
    setUploadStatuses((prev) => {
      const newStatuses = prev.filter(
        (s) => s.fileName !== "splitting_progress"
      );

      if (finalStatus === "in-progress") {
        newStatuses.push({
          fileName: "splitting_progress",
          status: "Starting",
          progress: 0,
        });
      } else if (finalStatus === "success") {
        newStatuses.push({
          fileName: "splitting_progress",
          status: "Done",
          progress: 100,
        });
      } else {
        newStatuses.push({
          fileName: "splitting_progress",
          status: "Failed",
          progress: 0,
          errorMessage: errorMessage,
        });
      }
      return newStatuses;
    });
  }
};
