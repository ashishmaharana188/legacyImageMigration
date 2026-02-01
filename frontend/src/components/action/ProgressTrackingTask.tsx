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

  // 3. Image Data Transfer Logic (SQL/Mongo)
  if (taskName === "imageDataTransfer") {
    // [FIX] Use filter instead of find to capture ALL active tasks (SQL and/or Mongo)
    const activeLogs = currentLogs.filter(
      (log) =>
        log.id === "LIVE_SQL_PROGRESS" || log.id === "LIVE_MONGO_PROGRESS"
    );

    if (activeLogs.length > 0) {
      return (
        <div className="flex flex-col gap-4">
          {activeLogs.map((log) => {
            const isSql = log.id === "LIVE_SQL_PROGRESS";
            const metrics = log.metrics || {};

            return (
              <ProgressTrackingUI
                key={log.id} // [FIX] Unique key ensures React renders both
                title={isSql ? "SQL Execution Progress" : "Mongo Sync Progress"}
                progress={log.progress || 0}
                total={log.totalRows || 0}
                processed={log.processedRows || 0}
                successful={log.successfulRows || 0}
                errors={log.errors || 0}
                displayType="simple"
                unit="records"
                detailedMetrics={{
                  folioUpdated: metrics.folioUpdated,
                  txnUpdated: metrics.txnUpdated,
                  inserted: metrics.inserted,
                }}
              />
            );
          })}
        </div>
      );
    }
  }

  return null;
};

export default ProgressTrackingTask;
