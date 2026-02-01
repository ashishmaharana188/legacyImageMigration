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
        progress={uploadLog.progress}
        total={uploadLog.totalRows}
        processed={uploadLog.processedRows}
        successful={uploadLog.successfulRows}
        errors={uploadLog.errors}
        notFound={uploadLog.notFound}
        displayType="aggregate"
        unit="rows"
      />
    );
  }

  // 2. [FIX] Split Progress Logic (Aligned with WebSocket ID)
  const splitLog = currentLogs.find((log) => log.id === "LIVE_SPLIT_PROGRESS");
  if (splitLog && taskName === "splitFiles") {
    return (
      <ProgressTrackingUI
        title="PDF Split Progress"
        progress={splitLog.progress}
        total={splitLog.totalRows} // Maps to 'totalExpectedPagesFromCsv'
        processed={splitLog.processedRows} // Maps to 'totalSplitFilesGenerated'
        successful={splitLog.successfulRows}
        errors={splitLog.errors}
        displayType="aggregate"
        unit="files"
      />
    );
  }

  return null;
};

export default ProgressTrackingTask;
