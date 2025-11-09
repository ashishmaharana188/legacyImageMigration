import React, { useState } from "react";
import { SQLSummaryDisplayProps } from "./sqlTaskType";
import { MongoSummaryDisplayProps } from "./mongoTaskType";
import { MongoDocument, MongoUpdatedDocument } from "./mongoTaskType";
export const SQLSummaryDisplay: React.FC<SQLSummaryDisplayProps> = ({
  log,
  logKey,
  expandedLogId,
  toggleBadRowsDisplay,
}) => {
  if ("successfulRows" in log && "badRows" in log) {
    // SQL Execution Summary
    const { totalRows = 0, successfulRows = 0, badRows = 0 } = log;
    return (
      <div>
        <h5 className="font-semibold">SQL Execution Summary:</h5>
        <p>
          Total Inserts: {totalRows !== undefined ? totalRows : "N/A"}
        </p>
        <p>
          Total Successful:{" "}
          {successfulRows !== undefined ? successfulRows : "N/A"}
        </p>
        <p>Total Failed: {badRows !== undefined ? badRows : "N/A"}</p>
        {log.badRowsFilePath && log.badRows !== undefined && log.badRows > 0 && (
          <>
            <button
              onClick={() => toggleBadRowsDisplay(log.badRowsFilePath!, logKey)}
              className="mt-2 px-3 py-1 text-sm font-medium text-white bg-black rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2"
            >
              {expandedLogId === logKey ? "Hide Bad Rows" : "Show Bad Rows"}
            </button>

          </>
        )}
      </div>
    );
  } else if ("updatedFolioRows" in log && "updatedTransactionRows" in log) {
    // Folio and Transaction Update Summary
    const { updatedFolioRows = 0, updatedTransactionRows = 0, badRows = 0 } = log;
    return (
      <div>
        <h5 className="font-semibold">
          Folio and Transaction Update Summary:
        </h5>
        <p>
          Total FolioId Updated:{" "}
          {updatedFolioRows !== undefined ? updatedFolioRows : "N/A"}
        </p>
        <p>
          Total TransactionId Updated:{" "}
          {updatedTransactionRows !== undefined
            ? updatedTransactionRows
            : "N/A"}
        </p>
        <p>Total Failed: {badRows !== undefined ? badRows : "N/A"}</p>
      </div>
    );
  }
  return null;
};

export const MongoSummaryDisplay: React.FC<MongoSummaryDisplayProps> = ({
  log,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleExpansion = () => {
    setIsExpanded(!isExpanded);
  };

  if ("transferredCount" in log && "documents" in log) {
    // MongoDB Transfer Summary
    return (
      <div>
        <h5 className="font-semibold">MongoDB Transfer Summary:</h5>
        <p>Total Documents Transferred: {log.transferredCount}</p>
        <button onClick={toggleExpansion}>
          {isExpanded ? "Hide Details" : "Show Details"}
        </button>
        {isExpanded && log.documents && log.documents.length > 0 && (
          <div className="bg-gray-100 p-2 rounded mt-2">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase bg-gray-50">
                <tr>
                  <th scope="col" className="px-2 py-1">ID</th>
                  <th scope="col" className="px-2 py-1">Client Code</th>
                  <th scope="col" className="px-2 py-1">Status</th>
                </tr>
              </thead>
              <tbody>
                {log.documents.map((doc: MongoDocument, index: number) => (
                  <tr key={index} className="bg-white border-b">
                    <td className="px-2 py-1">{doc._id}</td>
                    <td className="px-2 py-1">{doc.clientCode}</td>
                    <td className="px-2 py-1">{doc.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  } else if ("duplicates" in log && Array.isArray(log.duplicates)) {
    // MongoDB Duplicate Check Summary
    return (
      <div>
        <h5 className="font-semibold">MongoDB Duplicate Check Summary:</h5>
        <p>
          Total Duplicate Documents:{" "}
          {log.totalDuplicateDocuments !== undefined && log.totalDuplicateGroups !== undefined
            ? log.totalDuplicateDocuments - log.totalDuplicateGroups
            : "N/A"}
        </p>
        <p>Total documents after Cuttoff: {log.totalDuplicateGroups !== undefined ? log.totalDuplicateGroups : "N/A"}</p>
      </div>
    );
  } else if ("updatedDocuments" in log) {
    // Mongo Transactions Update Summary
    return (
      <div>
        <h5 className="font-semibold">Mongo Transactions Update Summary:</h5>
        <p>Updated Count: {log.updatedCount !== undefined ? log.updatedCount : "N/A"}</p>
        {log.updatedDocuments && log.updatedDocuments.length > 0 && (
          <button onClick={toggleExpansion}>
            {isExpanded ? "Hide Details" : "Show Details"}
          </button>
        )}
        {isExpanded && log.updatedDocuments && (
          <div className="bg-gray-100 p-2 rounded mt-2">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase bg-gray-50">
                <tr>
                  <th scope="col" className="px-2 py-1">ID</th>
                  <th scope="col" className="px-2 py-1">Client Code</th>
                  <th scope="col" className="px-2 py-1">Old Transaction ID</th>
                  <th scope="col" className="px-2 py-1">New Transaction ID</th>
                </tr>
              </thead>
              <tbody>
                {log.updatedDocuments.map((doc: MongoUpdatedDocument, index: number) => (
                  <tr key={index} className="bg-white border-b">
                    <td className="px-2 py-1">{doc._id}</td>
                    <td className="px-2 py-1">{doc.clientCode}</td>
                    <td className="px-2 py-1">{doc.oldTransactionId}</td>
                    <td className="px-2 py-1">{doc.newTransactionId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }
  return null;
};
