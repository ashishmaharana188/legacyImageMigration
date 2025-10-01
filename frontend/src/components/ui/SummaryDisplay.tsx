import React, { useState, useCallback, useEffect, useRef } from "react";
import axios from "axios";

interface UploadStatus {
  fileName: string;
  progress?: number; // This will be the calculated percentage
  status?: string;
  isDirectory?: boolean;
  totalFiles?: number; // This will map to totalRows from backend
  processedFiles?: number; // This will map to processedRows from backend
  successfulFiles?: number; // This will map to successfulRows from backend
  errorFiles?: number; // This will map to errors from backend
  notFoundFiles?: number; // This will map to notFound from backend
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
  const [parsedBadRows, setParsedBadRows] = useState<any[] | null>([]);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [expandedSplitLog, setExpandedSplitLog] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<{
    [key: string]: boolean;
  }>({});
  const [expandedDirectories, setExpandedDirectories] = useState<{
    [key: string]: boolean;
  }>({});

  // New state to accumulate all task logs
  const [allTaskLogs, setAllTaskLogs] = useState<{ [key: string]: any[] }>({});

  // Helper to generate a unique identifier for a log entry
  const getLogIdentifier = (log: any): string => {
    if (typeof log === "string") {
      return log; // For simple string messages, the message itself is the identifier
    } else if (log.splitSummary) {
      return "splitSummary"; // Only one splitSummary log per task
    } else if (log.originalFile !== undefined && log.fileUrls !== undefined) {
      return `file-upload-${log.originalFile}`; // Identify by original file name
    } else if (log.dryRun !== undefined && log.rows !== undefined) {
      return "sanity-check-duplicates"; // Only one sanity check log per task
    } else if (
      log.successfulRows !== undefined &&
      log.badRows !== undefined &&
      log.message &&
      log.message.includes("SQL executed successfully")
    ) {
      return "sql-execution-summary"; // Only one SQL execution summary per task
    } else if (
      log.transferredCount !== undefined &&
      log.documents !== undefined &&
      log.message &&
      log.message.includes("Transferred") &&
      log.message.includes("documents to MongoDB successfully")
    ) {
      return "mongodb-transfer-summary"; // Only one MongoDB transfer summary per task
    } else if (
      log.updatedFolioRows !== undefined &&
      log.updatedTransactionRows !== undefined &&
      log.message &&
      log.message.includes("Folio and Transaction updated successfully")
    ) {
      return "folio-transaction-update-summary"; // Only one folio/transaction update summary per task
    } else if (log.updatedDocuments) {
      return "mongo-update-summary";
    } else if (log.duplicates && Array.isArray(log.duplicates)) {
      return "mongo-duplicate-check-summary";
    } else if (log.message) {
      return log.message; // Fallback for other logs with a message
    }
    return JSON.stringify(log); // Fallback for anything else (less ideal)
  };

  useEffect(() => {
    setAllTaskLogs((prevAllTaskLogs) => {
      const newAllTaskLogs = { ...prevAllTaskLogs };
      let hasChanges = false;

      for (const taskKey in taskLogs) {
        const currentLogs = taskLogs[taskKey];
        // If the currentLogs for a taskKey are empty, clear the accumulated logs for that taskKey
        if (currentLogs.length === 0) {
          if (newAllTaskLogs[taskKey] && newAllTaskLogs[taskKey].length > 0) {
            newAllTaskLogs[taskKey] = [];
            hasChanges = true;
          }
          continue; // Move to the next taskKey
        }

        const accumulatedLogsForTask = [...(prevAllTaskLogs[taskKey] || [])];
        const updatedLogsForTask: any[] = [];
        const existingLogIdentifiers = new Set<string>();

        // First, add existing logs to the updated list, tracking their identifiers
        accumulatedLogsForTask.forEach((log) => {
          const identifier = getLogIdentifier(log);
          updatedLogsForTask.push(log);
          existingLogIdentifiers.add(identifier);
        });

        // Then, process current logs
        currentLogs.forEach((currentLog) => {
          const identifier = getLogIdentifier(currentLog);
          if (existingLogIdentifiers.has(identifier)) {
            // If an existing log has the same identifier, replace it
            const indexToUpdate = updatedLogsForTask.findIndex(
              (log) => getLogIdentifier(log) === identifier
            );
            if (indexToUpdate !== -1) {
              updatedLogsForTask[indexToUpdate] = currentLog;
              hasChanges = true;
            }
          } else {
            // Otherwise, append the new log
            updatedLogsForTask.push(currentLog);
            existingLogIdentifiers.add(identifier); // Add new identifier to set
            hasChanges = true;
          }
        });

        // If the number of logs changed or any log was updated, set the new array
        if (
          hasChanges ||
          updatedLogsForTask.length !== accumulatedLogsForTask.length
        ) {
          newAllTaskLogs[taskKey] = updatedLogsForTask;
        }
      }
      return hasChanges ? newAllTaskLogs : prevAllTaskLogs;
    });
  }, [taskLogs]); // Depend on taskLogs prop

  const excelProcessingStatus = uploadStatuses.find(
    (s) => s.fileName === "excel_processing"
  );

  useEffect(() => {
    // This effect can be used to react to changes in props, if necessary.
    // For example, automatically expanding a log if it contains an error.
  }, [taskLogs, uploadStatuses]);

  const toggleSection = (sectionKey: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }));
  };

  const toggleDirectory = (directoryKey: string) => {
    setExpandedDirectories((prev) => ({
      ...prev,
      [directoryKey]: !prev[directoryKey],
    }));
  };

  const toggleSplitLog = (logId: string) => {
    setExpandedSplitLog((prev) => (prev === logId ? null : logId));
  };

  const parseCsvContent = (csvString: string) => {
    const lines = csvString.trim().split("\n");
    if (lines.length === 0) return [];

    const headers = lines[0].split(",").map((h) => h.trim());
    const data = lines.slice(1).map((line) => {
      const values = line.split(",").map((v) => v.trim().replace(/^"|"$/g, "")); // Remove quotes
      const row: any = {};
      headers.forEach((header, index) => {
        row[header] = values[index];
      });
      return row;
    });
    return data;
  };

  const toggleBadRowsDisplay = useCallback(
    async (filePath: string, logId: string) => {
      if (expandedLogId === logId) {
        setParsedBadRows(null);
        setExpandedLogId(null);
      } else {
        try {
          const res = await axios.get(
            `http://localhost:3000/download-generated-file/${filePath}`
          );
          setParsedBadRows(parseCsvContent(res.data));
          setExpandedLogId(logId);
        } catch (error) {
          console.error("Failed to fetch bad rows content:", error);
          setParsedBadRows(null);
          setExpandedLogId(logId);
        }
      }
    },
    [expandedLogId]
  );

  const renderSummary = (log: any, logKey: string) => {
    if (log.splitSummary) {
      const isExpanded = expandedSplitLog === logKey;
      return (
        <div>
          <p>
            Total Original Files Processed:{" "}
            {log.splitSummary.totalOriginalFilesProcessed}
          </p>
          <p>Total Expected Splits: {log.splitSummary.totalExpectedSplits}</p>
          <p>
            Total Split Files Generated:{" "}
            {log.splitSummary.totalSplitFilesGenerated}
          </p>
          <p>Errors: {log.splitSummary.splitErrors}</p>
          <p>
            Total Expected Pages from CSV:{" "}
            {log.splitSummary.totalExpectedPagesFromCsv}
          </p>
          <p>
            Currently Splitting Files:{" "}
            {log.splitSummary.currentlySplittingFiles ?? 0}
          </p>
          {log.splitSummary.totalExpectedSplits > 0 && (
            <div className="w-full bg-gray-300 rounded-full h-4 mb-2">
              <div
                className="bg-black h-4 rounded-full text-xs font-medium text-white text-center p-0.5 leading-none"
                style={{
                  width: `${
                    (log.splitSummary.totalSplitFilesGenerated /
                      log.splitSummary.totalExpectedSplits) *
                    100
                  }%`,
                }}
              >
                {Math.round(
                  (log.splitSummary.totalSplitFilesGenerated /
                    log.splitSummary.totalExpectedSplits) *
                    100
                )}
                %
              </div>
            </div>
          )}
          <button onClick={() => toggleSplitLog(logKey)}>
            {isExpanded ? "Hide Details" : "Show Details"}
          </button>
          {isExpanded && (
            <div className="bg-gray-100 p-2 rounded mt-2">
              <h5 className="font-semibold">Split Verification Log:</h5>
              {log.splitFiles && log.splitFiles.length > 0 ? (
                <table className="w-full text-sm text-left">
                  <thead className="text-xs uppercase bg-gray-50">
                    <tr>
                      <th scope="col" className="px-2 py-1">
                        Fund
                      </th>
                      <th scope="col" className="px-2 py-1">
                        IH No
                      </th>
                      <th scope="col" className="px-2 py-1">
                        AC No
                      </th>
                      <th scope="col" className="px-2 py-1">
                        CSV Page Count
                      </th>
                      <th scope="col" className="px-2 py-1">
                        Split Count
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {log.splitFiles.map((item: any, index: number) => (
                      <tr key={index} className="bg-white border-b">
                        <td className="px-2 py-1">{item.id_fund}</td>
                        <td className="px-2 py-1">{item.id_ihno}</td>
                        <td className="px-2 py-1">{item.id_acno}</td>
                        <td className="px-2 py-1">
                          {item.page_count ?? "N/A"}
                        </td>
                        <td className="px-2 py-1">
                          {item.split_count ?? "N/A"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="mt-2">
                  No split file details available yet or no files were split.
                </p>
              )}
            </div>
          )}
        </div>
      );
    } else if (log.originalFile !== undefined && log.fileUrls !== undefined) {
      const isExpanded = expandedSections[`file-upload-${logKey}`];
      return (
        <div>
          <h5 className="font-semibold">File Upload Summary:</h5>
          <p>Original File: {log.originalFile}</p>
          <p>Processed File: {log.processedFile}</p>
          <button onClick={() => toggleSection(`file-upload-${logKey}`)}>
            {isExpanded ? "Hide Details" : "Show Details"}
          </button>
          {isExpanded && (
            <>
              <h5 className="font-semibold mt-2">Processed Files Details:</h5>
              {log.fileUrls.length > 0 ? (
                <table className="w-full text-sm text-left">
                  <thead className="text-xs uppercase bg-gray-50">
                    <tr>
                      <th scope="col" className="px-2 py-1">
                        Row
                      </th>
                      <th scope="col" className="px-2 py-1">
                        Page Count
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {log.fileUrls.map((item: any, index: number) => (
                      <tr key={index} className="bg-white border-b">
                        <td className="px-2 py-1">{item.row}</td>
                        <td className="px-2 py-1">{item.pageCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="mt-2">No files were successfully processed.</p>
              )}
            </>
          )}
        </div>
      );
    } else if (log.dryRun !== undefined && log.rows !== undefined) {
      const duplicatesMap = new Map<
        string,
        { count: number; entries: any[] }
      >();

      log.rows.forEach((row: any) => {
        const key = row.user_attr1;
        if (!duplicatesMap.has(key)) {
          duplicatesMap.set(key, { count: 0, entries: [] });
        }
        const entry = duplicatesMap.get(key)!;
        entry.count++;
        entry.entries.push(row);
      });

      const duplicateEntries = Array.from(duplicatesMap.values()).filter(
        (entry) => entry.count > 0
      );

      const isExpanded = expandedSections[`sanity-check-${logKey}`];

      return (
        <div>
          <h5 className="font-semibold">Sanity Check Duplicates Summary:</h5>
          <p>Dry Run: {log.dryRun ? "Yes" : "No"}</p>
          <p>Cutoff Timestamp: {log.cutoffTms}</p>
          <p>
            Total Duplicates Found:{" "}
            {duplicateEntries.reduce((acc, entry) => acc + entry.count - 1, 0)}
          </p>
          <button onClick={() => toggleSection(`sanity-check-${logKey}`)}>
            {isExpanded ? "Hide Details" : "Show Details"}
          </button>

          {isExpanded && (
            <>
              {duplicateEntries.length > 0 ? (
                <div className="bg-gray-100 p-2 rounded mt-2">
                  <h5 className="font-semibold">Duplicate Details:</h5>
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs uppercase bg-gray-50">
                      <tr>
                        <th scope="col" className="px-2 py-1">
                          Client ID
                        </th>
                        <th scope="col" className="px-2 py-1">
                          User Attr1
                        </th>
                        <th scope="col" className="px-2 py-1">
                          Creation Date
                        </th>
                        <th scope="col" className="px-2 py-1">
                          Duplicate Count
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {duplicateEntries.map((entry: any, index: number) => (
                        <tr key={index} className="bg-white border-b">
                          <td className="px-2 py-1">
                            {entry.entries[0].client_id}
                          </td>
                          <td className="px-2 py-1">
                            {entry.entries[0].user_attr1}
                          </td>
                          <td className="px-2 py-1">
                            {new Date(
                              entry.entries[0].creation_date
                            ).toLocaleString()}
                          </td>
                          <td className="px-2 py-1 font-bold">
                            {entry.count - 1}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="mt-2">No duplicates found.</p>
              )}
            </>
          )}
        </div>
      );
    } else if (
      log.successfulRows !== undefined &&
      log.badRows !== undefined &&
      log.message &&
      log.message.includes("SQL executed successfully")
    ) {
      const isExpanded = expandedSections["sql-execution-summary"];
      return (
        <div>
          <h5 className="font-semibold">SQL Execution Summary:</h5>
          <table className="w-full text-sm text-left">
            <thead className="text-xs uppercase bg-gray-50">
              <tr>
                <th scope="col" className="px-2 py-1">
                  Total Rows
                </th>
                <th scope="col" className="px-2 py-1">
                  Successful Rows
                </th>
                <th scope="col" className="px-2 py-1">
                  Bad Rows
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-white border-b">
                <td className="px-2 py-1">{log.totalRows}</td>
                <td className="px-2 py-1">{log.successfulRows}</td>
                <td className="px-2 py-1">{log.badRows}</td>
              </tr>
            </tbody>
          </table>
          {log.badRowsFilePath && log.badRows > 0 && (
            <>
              <button
                onClick={() =>
                  toggleBadRowsDisplay(log.badRowsFilePath, logKey)
                }
                className="mt-2 px-3 py-1 text-sm font-medium text-white bg-black rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2"
              >
                {expandedLogId === logKey ? "Hide Bad Rows" : "Show Bad Rows"}
              </button>
              {expandedLogId === logKey && parsedBadRows && (
                <div className="bg-gray-100 p-2 rounded mt-2">
                  <h5 className="font-semibold">Bad Rows Details:</h5>
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs uppercase bg-gray-50">
                      <tr>
                        {Object.keys(parsedBadRows[0] || {}).map((header) => (
                          <th scope="col" className="px-2 py-1" key={header}>
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {parsedBadRows.map((item: any, index: number) => (
                        <tr key={index} className="bg-white border-b">
                          {Object.values(item).map(
                            (value: any, valIndex: number) => (
                              <td className="px-2 py-1" key={valIndex}>
                                {value}
                              </td>
                            )
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      );
    } else if (
      log.transferredCount !== undefined &&
      log.documents !== undefined &&
      log.message &&
      log.message.includes("Transferred") &&
      log.message.includes("documents to MongoDB successfully")
    ) {
      const isExpanded = expandedSections["mongodb-transfer-summary"];
      return (
        <div>
          <h5 className="font-semibold">MongoDB Transfer Summary:</h5>
          <p>Total Documents Transferred: {log.transferredCount}</p>
          <button onClick={() => toggleSection("mongodb-transfer-summary")}>
            {isExpanded ? "Hide Details" : "Show Details"}
          </button>
          {isExpanded && log.documents.length > 0 && (
            <div className="bg-gray-100 p-2 rounded mt-2">
              <h5 className="font-semibold">Transferred Documents Details:</h5>
              <table className="w-full text-sm text-left">
                <thead className="text-xs uppercase bg-gray-50">
                  <tr>
                    <th scope="col" className="px-2 py-1">
                      Client ID
                    </th>
                    <th scope="col" className="px-2 py-1">
                      Transaction No
                    </th>
                    <th scope="col" className="px-2 py-1">
                      Work Date
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {log.documents.map((doc: any, index: number) => (
                    <tr key={index} className="bg-white border-b">
                      <td className="px-2 py-1">{doc.clientId}</td>
                      <td className="px-2 py-1">{doc.transactionNo}</td>
                      <td className="px-2 py-1">{doc.workDate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      );
    } else if (
      log.updatedFolioRows !== undefined &&
      log.updatedTransactionRows !== undefined &&
      log.message &&
      log.message.includes("Folio and Transaction updated successfully")
    ) {
      const isExpanded = expandedSections["folio-transaction-update-summary"];
      return (
        <div>
          <h5 className="font-semibold">
            Folio and Transaction Update Summary:
          </h5>
          <table className="w-full text-sm text-left">
            <thead className="text-xs uppercase bg-gray-50">
              <tr>
                <th scope="col" className="px-2 py-1">
                  Updated Folio Rows
                </th>
                <th scope="col" className="px-2 py-1">
                  Updated Transaction Rows
                </th>
                <th scope="col" className="px-2 py-1">
                  Bad Rows
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-white border-b">
                <td className="px-2 py-1">{log.updatedFolioRows}</td>
                <td className="px-2 py-1">{log.updatedTransactionRows}</td>
                <td className="px-2 py-1">{log.badRows}</td>
              </tr>
            </tbody>
          </table>
          <button
            onClick={() => toggleSection("folio-transaction-update-summary")}
          ></button>
          {isExpanded && log.badRowsFilePath && log.badRows > 0 && (
            <>
              <button
                onClick={() =>
                  toggleBadRowsDisplay(log.badRowsFilePath, logKey)
                }
                className="mt-2 text-black hover:underline focus:outline-none"
              >
                {expandedLogId === logKey ? "Hide Bad Rows" : "Show Bad Rows"}
              </button>
              {expandedLogId === logKey && parsedBadRows && (
                <div className="bg-gray-100 p-2 rounded mt-2">
                  <h5 className="font-semibold">Bad Rows Details:</h5>
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs uppercase bg-gray-50">
                      <tr>
                        {Object.keys(parsedBadRows[0] || {}).map((header) => (
                          <th scope="col" className="px-2 py-1" key={header}>
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {parsedBadRows.map((item: any, index: number) => (
                        <tr key={index} className="bg-white border-b">
                          {Object.values(item).map(
                            (value: any, valIndex: number) => (
                              <td className="px-2 py-1" key={valIndex}>
                                {value}
                              </td>
                            )
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      );
    } else if (log.duplicates && Array.isArray(log.duplicates)) {
      const isExpanded = expandedSections[`mongo-duplicate-check-${logKey}`];
      return (
        <div>
          <h5 className="font-semibold">MongoDB Duplicate Check Summary:</h5>
          {log.message && <p className="text-sm mb-2">{log.message}</p>}
          {log.duplicates.length > 0 ? (
            <p>Total unique duplicate entries found: {log.duplicates.length}</p>
          ) : (
            <p>No MongoDB duplicates found.</p>
          )}
          {log.duplicates.length > 0 && (
            <button
              onClick={() => toggleSection(`mongo-duplicate-check-${logKey}`)}
            >
              {isExpanded ? "Hide Details" : "Show Details"}
            </button>
          )}

          {isExpanded && log.duplicates.length > 0 && (
            <div className="bg-gray-100 p-2 rounded mt-2">
              <h5 className="font-semibold">Duplicate Details:</h5>
              <table className="w-full text-sm text-left">
                <thead className="text-xs uppercase bg-gray-50">
                  <tr>
                    <th scope="col" className="px-2 py-1">
                      Client ID
                    </th>
                    <th scope="col" className="px-2 py-1">
                      Transaction No
                    </th>
                    <th scope="col" className="px-2 py-1">
                      Duplicate Count
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {log.duplicates.map((dup: any, index: number) => (
                    <tr key={index} className="bg-white border-b">
                      <td className="px-2 py-1">{dup._id.clientId}</td>
                      <td className="px-2 py-1">{dup._id.transactionNo}</td>
                      <td className="px-2 py-1 font-bold">{dup.count - 1}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      );
    } else if (log.updatedDocuments) {
      const isExpanded = expandedSections["mongo-update-summary"];
      return (
        <div>
          <h5 className="font-semibold">Mongo Transactions Update Summary:</h5>
          <table className="w-full text-sm text-left">
            <thead className="text-xs uppercase bg-gray-50">
              <tr>
                <th scope="col" className="px-2 py-1">
                  Updated Count
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-white border-b">
                <td className="px-2 py-1">{log.updatedCount}</td>
              </tr>
            </tbody>
          </table>
          {log.updatedDocuments.length > 0 && (
            <>
              <button
                onClick={() => toggleSection("mongo-update-summary")}
                className="mt-2 text-black hover:underline focus:outline-none"
              >
                {isExpanded ? "Hide Details" : "Show Details"}
              </button>
              {isExpanded && (
                <div className="bg-gray-100 p-2 rounded mt-2">
                  <h5 className="font-semibold">Updated Documents Details:</h5>
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs uppercase bg-gray-50">
                      <tr>
                        <th scope="col" className="px-2 py-1">
                          Client ID
                        </th>
                        <th scope="col" className="px-2 py-1">
                          Old Transaction No
                        </th>
                        <th scope="col" className="px-2 py-1">
                          New Transaction No
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {log.updatedDocuments.map((doc: any, index: number) => (
                        <tr key={index} className="bg-white border-b">
                          <td className="px-2 py-1">{doc.clientId}</td>
                          <td className="px-2 py-1">{doc.oldTransactionNo}</td>
                          <td className="px-2 py-1">{doc.newTransactionNo}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      );
    }

    return (
      <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
        {JSON.stringify(log, null, 2)}
      </pre>
    );
  };

  return (
    <div className="mt-4 text-black h-full flex flex-col">
      <h3 className="text-lg font-semibold mb-1">Task Logs</h3>
      <div className="bg-gray-200 p-2 rounded flex-1 overflow-y-auto min-h-30">
        {Object.entries(allTaskLogs).map(
          (
            [task, logsArray] // Use allTaskLogs here
          ) => (
            <div key={task} className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold capitalize">{task}</h4>
                <button
                  onClick={() => onClearLogs(task)}
                  className="ml-2 px-3 py-1 text-sm font-medium text-white bg-gray-600 rounded-md hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                >
                  Clear Logs
                </button>
              </div>
              <div className="bg-gray-100 p-2 rounded">
                {logsArray.map((logItem: any) => (
                  <div
                    key={getLogIdentifier(logItem)}
                    className="mb-2 last:mb-0"
                  >
                    {typeof logItem === "string" ? (
                      <p>{logItem}</p>
                    ) : (
                      renderSummary(logItem, getLogIdentifier(logItem))
                    )}
                  </div>
                ))}

                {task === "uploadAndScript" && (
                  <>
                    {excelProcessingStatus && (
                      <div className="mt-4">
                        <h5 className="font-semibold">
                          Excel Processing Progress
                        </h5>
                        <button
                          onClick={() =>
                            toggleSection("excel-processing-progress")
                          }
                        >
                          {expandedSections["excel-processing-progress"]
                            ? "Hide Details"
                            : "Show Details"}
                        </button>
                        {expandedSections["excel-processing-progress"] && (
                          <div className="bg-gray-100 p-2 rounded">
                            {excelProcessingStatus.progress !== undefined && (
                              <>
                                <div className="w-full bg-gray-300 rounded-full h-4 mb-2">
                                  <div
                                    className="bg-black h-4 rounded-full text-xs font-medium text-white text-center p-0.5 leading-none"
                                    style={{
                                      width: `${excelProcessingStatus.progress}%`,
                                    }}
                                  >
                                    {excelProcessingStatus.progress}%
                                  </div>
                                </div>
                                <div className="text-sm">
                                  <p>
                                    <strong>Total:</strong>{" "}
                                    {excelProcessingStatus.totalFiles} |{" "}
                                    <strong>Processed:</strong>{" "}
                                    {excelProcessingStatus.processedFiles} |{" "}
                                    <strong>Successful:</strong>{" "}
                                    {excelProcessingStatus.successfulFiles} |{" "}
                                    <strong>Errors:</strong>{" "}
                                    {excelProcessingStatus.errorFiles} |{" "}
                                    <strong>Not Found:</strong>{" "}
                                    {excelProcessingStatus.notFoundFiles}
                                  </p>
                                </div>
                              </>
                            )}
                            {excelProcessingStatus.badRowsDetails &&
                              excelProcessingStatus.badRowsDetails.length >
                                0 && (
                                <div className="mt-2">
                                  <button
                                    onClick={() =>
                                      toggleSection("excel-bad-rows-details")
                                    }
                                    className="font-semibold text-black hover:underline focus:outline-none"
                                  >
                                    {expandedSections["excel-bad-rows-details"]
                                      ? "Hide Bad Rows Details"
                                      : "Show Bad Rows Details"}
                                  </button>
                                  {expandedSections[
                                    "excel-bad-rows-details"
                                  ] && (
                                    <div className="bg-gray-100 p-2 rounded mt-2">
                                      <h5 className="font-semibold">
                                        Bad Rows Details:
                                      </h5>
                                      <table className="w-full text-sm text-left">
                                        <thead className="text-xs uppercase bg-gray-50">
                                          <tr>
                                            <th
                                              scope="col"
                                              className="px-2 py-1"
                                            >
                                              IH No
                                            </th>
                                            <th
                                              scope="col"
                                              className="px-2 py-1"
                                            >
                                              AC No
                                            </th>
                                            <th
                                              scope="col"
                                              className="px-2 py-1"
                                            >
                                              Reason
                                            </th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {excelProcessingStatus.badRowsDetails.map(
                                            (row, index) => (
                                              <tr
                                                key={index}
                                                className="bg-white border-b"
                                              >
                                                <td className="px-2 py-1">
                                                  {row.id_ihno}
                                                </td>
                                                <td className="px-2 py-1">
                                                  {row.id_acno}
                                                </td>
                                                <td className="px-2 py-1">
                                                  {row.page_count_status}
                                                </td>
                                              </tr>
                                            )
                                          )}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                </div>
                              )}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default SummaryDisplay;
