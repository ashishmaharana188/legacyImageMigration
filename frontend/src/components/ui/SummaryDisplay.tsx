import React, { useState, useEffect } from "react";
import { UploadStatus, LogEntry } from "../../types/index";
import ProgressTrackingTask from "../../components/action/ProgressTrackingTask";
import DetailsDisplayTask from "../../components/action/DetailsDisplayTask";

export const SummaryDisplay: React.FC<any> = ({
  taskLogs,
  uploadStatuses,
  onClearLogs,
}) => {
  const [allTaskLogs, setAllTaskLogs] = useState<{ [key: string]: LogEntry[] }>(
    {}
  );

  const getLogIdentifier = (log: LogEntry): string => {
    if (log.id) return log.id;
    if (log.splitSummary) return "split-summary-card";
    return typeof log === "string" ? log : JSON.stringify(log);
  };

  useEffect(() => {
    // We simplify this. If taskLogs changes, we sync allTaskLogs.
    setAllTaskLogs(taskLogs);
  }, [taskLogs]); // This now relies on the immutable fix in TaskLogContext

  return (
    <div className="mt-4 text-black h-full flex flex-col font-sans">
      <h3 className="text-lg font-semibold mb-1">Task Logs</h3>
      <div className="bg-gray-200 p-2 rounded flex-1 overflow-y-auto min-h-30 shadow-inner">
        {Object.entries(allTaskLogs).map(([task, logsArray]) => (
          <div key={task} className="mb-4">
            <div className="flex items-center justify-between mb-2 px-1">
              <h4 className="font-bold uppercase text-xs text-gray-600">
                {task}
              </h4>
              <button
                onClick={() => onClearLogs(task)}
                className="text-xs text-red-600"
              >
                Clear
              </button>
            </div>
            <div className="bg-white p-3 rounded shadow-sm border border-gray-300">
              <ProgressTrackingTask
                uploadStatuses={uploadStatuses}
                taskLogs={allTaskLogs}
                taskName={task}
              />
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
