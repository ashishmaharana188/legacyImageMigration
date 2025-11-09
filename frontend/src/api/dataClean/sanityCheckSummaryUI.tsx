import React, { useState } from "react";
import { SanityCheckSummaryDisplayProps, SanityCheckResponse } from "./sanityCheckType";

const SanityCheckSummaryDisplay: React.FC<SanityCheckSummaryDisplayProps> = ({
  log,
  logKey,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleExpansion = () => {
    setIsExpanded(!isExpanded);
  };

  const isSanityCheckLog = (log: any): log is SanityCheckResponse => {
    return log && (log.dryRun !== undefined || log.duplicates !== undefined);
  };

  if (!isSanityCheckLog(log)) {
    return null;
  }

  const sanityLog = log as SanityCheckResponse;

  if (sanityLog.dryRun !== undefined && sanityLog.rows !== undefined) {
    const duplicatesMap = new Map<
      string,
      { count: number; entries: any[] }
    >();
    sanityLog.rows.forEach((row: any) => {
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
        <h5 className="font-semibold">PostgreSQL Sanity Check Summary:</h5>
        <p>Dry Run: {sanityLog.dryRun ? "Yes" : "No"}</p>
        <p>Cutoff Timestamp: {sanityLog.cutoffTms}</p>
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
                <table className="w-full text-sm text-left">
                  <thead className="text-xs uppercase bg-gray-50">
                    <tr>
                      <th scope="col" className="px-2 py-1">User Attr1</th>
                      <th scope="col" className="px-2 py-1">Client ID</th>
                      <th scope="col" className="px-2 py-1">Creation Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {duplicateEntries.map((entry, index) => (
                      <React.Fragment key={index}>
                        {entry.entries.map((row: any, rowIndex: number) => (
                          <tr key={`${index}-${rowIndex}`} className="bg-white border-b">
                            <td className="px-2 py-1">{row.user_attr1}</td>
                            <td className="px-2 py-1">{row.client_id}</td>
                            <td className="px-2 py-1">{row.creation_date}</td>
                          </tr>
                        ))}
                      </React.Fragment>
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
  } else if (sanityLog.duplicates && Array.isArray(sanityLog.duplicates)) {
    return (
      <div>
        <h5 className="font-semibold">MongoDB Duplicate Check Summary:</h5>
        <p>
          Total Duplicate Documents:{" "}
          {sanityLog.totalDuplicateDocuments !== undefined && sanityLog.totalDuplicateGroups !== undefined
            ? sanityLog.totalDuplicateDocuments - sanityLog.totalDuplicateGroups
            : "N/A"}
        </p>
        <p>Total documents after Cutoff: {sanityLog.totalDuplicateGroups !== undefined ? sanityLog.totalDuplicateGroups : "N/A"}</p>
      </div>
    );
  }

  return null;
};

export default SanityCheckSummaryDisplay;
