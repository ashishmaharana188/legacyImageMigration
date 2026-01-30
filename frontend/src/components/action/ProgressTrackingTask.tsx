import React from "react";
import { UploadStatus, LogEntry } from "../../types/index";
import ProgressTrackingUI from "../ui/ProgressTrackingUI";

interface ProgressTrackingTaskProps {
  uploadStatuses: UploadStatus[];
  taskLogs: { [key: string]: LogEntry[] };
  taskName: string;
}

const ProgressTrackingTask: React.FC<ProgressTrackingTaskProps> = ({
  taskLogs,
  taskName,
}) => {
  // 1. Get logs for THIS task (generic)
  const currentLogs = taskLogs[taskName] || [];

  // 2. DETECT: Is there an Excel-style progress log?
  const uploadLog = currentLogs.find((log) => log.id === "upload-status");

  // 3. DETECT: Is there a Split-style progress log?
  const splitLog = currentLogs.find((log) => log.splitSummary);

  // --- RENDER EXCEL PROGRESS ---
  if (uploadLog) {
    const total = Number(uploadLog.totalRows || 0);
    const success = Number(uploadLog.successfulRows || 0);
    const errors = Number(uploadLog.badRows || 0);
    const notFound = Number(uploadLog.notFoundFiles || 0);

    if (total > 0) {
      const processed = success + errors;
      const progress = Math.round((processed / total) * 100);

      return (
        <ProgressTrackingUI
          title="Excel File Transfer Progress"
          progress={progress}
          total={total}
          processed={processed}
          successful={success}
          errors={errors}
          notFound={notFound}
          displayType="aggregate"
          unit="rows"
        />
      );
    }
  }

  // --- RENDER SPLIT PROGRESS ---
  if (splitLog && splitLog.splitSummary) {
    const total = Number(splitLog.splitSummary.totalExpectedPagesFromCsv || 0);
    const success = Number(splitLog.splitSummary.totalSplitFilesGenerated || 0);
    const errors = Number(splitLog.splitSummary.splitErrors || 0);

    if (total > 0) {
      const currentProcessed = success + errors;
      const progress = Math.round((currentProcessed / total) * 100);

      return (
        <ProgressTrackingUI
          title="PDF Split Progress"
          progress={progress}
          total={total}
          processed={currentProcessed}
          successful={success}
          errors={errors}
          displayType="aggregate"
          unit="pages"
        />
      );
    }
  }

  return null;
};

export default ProgressTrackingTask;
