import React from "react";
import { useTaskLog } from "../../contexts/TaskLogContext";
import ProgressTrackingTask from "../action/ProgressTrackingTask";
// [REMOVED] import DetailsDisplayTask...

export const SummaryDisplay: React.FC = () => {
  const { taskLogs, onClearLogs } = useTaskLog();

  const getTitle = (key: string) => {
    switch (key) {
      case "uploadAndScript":
        return "Excel Migration";
      case "splitFiles":
        return "Split Processor";
      case "imageDataTransfer":
        return "Image Data Transfer";
      case "s3Upload":
        return "S3 Upload";
      case "sanityCheck":
        return "Sanity Check";
      default:
        return key;
    }
  };

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

        {Object.entries(taskLogs).map(([taskKey, _logsArray]) => (
          <section
            key={taskKey}
            className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col"
          >
            <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex items-center justify-between">
              <h4 className="font-bold uppercase text-[10px] tracking-widest text-slate-500">
                {getTitle(taskKey)}
              </h4>
              <button
                onClick={() => onClearLogs(taskKey)}
                className="text-[10px] font-bold text-black hover:text-white hover:drop-shadow-[0_1.2px_1.2px_rgba(0,0,0,0.8)] uppercase"
              >
                Clear
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Only Progress Bars remain */}
              <ProgressTrackingTask taskLogs={taskLogs} taskName={taskKey} />

              {/* [REMOVED] Details/History List */}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
};

export default SummaryDisplay;
