import React, { useState, useEffect } from "react";
// Adjust paths based on your file location: frontend/src/api/Global/
import { UploadStatus, LogEntry } from "../../types/index";
import ProgressTrackingTask from "../../components/action/ProgressTrackingTask";
import DetailsDisplayTask from "../../components/action/DetailsDisplayTask";

export interface SummaryDisplayProps {
  taskLogs: { [key: string]: LogEntry[] };
  uploadStatuses: UploadStatus[];
  onClearLogs: (taskKey: string) => void;
}

export const SummaryDisplay: React.FC<SummaryDisplayProps> = ({
  taskLogs,
  uploadStatuses,
  onClearLogs,
}) => {
  const [allTaskLogs, setAllTaskLogs] = useState<{ [key: string]: LogEntry[] }>(
    {}
  );

  const getLogIdentifier = (log: LogEntry): string => {
    if (log.id) return log.id;
    // Stable ID for split summary ensures we don't get duplicates if they slip through
    if (log.splitSummary) return "split-summary-card";
    if (log.message) return `${log.message}-${log.timestamp || Date.now()}`;
    return JSON.stringify(log);
  };

  useEffect(() => {
    setAllTaskLogs((prevLogs) => {
      const newLogs = { ...prevLogs };
      let hasChanges = false;

      for (const taskKey in newLogs) {
        if (!(taskKey in taskLogs)) {
          delete newLogs[taskKey];
          hasChanges = true;
        }
      }

      for (const taskKey in taskLogs) {
        if (taskLogs[taskKey].length === 0) {
          if (newLogs[taskKey] && newLogs[taskKey].length > 0) {
            newLogs[taskKey] = [];
            hasChanges = true;
          }
          continue;
        }

        const existingLogs = new Map(
          newLogs[taskKey]?.map((log) => [getLogIdentifier(log), log]) || []
        );

        taskLogs[taskKey].forEach((log) => {
          const id = getLogIdentifier(log);
          if (
            !existingLogs.has(id) ||
            JSON.stringify(existingLogs.get(id)) !== JSON.stringify(log)
          ) {
            existingLogs.set(id, log);
            hasChanges = true;
          }
        });

        if (hasChanges) {
          newLogs[taskKey] = Array.from(existingLogs.values());
        }
      }
      return hasChanges ? newLogs : prevLogs;
    });
  }, [taskLogs]);

  return (
    <div className="mt-4 text-black h-full flex flex-col font-sans">
      <h3 className="text-lg font-semibold mb-1">Task Logs</h3>
      <div className="bg-gray-200 p-2 rounded flex-1 overflow-y-auto min-h-30 shadow-inner">
        {Object.entries(allTaskLogs).map(([task, logsArray]) => (
          <div key={task} className="mb-4">
            <div className="flex items-center justify-between mb-2 px-1">
              <h4 className="font-bold uppercase text-xs text-gray-600">
                {task === "splitFiles" ? "Split Processor" : task}
              </h4>
              <button
                onClick={() => onClearLogs(task)}
                className="text-xs text-red-600 font-semibold hover:underline"
              >
                Clear
              </button>
            </div>
            <div className="bg-white p-3 rounded shadow-sm border border-gray-300">
              {/* 1. The Summary Bar (Aggregated View) - ALWAYS SHOW THIS */}
              {/* The Summary Bar */}
              {(task === "uploadAndScript" || task === "splitFiles") && (
                <ProgressTrackingTask
                  uploadStatuses={uploadStatuses}
                  taskLogs={allTaskLogs}
                  taskName={task} // <--- FIX: PASS THE ID HERE
                />
              )}

              {/* 2. The Detailed List - HIDE THIS for Split Files */}
              {/* This prevents the "Duplicate Tabs" issue. We only want the summary bar above. */}
              {task !== "splitFiles" &&
                logsArray.map((logItem) => (
                  <div
                    key={getLogIdentifier(logItem)}
                    className="mb-2 last:mb-0 border-t pt-2 first:border-0 first:pt-0"
                  >
                    <DetailsDisplayTask log={logItem} logKey={task} />
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SummaryDisplay;
