import React from "react";
import { LogEntry } from "../../types/index";

interface DetailsDisplayUIProps {
  log: LogEntry;
  logKey: string;
  expandedLogId?: string | null;
  parsedBadRows?: any[] | null;
  toggleBadRowsDisplay?: (filePath: string, logId: string) => void;
}

const DetailsDisplayUI: React.FC<DetailsDisplayUIProps> = ({ log }) => {
  // [MODULARITY] If this is the progress tracking object, don't render it here.
  // The ProgressTrackingTask already handles this in its own component.
  if (log.id === "LIVE_EXCEL_PROGRESS") return null;

  const renderContent = () => {
    if (typeof log === "string") return <div>{log}</div>;

    // Render standard status messages
    if (log.message) {
      const isError = log.status === "failed" || log.status === "error";
      return (
        <div
          className={`${
            isError ? "text-red-600" : "text-slate-700"
          } text-sm font-medium`}
        >
          {log.message}
          {log.status === "in-progress" && "..."}
        </div>
      );
    }

    return (
      <pre className="text-[10px] text-slate-400 bg-slate-50 p-2 rounded">
        {JSON.stringify(log, null, 2)}
      </pre>
    );
  };

  return (
    <div className="py-1 border-b border-slate-50 last:border-0">
      {renderContent()}
    </div>
  );
};

export default DetailsDisplayUI;
