import React from "react";
import ProgressTrackingUI from "../ui/ProgressTrackingUI";
import { LogEntry } from "../../types";

interface ProgressTrackingTaskProps {
  taskLogs: { [key: string]: LogEntry[] };
  taskName: string;
}

const ProgressTrackingTask: React.FC<ProgressTrackingTaskProps> = ({
  taskLogs,
  taskName,
}) => {
  const currentLogs = taskLogs[taskName] || [];

  if (taskName === "uploadAndScript") {
    // Check for the specific Live ID used by WebSocket or the main status log
    const uploadLog = currentLogs.find(
      (log) => log.id === "LIVE_EXCEL_PROGRESS"
    );

    if (taskName === "uploadAndScript" && uploadLog) {
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
  }

  if (taskName === "splitFiles") {
    const splitLog = currentLogs.find(
      (log) =>
        log.id === "LIVE_SPLIT_PROGRESS" || log.type === "splitProgressUpdate"
    );

    if (splitLog) {
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
  }

  // =========================================================
  // 3. RESTORED: Image Data Transfer Logic (Simple View)
  // =========================================================
  if (taskName === "imageDataTransfer") {
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
                key={log.id}
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

  if (taskName === "s3Upload") {
    // Filter for the live progress log
    const s3Log = currentLogs.find((log) => log.id === "LIVE_S3_PROGRESS");

    if (s3Log) {
      return (
        <ProgressTrackingUI
          key={s3Log.id}
          displayType="sidebar" // Explicitly request the sidebar look
          label={s3Log.message || "Uploading to S3..."}
          status={s3Log.status || "Processing"}
          progress={s3Log.progress || 0}
          details={`${s3Log.processedRows || 0} / ${s3Log.total || 0} folders`}
        />
      );
    }
  }

  return null;
};

export default ProgressTrackingTask;
