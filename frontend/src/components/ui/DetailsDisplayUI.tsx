import React, { useState } from "react";
// 1. Upload Logic
import {
  UploadProcessDisplay,
  BadRowsDetailsTable,
} from "../../api/uploadProcessor/uploadProcessorSummaryUI";

// 2. Split Logic
import { SplitProcessDisplay } from "../../api/splitProcessor/splitProcessorSummaryUI";

import SanityCheckSummaryDisplay from "../../api/dataClean/sanityCheckSummaryUI";
import { LogEntry } from "../../types/index";

interface DetailsDisplayUIProps {
  log: LogEntry;
  logKey: string;
  expandedLogId: string | null;
  parsedBadRows: any[] | null;
  toggleBadRowsDisplay: (filePath: string, logId: string) => void;
}

const DetailsDisplayUI: React.FC<DetailsDisplayUIProps> = ({
  log,
  logKey,
  expandedLogId,
  parsedBadRows,
  toggleBadRowsDisplay,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleExpansion = () => {
    setIsExpanded(!isExpanded);
  };

  const renderContent = () => {
    if (typeof log === "string") return <div>{log}</div>;

    // --- CASE 1: EXCEL UPLOAD & ITERATIVE TRANSFER ---
    // Combined checks for the fileName used by the sidebar and the ID used by the task log
    if (
      (log.fileName === "excel_processing" || log.id === "upload-status") &&
      log.totalRows !== undefined
    ) {
      return (
        <UploadProcessDisplay
          title={`Excel File Transfer Progress`}
          progress={log.progress}
          total={log.totalRows}
          // Fallback to calculated processed count if the specific field isn't in the log
          processed={
            log.processedFiles ?? (log.successfulRows || 0) + (log.badRows || 0)
          }
          successful={log.successfulRows}
          errors={log.badRows || 0}
          notFound={log.notFoundFiles || 0}
          unit="rows"
        />
      );
    }

    // --- CASE 2: SPLIT PROCESSOR ---
    else if (log.splitSummary) {
      const total = log.splitSummary.totalExpectedPagesFromCsv || 0;
      const success = log.splitSummary.totalSplitFilesGenerated || 0;
      const errors = log.splitSummary.splitErrors || 0;
      const progress =
        total > 0 ? (success / total) * 100 : success > 0 ? 100 : 0;

      return (
        <SplitProcessDisplay
          title="PDF Split Progress"
          progress={progress}
          total={total}
          successful={success}
          errors={errors}
        />
      );
    }

    // --- CASE 3: FINAL EXECUTION SUMMARY ---
    // This handles the state once log.status becomes 'success' or 'failed'
    else if (log.successfulRows !== undefined && log.totalRows !== undefined) {
      return (
        <div className="border-l-4 border-black pl-3 py-1">
          <h5 className="font-bold text-sm mb-1">Execution Summary:</h5>
          <div className="grid grid-cols-1 gap-0.5 text-sm">
            <p>
              <span className="font-semibold">Total:</span> {log.totalRows}
            </p>
            <p className="text-green-700">
              <span className="font-semibold">Successful:</span>{" "}
              {log.successfulRows}
            </p>
            <p className="text-red-600">
              <span className="font-semibold">Failed:</span> {log.badRows ?? 0}
            </p>
          </div>

          {log.badRowsFilePath && (log.badRows || 0) > 0 && (
            <>
              <button
                onClick={() =>
                  toggleBadRowsDisplay(log.badRowsFilePath!, logKey)
                }
                className="mt-2 px-3 py-1 text-xs font-medium text-white bg-black rounded hover:bg-gray-800 transition-colors"
              >
                {expandedLogId === logKey
                  ? "Hide Error Details"
                  : "Show Error Details"}
              </button>
              {expandedLogId === logKey && parsedBadRows && (
                <BadRowsDetailsTable parsedBadRows={parsedBadRows} />
              )}
            </>
          )}
        </div>
      );
    }

    // --- CASE 4: SANITY CHECKS ---
    else if (
      log.dryRun !== undefined ||
      (log.duplicates && Array.isArray(log.duplicates))
    ) {
      return <SanityCheckSummaryDisplay log={log} logKey={logKey} />;
    }

    // --- CASE 5: STANDARD MESSAGE (FALLBACK) ---
    else if (log.message) {
      const isPending = log.status === "in-progress";
      const statusColor =
        log.status === "success"
          ? "text-green-600"
          : log.status === "failed"
          ? "text-red-600"
          : "text-black";

      return (
        <div
          className={`${statusColor} font-bold text-base flex items-center gap-2`}
        >
          {log.message}
          {isPending && <span className="animate-pulse">...</span>}
        </div>
      );
    }

    return (
      <div className="text-xs text-gray-400 font-mono p-2 bg-gray-50 rounded">
        {JSON.stringify(log, null, 2)}
      </div>
    );
  };

  return <div className="py-1">{renderContent()}</div>;
};

export default DetailsDisplayUI;
