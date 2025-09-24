import React, { useState, useCallback, useEffect } from "react";
import axios from "axios";

interface SummaryItem {
  fileName: string;
  status: string;
}

interface UploadStatus {
  fileName: string;
  progress?: number;
  status?: string;
}

interface SummaryDisplayProps {
  taskLogs: { [key: string]: any };
  summaryData: SummaryItem[];
  uploadStatuses: UploadStatus[];
}

const SummaryDisplay: React.FC<SummaryDisplayProps> = ({
  taskLogs,
  summaryData,
  uploadStatuses,
}) => {
  const [expandedLogContent, setExpandedLogContent] = useState<string | null>(
    null
  );
  const [parsedBadRows, setParsedBadRows] = useState<any[] | null>(null);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [expandedSplitLog, setExpandedSplitLog] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<{
    [key: string]: boolean;
  }>({});
  const [expandedDirectories, setExpandedDirectories] = useState<{
    [key: string]: boolean;
  }>({});

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

  const groupUploadStatusesByDirectory = (statuses: UploadStatus[]) => {
    const grouped: {
      [key: string]: {
        files: UploadStatus[];
        totalProgress: number;
        doneCount: number;
      };
    } = {};

    statuses.forEach((status) => {
      const lastSlashIndex = status.fileName.lastIndexOf("/");
      let directoryName: string;

      if (lastSlashIndex !== -1) {
        const fullDirectoryPath = status.fileName.substring(0, lastSlashIndex);
        const secondLastSlashIndex = fullDirectoryPath.lastIndexOf("/");

        if (secondLastSlashIndex !== -1) {
          directoryName = fullDirectoryPath.substring(secondLastSlashIndex + 1);
        } else {
          directoryName = fullDirectoryPath; // Case like 'dir/file.pdf'
        }
      } else {
        directoryName = "Other Files"; // Files without any slashes
      }

      if (!grouped[directoryName]) {
        grouped[directoryName] = { files: [], totalProgress: 0, doneCount: 0 };
      }
      grouped[directoryName].files.push(status);
      if (status.status === "Done") {
        grouped[directoryName].doneCount++;
      }
      grouped[directoryName].totalProgress += status.progress || 0;
    });

    return Object.entries(grouped).map(([directory, data]) => {
      const totalFiles = data.files.length;
      const allDone = data.doneCount === totalFiles;
      const averageProgress =
        totalFiles > 0 ? Math.round(data.totalProgress / totalFiles) : 0;

      return {
        directoryName: directory,
        progress: allDone ? 100 : averageProgress,
        status: allDone
          ? "Done"
          : averageProgress > 0
          ? "Uploading..."
          : "Starting...",
        files: data.files,
      };
    });
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
        setExpandedLogContent(null);
        setParsedBadRows(null);
        setExpandedLogId(null);
      } else {
        try {
          const res = await axios.get(
            `http://localhost:3000/download-generated-file/${filePath}`
          );
          setExpandedLogContent(res.data);
          setParsedBadRows(parseCsvContent(res.data));
          setExpandedLogId(logId);
        } catch (error) {
          console.error("Failed to fetch bad rows content:", error);
          setExpandedLogContent("Failed to load content.");
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
          <button onClick={() => toggleSplitLog(logKey)}>
            {isExpanded ? "Hide Details" : "Show Details"}
          </button>
          {isExpanded && (
            <div className="bg-gray-100 p-2 rounded mt-2">
              <h5 className="font-semibold">Split Verification Log:</h5>
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
                      <td className="px-2 py-1">{item.page_count ?? "N/A"}</td>
                      <td className="px-2 py-1">{item.split_count ?? "N/A"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
        (entry) => entry.count > 1
      );

      const isExpanded = expandedSections[`sanity-check-${logKey}`];

      return (
        <div>
          <h5 className="font-semibold">Sanity Check Duplicates Summary:</h5>
          <p>Dry Run: {log.dryRun ? "Yes" : "No"}</p>
          <p>Cutoff Timestamp: {log.cutoffTms}</p>
          <p>Total Duplicates Found: {log.rows.length}</p>
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
                          <td className="px-2 py-1 font-bold">{entry.count}</td>
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
                className="mt-2 px-3 py-1 text-sm font-medium text-white bg-black rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2"
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
      const isExpanded = expandedSections[`mongodb-transfer-${logKey}`];
      return (
        <div>
          <h5 className="font-semibold">MongoDB Transfer Summary:</h5>
          <p>Total Documents Transferred: {log.transferredCount}</p>
          <button onClick={() => toggleSection(`mongodb-transfer-${logKey}`)}>
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
      const isExpanded = expandedSections[`folio-transaction-update-${logKey}`];
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
            onClick={() => toggleSection(`folio-transaction-update-${logKey}`)}
          >
            {isExpanded ? "Hide Details" : "Show Details"}
          </button>
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
    }

    return (
      <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
        {JSON.stringify(log, null, 2)}
      </pre>
    );
  };

  return (
    <div className="mt-4 text-black" id="s3uploadprogress">
      <h3 className="text-lg font-semibold mb-1">Task Logs</h3>
      <div className="bg-gray-200 p-2 rounded overflow-auto min-h-30">
        {Object.entries(taskLogs).map(([task, log]) => (
          <div key={task} className="mb-4">
            <h4 className="font-semibold capitalize mb-2">{task}</h4>
            <div className="bg-gray-100 p-2 rounded">
              {typeof log === "string" ? (
                <p>{log}</p>
              ) : (
                renderSummary(log, task) // Pass 'task' as logKey
              )}
            </div>
          </div>
        ))}

        {uploadStatuses.length > 0 && (
          <div className="mb-4">
            <h4 className="font-semibold capitalize mb-2">
              S3 Upload Progress
            </h4>
            <button onClick={() => toggleSection("s3-upload-progress")}>
              {expandedSections["s3-upload-progress"]
                ? "Hide Details"
                : "Show Details"}
            </button>
            {expandedSections["s3-upload-progress"] && (
              <div className="bg-gray-100 p-2 rounded">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs uppercase bg-gray-50">
                    <tr>
                      <th scope="col" className="px-2 py-1">
                        Directory/File Name
                      </th>
                      <th scope="col" className="px-2 py-1">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupUploadStatusesByDirectory(uploadStatuses).map(
                      (directoryStatus) => (
                        <React.Fragment key={directoryStatus.directoryName}>
                          <tr className="bg-gray-100 border-b font-semibold">
                            <td className="px-2 py-1">
                              <button
                                onClick={() =>
                                  toggleDirectory(directoryStatus.directoryName)
                                }
                                className="font-semibold text-black hover:underline focus:outline-none"
                              >
                                {directoryStatus.directoryName} (
                                {directoryStatus.files.length} files)
                              </button>
                            </td>
                            <td className="px-2 py-1">
                              {directoryStatus.status === "Done" ? (
                                <span className="text-black">Done</span>
                              ) : directoryStatus.progress !== undefined ? (
                                <div className="w-full bg-gray-300 rounded-full h-4">
                                  <div
                                    className="bg-black h-4 rounded-full text-xs font-medium text-white text-center p-0.5 leading-none"
                                    style={{
                                      width: `${directoryStatus.progress}%`,
                                    }}
                                  >
                                    {directoryStatus.progress}%
                                  </div>
                                </div>
                              ) : (
                                "Starting..."
                              )}
                            </td>
                          </tr>
                          {expandedDirectories[
                            directoryStatus.directoryName
                          ] && (
                            <tr className="bg-white border-b">
                              <td className="px-2 py-1 pl-4">
                                - {directoryStatus.directoryName} -{" "}
                                {directoryStatus.status}
                              </td>
                              <td className="px-2 py-1"></td>
                            </tr>
                          )}
                        </React.Fragment>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SummaryDisplay;
