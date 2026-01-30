import React from "react";
// Adjust these imports to match your folder structure exactly
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
  // [FIX] No more local state or useEffects. We render exactly what we receive.

  // Helper to ensure unique keys for React rendering
  const getLogIdentifier = (log: LogEntry, index: number): string => {
    if (log.id) return log.id;
    if (log.splitSummary) return "split-summary-card";
    if (log.message) return `${log.message}-${index}`;
    return `log-${index}`;
  };

  return (
    <div className="mt-4 text-black h-full flex flex-col font-sans">
      <h3 className="text-lg font-semibold mb-1">Task Logs</h3>

      <div className="bg-gray-200 p-2 rounded flex-1 overflow-y-auto min-h-30 shadow-inner">
        {Object.entries(taskLogs).map(([task, logsArray]) => (
          <div key={task} className="mb-4">
            {/* Header: Task Name & Clear Button */}
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
              {/* 1. The Summary Bar (Aggregated View) */}
              {(task === "uploadAndScript" || task === "splitFiles") && (
                <ProgressTrackingTask
                  uploadStatuses={uploadStatuses}
                  taskLogs={taskLogs} // Pass the raw context data
                  taskName={task}
                />
              )}

              {/* 2. The Detailed List */}
              {task !== "splitFiles" &&
                logsArray.map((logItem, index) => (
                  <div
                    key={getLogIdentifier(logItem, index)}
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
