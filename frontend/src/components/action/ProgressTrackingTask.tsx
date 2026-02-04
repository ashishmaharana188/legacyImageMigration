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

  // ... (Existing handlers for uploadAndScript, splitFiles, s3Upload unchanged) ...
  if (taskName === "uploadAndScript") {
    const uploadLog = currentLogs.find(
      (log) => log.id === "LIVE_EXCEL_PROGRESS"
    );
    if (uploadLog) {
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
  }

  if (taskName === "splitFiles") {
    const splitLog = currentLogs.find(
      (log) => log.id === "LIVE_SPLIT_PROGRESS"
    );
    if (splitLog) {
      return (
        <ProgressTrackingUI
          title="PDF Split Progress"
          progress={splitLog.progress}
          total={splitLog.totalRows}
          processed={splitLog.processedRows}
          successful={splitLog.successfulRows}
          errors={splitLog.errors}
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
          {activeLogs.map((log) => (
            <ProgressTrackingUI
              key={log.id}
              title={
                log.id === "LIVE_SQL_PROGRESS"
                  ? "SQL Execution Progress"
                  : "Mongo Sync Progress"
              }
              progress={log.progress}
              total={log.totalRows}
              processed={log.processedRows}
              successful={log.successfulRows}
              errors={log.errors}
              displayType="simple"
              unit="records"
              detailedMetrics={log.metrics}
            />
          ))}
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

  // [FIX] Sanity Check Handler with Fallback
  if (taskName === "pgSanityCheck" || taskName === "mongoSanityCheck") {
    // 1. Try to find the LIVE log (from WebSocket)
    let sanityLog = currentLogs
      .slice()
      .reverse()
      .find((log) => log.id === "LIVE_SANITY_PROGRESS");

    // 2. Fallback: If no LIVE ID, take the latest log (Legacy/HTTP response)
    if (!sanityLog && currentLogs.length > 0) {
      sanityLog = currentLogs[currentLogs.length - 1];
    }

    if (sanityLog) {
      // [FIX] Calculate fallback metrics if the standard 'metrics' object is missing
      let finalMetrics = sanityLog.metrics || {};

      // If Mongo and duplicates is missing, try to derive it from old fields
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
          metrics={finalMetrics}
          unit="duplicates"
        />
      );
    }
  }

  return null;
};

export default ProgressTrackingTask;
