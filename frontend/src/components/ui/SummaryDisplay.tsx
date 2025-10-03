import React, { useState, useEffect } from "react";
import ProgressTrackingTask from "../action/ProgressTrackingTask";
import DetailsDisplayTask from "../action/DetailsDisplayTask";

interface UploadStatus {
  fileName: string;
  progress?: number;
  status?: string;
  isDirectory?: boolean;
  totalFiles?: number;
  processedFiles?: number;
  successfulFiles?: number;
  errorFiles?: number;
  notFoundFiles?: number;
  badRowsDetails?: Array<{
    rowNumber: number;
    id_fund: string;
    id_trtype: string;
    id_ihno: string;
    id_path: string;
    id_acno: string;
    page_count_status: string | number;
  }>;
}

interface SummaryDisplayProps {
  taskLogs: { [key: string]: any[] };
  uploadStatuses: UploadStatus[];
  onClearLogs: (taskKey: string) => void;
}

const SummaryDisplay: React.FC<SummaryDisplayProps> = ({
  taskLogs,
  uploadStatuses,
  onClearLogs,
}) => {
  const [allTaskLogs, setAllTaskLogs] = useState<{ [key: string]: any[] }>({});

  const getLogIdentifier = (log: any): string => {
    if (typeof log === "string") return log;
    if (log.splitSummary) return "splitSummary";
    if (log.originalFile) return `file-upload-${log.originalFile}`;
    if (log.dryRun !== undefined) return "sanity-check-duplicates";
    if (log.successfulRows !== undefined) return "sql-execution-summary";
    if (log.transferredCount !== undefined) return "mongodb-transfer-summary";
    if (log.updatedFolioRows !== undefined)
      return "folio-transaction-update-summary";
    if (log.updatedDocuments) return "mongo-update-summary";
    if (log.duplicates) return "mongo-duplicate-check-summary";
    if (log.message) return log.message;
    return JSON.stringify(log);
  };

  useEffect(() => {
    setAllTaskLogs((prevLogs) => {
      const newLogs = { ...prevLogs };
      let hasChanges = false;
      for (const taskKey in taskLogs) {
        if (taskLogs[taskKey].length === 0) {
          if (newLogs[taskKey] && newLogs[taskKey].length > 0) {
            newLogs[taskKey] = [];
            hasChanges = true;
          }
          continue;
        }

        const existingLogs = new Map(
          newLogs[taskKey]?.map((log) => [getLogIdentifier(log), log]) || []
        );
        taskLogs[taskKey].forEach((log) => {
          const id = getLogIdentifier(log);
          if (
            !existingLogs.has(id) ||
            JSON.stringify(existingLogs.get(id)) !== JSON.stringify(log)
          ) {
            existingLogs.set(id, log);
            hasChanges = true;
          }
        });

        if (hasChanges) {
          newLogs[taskKey] = Array.from(existingLogs.values());
        }
      }
      return hasChanges ? newLogs : prevLogs;
    });
  }, [taskLogs]);

  return (
    <div className="mt-4 text-black h-full flex flex-col">
      <h3 className="text-lg font-semibold mb-1">Task Logs</h3>
      <div className="bg-gray-200 p-2 rounded flex-1 overflow-y-auto min-h-30">
        {Object.entries(allTaskLogs).map(([task, logsArray]) => (
          <div key={task} className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold capitalize">{task}</h4>
              <button
                onClick={() => onClearLogs(task)}
                className="ml-2 px-3 py-1 text-sm font-medium text-white bg-gray-600 rounded-md hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2"
              >
                Clear Logs
              </button>
            </div>
            <div className="bg-gray-100 p-2 rounded">
              {task === "uploadAndScript" && (
                <ProgressTrackingTask
                  uploadStatuses={uploadStatuses}
                  taskLogs={allTaskLogs}
                />
              )}
              {logsArray.map((logItem: any) => (
                <div key={getLogIdentifier(logItem)} className="mb-2 last:mb-0">
                  {typeof logItem === "string" ? (
                    <p>{logItem}</p>
                  ) : (
                    <DetailsDisplayTask
                      log={logItem}
                      logKey={getLogIdentifier(logItem)}
                    />
                  )}
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
