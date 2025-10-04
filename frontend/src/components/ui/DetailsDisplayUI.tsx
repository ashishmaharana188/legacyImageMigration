import React, { useState } from "react";

interface DetailsDisplayUIProps {
  log: any;
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
    if (log.message) {
      const statusText =
        log.status && log.status !== "in-progress" ? ` (${log.status})` : "";
      const statusColor =
        log.status === "success"
          ? "text-black"
          : log.status === "failed"
          ? "text-black"
          : "text-black";
      return (
        <div className={`${statusColor} font-bold text-lg`}>
          {log.message}
          {statusText}
        </div>
      );
    } else if (log.splitSummary) {
      return null; // Handled by ProgressTrackingUI
    } else if (log.originalFile !== undefined && log.fileUrls !== undefined) {
      return (
        <div>
          <h5 className="font-semibold">File Upload Summary:</h5>
          <p>Original File: {log.originalFile}</p>
          <p>Processed File: {log.processedFile}</p>
          <button onClick={toggleExpansion}>
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
        (entry) => entry.count > 1
      );

      return (
        <div>
          <h5 className="font-semibold">Sanity Check Duplicates Summary:</h5>
          <p>Dry Run: {log.dryRun ? "Yes" : "No"}</p>
          <p>Cutoff Timestamp: {log.cutoffTms}</p>
          <p>
            Total Duplicates Found:{" "}
            {duplicateEntries.reduce((acc, entry) => acc + entry.count - 1, 0)}
          </p>
          <button onClick={toggleExpansion}>
            {isExpanded ? "Hide Details" : "Show Details"}
          </button>
          {isExpanded && (
            <>
              {duplicateEntries.length > 0 ? (
                <div className="bg-gray-100 p-2 rounded mt-2">
                  {/* ... duplicate details table ... */}
                </div>
              ) : (
                <p className="mt-2">No duplicates found.</p>
              )}
            </>
          )}
        </div>
      );
    } else if (log.successfulRows !== undefined && log.badRows !== undefined) {
      return (
        <div>
          <h5 className="font-semibold">SQL Execution Summary:</h5>
          <p>
            Total Inserts: {log.totalRows !== undefined ? log.totalRows : "N/A"}
          </p>
          <p>
            Total Successful:{" "}
            {log.successfulRows !== undefined ? log.successfulRows : "N/A"}
          </p>
          <p>Total Failed: {log.badRows !== undefined ? log.badRows : "N/A"}</p>
          <table className="w-full text-sm text-left">
            {/* ... summary table ... */}
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
                    {/* ... bad rows table ... */}
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      );
    } else if (
      log.transferredCount !== undefined &&
      log.documents !== undefined
    ) {
      return (
        <div>
          <h5 className="font-semibold">MongoDB Transfer Summary:</h5>
          <p>Total Documents Transferred: {log.transferredCount}</p>
          <button onClick={toggleExpansion}>
            {isExpanded ? "Hide Details" : "Show Details"}
          </button>
          {isExpanded && log.documents.length > 0 && (
            <div className="bg-gray-100 p-2 rounded mt-2">
              {/* ... transferred documents table ... */}
            </div>
          )}
        </div>
      );
    } else if (
      log.updatedFolioRows !== undefined &&
      log.updatedTransactionRows !== undefined
    ) {
      return (
        <div>
          <h5 className="font-semibold">
            Folio and Transaction Update Summary:
          </h5>
          <table className="w-full text-sm text-left">
            <p>
              Total FolioId Updated:{" "}
              {log.updatedFolioRows !== undefined
                ? log.updatedFolioRows
                : "N/A"}
            </p>
            <p>
              Total TransactionId Updated:{" "}
              {log.updatedTransactionRows !== undefined
                ? log.updatedTransactionRows
                : "N/A"}
            </p>
            <p>
              Total Failed: {log.badRows !== undefined ? log.badRows : "N/A"}
            </p>
          </table>
        </div>
      );
    } else if (log.duplicates && Array.isArray(log.duplicates)) {
      return (
        <div>
          <h5 className="font-semibold">MongoDB Duplicate Check Summary:</h5>
          <p>
            Total Duplicate Documents:{" "}
            {log.totalDuplicateDocuments - log.totalDuplicateGroups}
          </p>
          <p>Total documents after Cuttoff: {log.totalDuplicateGroups}</p>
        </div>
      );
    } else if (log.updatedDocuments) {
      return (
        <div>
          <h5 className="font-semibold">Mongo Transactions Update Summary:</h5>
          <p>Updated Count: {log.updatedCount}</p>
          {log.updatedDocuments.length > 0 && (
            <button onClick={toggleExpansion}>
              {isExpanded ? "Hide Details" : "Show Details"}
            </button>
          )}
          {isExpanded && (
            <div className="bg-gray-100 p-2 rounded mt-2">
              {/* ... updated documents table ... */}
            </div>
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

  return <div>{renderContent()}</div>;
};

export default DetailsDisplayUI;
