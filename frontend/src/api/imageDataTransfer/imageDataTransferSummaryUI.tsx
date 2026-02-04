import React, { useState } from "react";

// Helper to safely access metrics
const getMetrics = (log: any) => log.metrics || {};

export const SQLSummaryDisplay: React.FC<any> = ({
  log,
  logKey,
  expandedLogId,
  toggleBadRowsDisplay,
}) => {
  const metrics = getMetrics(log);

  if (log.subTask === "executeSql") {
    return (
      <div className="mt-2 pt-2 border-t border-green-200">
        <h5 className="font-semibold mb-1">SQL Execution Details:</h5>
        <ul className="list-disc pl-4 space-y-1">
          <li>Total Rows Processed: {log.totalRows ?? "Unknown"}</li>
          <li>
            Rows Inserted: <b>{metrics.inserted ?? 0}</b>
          </li>
          {metrics.failed > 0 && (
            <li className="text-red-600">Failed: {metrics.failed}</li>
          )}
        </ul>
        {log.badRowsFilePath && (
          <button
            onClick={() => toggleBadRowsDisplay(log.badRowsFilePath!, logKey)}
            className="mt-2 text-xs underline text-red-600"
          >
            {expandedLogId === logKey ? "Hide Errors" : "View Errors"}
          </button>
        )}
      </div>
    );
  }

  if (log.subTask === "updateFolio") {
    return (
      <div className="mt-2 pt-2 border-t border-green-200">
        <h5 className="font-semibold mb-1">Update Summary:</h5>
        <ul className="list-disc pl-4 space-y-1">
          <li>Total Processed: {log.totalRows ?? "Unknown"}</li>
          <li>
            Records Updated: <b>{metrics.updated ?? 0}</b>
          </li>
        </ul>
      </div>
    );
  }

  return null;
};

export const MongoSummaryDisplay: React.FC<any> = ({ log }) => {
  const metrics = getMetrics(log);
  const [expanded, setExpanded] = useState(false);

  if (log.subTask === "transferMongo") {
    return (
      <div className="mt-2 pt-2 border-t border-green-200">
        <h5 className="font-semibold mb-1">Mongo Transfer:</h5>
        <ul className="list-disc pl-4 space-y-1">
          <li>
            Documents Transferred: <b>{metrics.inserted ?? 0}</b>
          </li>
          {metrics.failed > 0 && (
            <li className="text-red-600">Failed: {metrics.failed}</li>
          )}
        </ul>
      </div>
    );
  }

  if (log.subTask === "syncMongo") {
    return (
      <div className="mt-2 pt-2 border-t border-green-200">
        <h5 className="font-semibold mb-1">Mongo Sync:</h5>
        <ul className="list-disc pl-4 space-y-1">
          <li>Documents Scanned: {log.totalRows ?? "Unknown"}</li>
          <li>
            Updated: <b>{metrics.updated ?? 0}</b>
          </li>
          <li>Already Synced: {metrics.synced ?? 0}</li>
        </ul>
      </div>
    );
  }

  return null;
};
