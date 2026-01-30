import React from "react";
import { UploadStatus, LogEntry } from "../../types/index";
import ProgressTrackingUI from "../ui/ProgressTrackingUI";

interface ProgressTrackingTaskProps {
  uploadStatuses: UploadStatus[];
  taskLogs: { [key: string]: LogEntry[] };
  taskName: string;
}

const ProgressTrackingTask: React.FC<ProgressTrackingTaskProps> = ({
  uploadStatuses,
  taskLogs,
  taskName,
}) => {
  // 1. Get the logs specifically for this task (e.g., "uploadAndScript")
  const currentLogs = taskLogs[taskName] || [];

  // 2. PRIORITY CHECK: Look for the specific 'upload-status' ID
  // This is the exact ID your WebSocket and Backend are updating.
  const liveLog = currentLogs.find((log) => log.id === "upload-status");

  // 3. If we find that log and it has data, RENDER IT immediately.
  if (
    liveLog &&
    typeof liveLog.totalRows === "number" &&
    liveLog.totalRows > 0
  ) {
    const total = liveLog.totalRows;
    const success = liveLog.successfulRows || 0;
    const errors = liveLog.badRows || 0;
    const notFound = liveLog.notFoundFiles || 0;

    // We calculate processed as the sum of outcomes to ensure sync
    const processed = success + errors;

    // Calculate percentage, guarding against divide-by-zero
    const progress = total > 0 ? Math.round((processed / total) * 100) : 0;

    return (
      <ProgressTrackingUI
        title="Excel Processing Progress"
        progress={progress}
        total={total}
        processed={processed}
        successful={success}
        errors={errors} // This combines 'errors' + 'notFound' usually, or separate if UI supports it
        notFound={notFound}
        displayType="aggregate"
        unit="rows"
      />
    );
  }

  // 4. SECONDARY CHECK: Split Processor Logic (for PDF splitting task)
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

  // 5. Default: If no relevant logs found, render nothing to keep UI clean
  return null;
};

export default ProgressTrackingTask;
