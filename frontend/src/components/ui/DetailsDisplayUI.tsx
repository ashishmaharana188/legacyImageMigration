import React from "react";
// Ensure these imports match your structure
import { UploadProcessDisplay } from "../../api/uploadProcessor/uploadProcessorSummaryUI";
import { SplitProcessDisplay } from "../../api/splitProcessor/splitProcessorSummaryUI";
import { LogEntry } from "../../types/index";

interface DetailsDisplayUIProps {
  log: LogEntry;
  logKey: string;
  expandedLogId?: string | null;
  parsedBadRows?: any[] | null;
  toggleBadRowsDisplay?: (filePath: string, logId: string) => void;
}

const DetailsDisplayUI: React.FC<DetailsDisplayUIProps> = ({ log }) => {
  const renderContent = () => {
    if (typeof log === "string") return <div>{log}</div>;

    // TARGET: The live upload log
    if (log.id === "upload-status" || log.fileName === "excel_processing") {
      const total = log.totalRows || 0;
      const success = log.successfulRows || 0;
      const errors = log.badRows || 0;
      const notFound = log.notFoundFiles || 0;
      const processed = success + errors;
      const progress = total > 0 ? Math.round((processed / total) * 100) : 0;

      return (
        <UploadProcessDisplay
          title="File Transfer Details" // Look for this title in the list
          progress={progress}
          total={total}
          processed={processed}
          successful={success}
          errors={errors}
          notFound={notFound}
          unit="rows"
        />
      );
    }

    // TARGET: Split processor logs
    if (log.splitSummary) {
      const total = log.splitSummary.totalExpectedPagesFromCsv || 0;
      const success = log.splitSummary.totalSplitFilesGenerated || 0;
      const progress = total > 0 ? (success / total) * 100 : 0;
      return (
        <SplitProcessDisplay
          title="PDF Split Progress"
          progress={progress}
          total={total}
          successful={success}
          errors={log.splitSummary.splitErrors || 0}
        />
      );
    }

    // TARGET: Standard messages
    if (log.message) {
      const statusColor =
        log.status === "success"
          ? "text-green-600"
          : log.status === "failed"
          ? "text-red-600"
          : "text-black";
      return (
        <div className={`${statusColor} font-bold text-base`}>
          {log.message}
          {log.status === "in-progress" && "..."}
        </div>
      );
    }

    return (
      <pre className="text-xs text-gray-400">
        {JSON.stringify(log, null, 2)}
      </pre>
    );
  };

  return <div className="py-1">{renderContent()}</div>;
};

export default DetailsDisplayUI;
