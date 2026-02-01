import React from "react";
import { useTaskLog } from "../../contexts/TaskLogContext";
import ProgressTrackingUI from "../ui/ProgressTrackingUI";
import DetailsDisplayTask from "../action/DetailsDisplayTask";

export const SummaryDisplay: React.FC = () => {
  const { taskLogs, activeProgress, onClearLogs } = useTaskLog();

  return (
    <div className="flex flex-col h-full bg-slate-50 font-sans text-slate-900 border-l border-slate-200">
      <div className="p-4 bg-white border-b border-slate-200 shadow-sm flex items-center justify-between">
        <h3 className="text-lg font-bold tracking-tight uppercase">
          Task Logs
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {Object.entries(taskLogs).length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 py-20 italic text-sm">
            No active processes found.
          </div>
        )}

        {Object.entries(taskLogs).map(([taskKey, logsArray]) => (
          <section
            key={taskKey}
            className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col"
          >
            <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex items-center justify-between">
              <h4 className="font-bold uppercase text-[10px] tracking-widest text-slate-500">
                {taskKey === "uploadAndScript"
                  ? "Excel Migration"
                  : taskKey === "splitFiles"
                  ? "Split Processor"
                  : taskKey}
              </h4>
              <button
                onClick={() => onClearLogs(taskKey)}
                className="text-[10px] font-bold text-rose-500 hover:text-rose-700 uppercase"
              >
                Clear
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* [UPDATED] Render Progress Bar for BOTH Upload AND Split */}
              {(taskKey === "uploadAndScript" || taskKey === "splitFiles") &&
                activeProgress.total > 0 && (
                  <div className="p-4 rounded-lg bg-slate-50 border border-slate-100 shadow-inner">
                    <ProgressTrackingUI
                      title={
                        taskKey === "splitFiles"
                          ? "PDF Splitting Status"
                          : "Row Processing Status"
                      }
                      progress={activeProgress.percent}
                      total={activeProgress.total}
                      processed={
                        activeProgress.success + activeProgress.failure
                      }
                      successful={activeProgress.success}
                      errors={activeProgress.failure}
                      notFound={0}
                      displayType="aggregate"
                      unit={taskKey === "splitFiles" ? "files" : "rows"}
                    />
                  </div>
                )}

              <div className="space-y-2 mt-4 max-h-64 overflow-y-auto">
                {logsArray.map(
                  (logItem, index) =>
                    // Hide internal progress logs
                    logItem.id !== "LIVE_EXCEL_PROGRESS" &&
                    logItem.id !== "LIVE_SPLIT_PROGRESS" && (
                      <DetailsDisplayTask
                        key={logItem.id || index}
                        log={logItem}
                        logKey={taskKey}
                      />
                    )
                )}
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
};

export default SummaryDisplay;
