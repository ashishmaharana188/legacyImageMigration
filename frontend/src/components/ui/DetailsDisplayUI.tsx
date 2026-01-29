import React, { useState } from "react";
// 1. Upload Logic
import {
  UploadProcessDisplay,
  BadRowsDetailsTable,
} from "../../api/uploadProcessor/uploadProcessorSummaryUI";

// 2. Split Logic (Crucial Fix: Import the Named Export)
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

    // --- CASE 1: EXCEL UPLOAD ---
    if (
      log.fileName === "excel_upload_progress" &&
      log.totalFiles !== undefined
    ) {
      return (
        <UploadProcessDisplay
          title={`Upload Progress for Excel File`}
          progress={log.progress}
          total={log.totalFiles}
          processed={log.processedFiles}
          successful={log.successfulFiles}
          errors={log.errorFiles || 0}
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

      // This now uses the correct, dedicated Split component
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

    // --- CASE 3: GENERIC EXECUTION ---
    else if (log.successfulRows !== undefined) {
      return (
        <div>
          <h5 className="font-semibold">Execution Summary:</h5>
          <p>Total: {log.totalRows ?? "N/A"}</p>
          <p>Successful: {log.successfulRows ?? "N/A"}</p>
          <p>Failed: {log.badRows ?? "N/A"}</p>

          {log.badRowsFilePath && (log.badRows || 0) > 0 && (
            <>
              <button
                onClick={() =>
                  toggleBadRowsDisplay(log.badRowsFilePath!, logKey)
                }
                className="mt-2 px-3 py-1 text-sm font-medium text-white bg-black rounded-md hover:bg-gray-700"
              >
                {expandedLogId === logKey ? "Hide Bad Rows" : "Show Bad Rows"}
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

    // --- CASE 5: STANDARD MESSAGE ---
    else if (log.message) {
      const statusText =
        log.status && log.status !== "in-progress" ? ` (${log.status})` : "";
      const statusColor =
        log.status === "success"
          ? "text-green-600"
          : log.status === "failed"
          ? "text-red-600"
          : "text-black";
      return (
        <div className={`${statusColor} font-bold text-lg`}>
          {log.message}
          {statusText}
        </div>
      );
    }

    return <pre>{JSON.stringify(log, null, 2)}</pre>;
  };

  return <div>{renderContent()}</div>;
};

export default DetailsDisplayUI;
