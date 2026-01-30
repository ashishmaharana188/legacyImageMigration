import React from "react";
// Import from the new unified context file
import { useTaskLog } from "../../contexts/TaskLogContext";
import ProgressTrackingUI from "../ui/ProgressTrackingUI";
import DetailsDisplayTask from "../action/DetailsDisplayTask";

export const SummaryDisplay: React.FC = () => {
  // Access the Interval State (activeProgress)
  const { taskLogs, activeProgress, onClearLogs } = useTaskLog();

  return (
    <div className="mt-4 text-black h-full flex flex-col font-sans">
      <h3 className="text-lg font-semibold mb-1">Task Logs</h3>
      <div className="bg-gray-200 p-2 rounded flex-1 overflow-y-auto min-h-30 shadow-inner">
        {/* Render Interval Updates */}
        {activeProgress.total > 0 && (
          <div className="mb-4 bg-white p-3 rounded shadow-sm border border-gray-300">
            <h4 className="font-bold uppercase text-xs text-gray-600 mb-2">
              Live Upload
            </h4>
            <ProgressTrackingUI
              title="Transfer Progress"
              progress={activeProgress.percent}
              total={activeProgress.total}
              processed={activeProgress.success + activeProgress.failure}
              successful={activeProgress.success}
              errors={activeProgress.failure}
              notFound={0}
              displayType="aggregate"
              unit="rows"
            />
          </div>
        )}

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
              {logsArray.map(
                (logItem, index) =>
                  // Filter out redundant status cards from the history list
                  logItem.id !== "upload-status" && (
                    <div
                      key={logItem.id || `log-${index}`}
                      className="mb-2 last:mb-0 border-t pt-2 first:border-0 first:pt-0"
                    >
                      <DetailsDisplayTask log={logItem} logKey={task} />
                    </div>
                  )
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SummaryDisplay;
