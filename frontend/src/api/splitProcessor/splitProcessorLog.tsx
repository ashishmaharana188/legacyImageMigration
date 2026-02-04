import { UploadStatus, SplitFileResponse } from "./splitProcessorType";

type UpdateTaskLogFunction = (task: string, log: any) => void;
type ClearTaskLogFunction = (task: string) => void;

// STRICT TASK KEY: Matches SummaryDisplay
const TASK_KEY = "splitFiles";

export const logSplitStart = (
  updateTaskLog: UpdateTaskLogFunction,
  operationName: string,
  logId: string
) => {
  updateTaskLog(TASK_KEY, {
    id: logId,
    message: `${operationName} initiated...`,
    status: "in-progress",
  });
};

export const logSplitSuccess = (
  updateTaskLog: UpdateTaskLogFunction,
  operationName: string,
  logId: string,
  resData: SplitFileResponse
) => {
  // 1. Get the summary object (checking both possible keys)
  const summary = resData.splitSummary ||
    resData.summary || {
      totalExpectedPagesFromCsv: 0,
      totalSplitFilesGenerated: 0,
      splitErrors: 0,
    };

  updateTaskLog(TASK_KEY, {
    id: logId,
    message: resData.message || `${operationName} complete`,
    status: summary.splitErrors > 0 ? "failed" : "success",

    // 2. MAP TO SIDEBAR KEYS
    // DetailsDisplayTask looks for these exact keys:
    totalRows: summary.totalExpectedPagesFromCsv, // Mapped from totalExpected
    successfulRows: summary.totalSplitFilesGenerated, // Mapped from generated
    badRows: summary.splitErrors, // Mapped from errors

    splitSummary: summary,
    ...resData,
  });
};

export const logSplitFailure = (
  updateTaskLog: UpdateTaskLogFunction,
  operationName: string,
  logId: string,
  errorMessage: string
) => {
  updateTaskLog(TASK_KEY, {
    id: logId,
    message: `${operationName} failed: ${errorMessage}`,
    status: "failed",
  });
};

export const clearSplitLogs = (clearTaskLog: ClearTaskLogFunction) => {
  clearTaskLog(TASK_KEY);
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
      newStatuses.push({
        fileName: "splitting_progress",
        status:
          finalStatus === "in-progress"
            ? "Splitting..."
            : finalStatus === "success"
            ? "Done"
            : "Failed",
        progress: finalStatus === "success" ? 100 : 0,
        errorMessage: errorMessage,
      });
      return newStatuses;
    });
  }
};
