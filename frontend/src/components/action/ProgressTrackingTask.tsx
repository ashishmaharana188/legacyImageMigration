import React from "react";
import { LogEntry } from "../../types/index";
import ProgressTrackingUI from "../ui/ProgressTrackingUI";

interface ProgressTrackingTaskProps {
  taskLogs: { [key: string]: LogEntry[] };
  taskName: string;
}

const ProgressTrackingTask: React.FC<ProgressTrackingTaskProps> = ({
  taskLogs,
  taskName,
}) => {
  const currentLogs = taskLogs[taskName] || [];

  // 1. Upload Progress Logic
  const uploadLog = currentLogs.find((log) => log.id === "LIVE_EXCEL_PROGRESS");
  if (uploadLog && taskName === "uploadAndScript") {
    return (
      <ProgressTrackingUI
        title="File Transfer Details"
        progress={uploadLog.progress || 0}
        total={uploadLog.totalRows || 0}
        processed={uploadLog.processedRows || 0}
        successful={uploadLog.successfulRows || 0}
        errors={uploadLog.errors || 0}
        notFound={uploadLog.notFound || 0}
        displayType="aggregate"
        unit="rows"
      />
    );
  }

  // 2. Split Progress Logic
  const splitLog = currentLogs.find((log) => log.id === "LIVE_SPLIT_PROGRESS");
  if (splitLog && taskName === "splitFiles") {
    return (
      <ProgressTrackingUI
        title="PDF Split Progress"
        progress={splitLog.progress || 0}
        total={splitLog.totalRows || 0}
        processed={splitLog.processedRows || 0}
        successful={splitLog.successfulRows || 0}
        errors={splitLog.errors || 0}
        displayType="aggregate"
        unit="files"
      />
    );
  }

  return null;
};

export default ProgressTrackingTask;
