import React from "react";
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
  // [DEBUG] Check if this component is even receiving data
  const uploadLogs = taskLogs["uploadAndScript"];
  if (uploadLogs) {
    const live = uploadLogs.find((l) => l.id === "upload-status");
    if (live) console.log("[DEBUG-SUMMARY] Rendering with Live Data:", live);
  }

  return (
    <div className="mt-4 text-black h-full flex flex-col font-sans">
      <h3 className="text-lg font-semibold mb-1">Task Logs</h3>
      <div className="bg-gray-200 p-2 rounded flex-1 overflow-y-auto min-h-30 shadow-inner">
        {Object.entries(taskLogs).map(([task, logsArray]) => (
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
              {/* Force Render Progress Bar */}
              <ProgressTrackingTask
                uploadStatuses={uploadStatuses}
                taskLogs={taskLogs}
                taskName={task}
              />

              {task !== "splitFiles" &&
                logsArray.map((logItem, index) => (
                  <div
                    key={logItem.id || `log-${index}`}
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
