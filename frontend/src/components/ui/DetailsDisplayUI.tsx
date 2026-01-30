import React, { useState } from "react";
import {
  UploadProcessDisplay,
  BadRowsDetailsTable,
} from "../../api/uploadProcessor/uploadProcessorSummaryUI";
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
  const renderContent = () => {
    if (typeof log === "string") return <div>{log}</div>;

    // Force progress view for the upload-status ID
    if (log.id === "upload-status" || log.fileName === "excel_processing") {
      return (
        <UploadProcessDisplay
          title="Excel File Transfer Progress"
          progress={log.progress || 0}
          total={log.totalRows || 0}
          processed={
            log.processedFiles || (log.successfulRows || 0) + (log.badRows || 0)
          }
          successful={log.successfulRows || 0}
          errors={log.badRows || 0}
          notFound={log.notFoundFiles || 0}
          unit="rows"
        />
      );
    } else if (log.splitSummary) {
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
    } else if (
      log.successfulRows !== undefined &&
      log.totalRows !== undefined
    ) {
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
            <button
              onClick={() => toggleBadRowsDisplay(log.badRowsFilePath!, logKey)}
              className="mt-2 px-3 py-1 text-xs font-medium text-white bg-black rounded hover:bg-gray-800 transition-colors"
            >
              {expandedLogId === logKey
                ? "Hide Error Details"
                : "Show Error Details"}
            </button>
          )}
          {expandedLogId === logKey && parsedBadRows && (
            <BadRowsDetailsTable parsedBadRows={parsedBadRows} />
          )}
        </div>
      );
    } else if (log.message) {
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
