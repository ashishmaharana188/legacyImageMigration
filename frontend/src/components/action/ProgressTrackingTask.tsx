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
  const liveLog = currentLogs.find((log) => log.id === "upload-status");

  // [DEBUG] Diagnosing the failure to render
  if (taskName === "uploadAndScript" && !liveLog) {
    // console.warn("[DEBUG-UI] 'upload-status' log NOT FOUND in taskLogs['uploadAndScript']");
  }

  if (liveLog) {
    // [FIX] Force number conversion to handle JSON string values
    const total = Number(liveLog.totalRows || 0);
    const success = Number(liveLog.successfulRows || 0);
    const errors = Number(liveLog.badRows || 0);
    const notFound = Number(liveLog.notFoundFiles || 0);

    if (total > 0) {
      const processed = success + errors;
      const progress = Math.round((processed / total) * 100);

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
