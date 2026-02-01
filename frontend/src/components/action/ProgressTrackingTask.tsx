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

  // [CONSOLIDATED] Look for the unique ID we standardized in the processor
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

  // Handle Split Progress similarly if needed
  const splitLog = currentLogs.find((log) => log.splitSummary);
  if (splitLog && splitLog.splitSummary) {
    const total = Number(splitLog.splitSummary.totalExpectedPagesFromCsv || 0);
    const success = Number(splitLog.splitSummary.totalSplitFilesGenerated || 0);
    const progress = total > 0 ? (success / total) * 100 : 0;

    return (
      <ProgressTrackingUI
        title="PDF Split Progress"
        progress={progress}
        total={total}
        successful={success}
        errors={splitLog.splitSummary.splitErrors || 0}
        displayType="aggregate"
        unit="pages"
      />
    );
  }

  return null;
};

export default ProgressTrackingTask;
