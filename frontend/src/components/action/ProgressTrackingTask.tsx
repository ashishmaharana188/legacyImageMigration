import React from "react";
import { UploadStatus, LogEntry } from "../../types/index";
import ProgressTrackingUI from "../ui/ProgressTrackingUI";

// [FIX] Correct interface for the logic component
interface ProgressTrackingTaskProps {
  uploadStatuses: UploadStatus[]; // Kept in interface for compatibility, but ignored in logic
  taskLogs: { [key: string]: LogEntry[] };
  taskName: string;
}

const ProgressTrackingTask: React.FC<ProgressTrackingTaskProps> = ({
  // [FIX] Removed 'uploadStatuses' from here to silence the "unused variable" warning
  taskLogs,
  taskName,
}) => {
  const currentLogs = taskLogs[taskName] || [];

  // 1. Find the exact log entry the WebSocket is updating
  const liveLog = currentLogs.find((log) => log.id === "upload-status");

  // 2. Render from LOG data (Context)
  if (
    liveLog &&
    typeof liveLog.totalRows === "number" &&
    liveLog.totalRows > 0
  ) {
    const total = liveLog.totalRows;
    const success = liveLog.successfulRows || 0;
    const errors = liveLog.badRows || 0;
    const notFound = liveLog.notFoundFiles || 0;
    const processed = success + errors;
    const progress = total > 0 ? Math.round((processed / total) * 100) : 0;

    // [FIX] Passes props that MATCH ProgressTrackingUIProps (title, etc.)
    return (
      <ProgressTrackingUI
        title="Excel Processing Progress"
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

  // 3. Fallback for Split Processor
  if (taskName === "splitFiles") {
    const splitLog = currentLogs.find((l) => l.splitSummary);
    if (splitLog && splitLog.splitSummary) {
      const total = splitLog.splitSummary.totalExpectedPagesFromCsv || 0;
      const success = splitLog.splitSummary.totalSplitFilesGenerated || 0;
      const errors = splitLog.splitSummary.splitErrors || 0;
      const currentProcessed = success + errors;
      const progress =
        total > 0 ? Math.round((currentProcessed / total) * 100) : 0;

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
