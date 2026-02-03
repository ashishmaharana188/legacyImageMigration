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
  const logs = taskLogs[taskName] || [];

  // [FIX] Strict Filter to prevent "Double Bars"
  // We ONLY want to show the canonical "Live" progress bars.
  // We filter OUT all "History" or "Event" logs (e.g., UP_ORIG_START..., _DONE_, _ERR_)
  const progressLogs = logs.filter((log) => {
    return (
      log.id.startsWith("LIVE_") || // Matches LIVE_S3_PROGRESS, LIVE_SQL_PROGRESS, etc.
      log.id === "sanityCheck" // Matches the specific Sanity Check ID
    );
  });

  if (progressLogs.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {progressLogs.map((log) => (
        <ProgressTrackingUI
          key={log.id}
          // Map 'label' to display subTask name or generic message
          label={log.subTask || log.message || "Processing..."}
          // Map 'status' (e.g., 'Processing', 'Success')
          status={log.status || "Pending"}
          // Map 'details' string
          details={
            log.totalRows
              ? `${(
                  log.processedRows || 0
                ).toLocaleString()} / ${log.totalRows.toLocaleString()}`
              : log.message
          }
          // Pass numeric progress for the bar
          progress={log.progress || 0}
          // Pass metrics if available (for SQL/Mongo)
          metrics={log.metrics}
        />
      ))}
    </div>
  );
};

export default ProgressTrackingTask;
