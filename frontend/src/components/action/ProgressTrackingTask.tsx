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
  const currentLogs = taskLogs[taskName] || [];

  // Find the exact log the backend is sending
  const liveLog = currentLogs.find((log) => log.id === "upload-status");

  if (liveLog) {
    // Force convert to numbers to prevent any string/JSON issues
    const total = Number(liveLog.totalRows || 0);
    const success = Number(liveLog.successfulRows || 0);
    const errors = Number(liveLog.badRows || 0);
    const notFound = Number(liveLog.notFoundFiles || 0);
    const processed = success + errors;

    if (total > 0) {
      // Calculate progress
      const progress = Math.round((processed / total) * 100);

      // [DEBUG] If you see this, the bar IS rendering on screen
      if (processed % 5 === 0) {
        // Log occasionally to avoid spam
        console.log(`[UI-RENDER] ${progress}% - ${processed}/${total}`);
      }

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
  }

  return null;
};

export default ProgressTrackingTask;
