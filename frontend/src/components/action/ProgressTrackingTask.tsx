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

  // --- 1. UPLOAD PROCESSOR ---
  if (taskName === "uploadAndScript") {
    const uploadLog = currentLogs.find(
      (log) => log.id === "LIVE_EXCEL_PROGRESS"
    );

    if (uploadLog) {
      return (
        <ProgressTrackingUI
          title="File Transfer Details"
          progress={uploadLog.progress || 0}
          // [FIX] Checking both totalRows and total to be safe
          total={uploadLog.totalRows || uploadLog.total || 0}
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
          // [FIX] Checking both totalRows and total
          total={splitLog.totalRows || splitLog.total || 0}
          processed={splitLog.processedRows || 0}
          successful={splitLog.successfulRows || 0}
          errors={splitLog.errors || 0}
          displayType="aggregate"
          unit="files"
        />
      );
    }
  }

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
                detailedMetrics={metrics}
              />
            );
          })}
        </div>
      );
    }
  }

  if (taskName === "s3Upload") {
    const s3Log = currentLogs.find((log) => log.id === "LIVE_S3_PROGRESS");

    if (s3Log) {
      return (
        <ProgressTrackingUI
          key={s3Log.id}
          displayType="sidebar"
          label={s3Log.message || "Uploading to S3..."}
          status={s3Log.status || "Processing"}
          progress={s3Log.progress || 0}
          details={`${s3Log.processedRows || 0} / ${s3Log.total || 0} folders`}
        />
      );
    }
  }

  if (taskName === "pgSanityCheck" || taskName === "mongoSanityCheck") {
    // 1. Try to find the LIVE log (from WebSocket)
    let sanityLog = currentLogs
      .slice()
      .reverse()
      .find((log) => log.id === "LIVE_SANITY_PROGRESS");

    // 2. Fallback: If no LIVE ID, take the latest log
    if (!sanityLog && currentLogs.length > 0) {
      sanityLog = currentLogs[currentLogs.length - 1];
    }

    if (sanityLog) {
      // Calculate fallback metrics if needed
      let finalMetrics = sanityLog.metrics || {};

      // Mongo specific fallback
      if (
        taskName === "mongoSanityCheck" &&
        finalMetrics.duplicates === undefined
      ) {
        const totalDocs = (sanityLog as any).totalDuplicateDocuments;
        const totalGroups = (sanityLog as any).totalDuplicateGroups;
        if (totalDocs !== undefined && totalGroups !== undefined) {
          finalMetrics = {
            ...finalMetrics,
            duplicates: totalDocs - totalGroups,
          };
        }
      }

      return (
        <ProgressTrackingUI
          key={sanityLog.id || "sanity-check-result"}
          displayType="simple"
          title={
            taskName === "pgSanityCheck" ? "PG Data Clean" : "Mongo Data Clean"
          }
          status={sanityLog.status}
          progress={sanityLog.progress || 100}
          total={
            sanityLog.totalDuplicates ||
            (sanityLog as any).totalDuplicatesFound ||
            0
          }
          // [CRITICAL] Pass the metrics object explicitly
          metrics={finalMetrics}
          unit="duplicates"
        />
      );
    }
  }

  return null;
};

export default ProgressTrackingTask;
