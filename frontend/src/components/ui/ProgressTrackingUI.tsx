import React, { useState } from "react";

export interface ProgressMetrics {
  inserted?: number;
  updated?: number;
  folioUpdated?: number;
  txnUpdated?: number;
  synced?: number;
  failed?: number;

  // [FIX] Added Sanity Check Metrics
  duplicates?: number; // <--- Required for Mongo
  imperfectVsPerfect?: number; // <--- Required for PG
  olderVersions?: number; // <--- Required for PG
  olderImperfects?: number; // <--- Required for PG
}

export interface ProgressTrackingUIProps {
  label?: string;
  status?: string;
  details?: string;
  title?: string;
  progress?: number;
  total?: number;
  processed?: number;
  successful?: number;
  errors?: number;
  notFound?: number;
  displayType?: "aggregate" | "default" | "simple" | "sidebar";
  unit?: string;

  detailedMetrics?: ProgressMetrics;
  metrics?: ProgressMetrics;

  badRowsDetails?: any[];
}

const ProgressTrackingUI: React.FC<ProgressTrackingUIProps> = ({
  title,
  label,
  status,
  details,
  progress = 0,
  total,
  processed,
  successful,
  errors,
  notFound,
  displayType = "default",
  detailedMetrics,
  metrics,
  unit = "files",
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const percentage = Math.round(progress);

  // Merge metrics
  const finalMetrics: ProgressMetrics = { ...detailedMetrics, ...metrics };

  if (displayType === "sidebar") {
    const isError = status === "Error" || status === "failed";
    const isSuccess =
      status === "Success" || status === "completed" || status === "Done";
    const isWarning = status === "Warning";

    let statusColor = "text-black";
    if (isError) statusColor = "text-red-600";
    else if (isSuccess) statusColor = "text-green-600";
    else if (isWarning) statusColor = "text-orange-600";

    let barColor = "bg-black";
    if (isError) barColor = "bg-red-500";
    else if (isSuccess) barColor = "bg-green-500";
    else if (isWarning) barColor = "bg-orange-500";

    return (
      <div className="mt-2 mb-4 w-full">
        <div className="flex justify-between items-center mb-1">
          <span
            className="text-xs font-semibold text-gray-700 truncate max-w-[70%] pb-3"
            title={label || title}
          >
            {label || title}
          </span>
          <span className={`text-[10px] font-bold uppercase ${statusColor}`}>
            {status} {percentage}%
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-1.5 mb-1">
          <div
            className={`h-1.5 rounded-full transition-all duration-300 ${barColor}`}
            style={{ width: `${percentage}%` }}
          ></div>
        </div>
        {details && (
          <div className="text-[10px] text-gray-500 font-mono text-right">
            {details}
          </div>
        )}
      </div>
    );
  }

  if (displayType === "simple") {
    return (
      <div className="mt-4 border border-gray-200 rounded p-3 bg-white shadow-sm">
        <div className="flex justify-between items-center mb-2">
          <h4 className="font-semibold text-sm text-gray-800">{title}</h4>
          <span className="text-xs font-mono text-gray-500">{percentage}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2.5 mb-3">
          <div
            className={`h-2.5 rounded-full transition-all duration-300 ease-out ${
              (errors || 0) > 0 ? "bg-orange-500" : "bg-black"
            }`}
            style={{ width: `${percentage}%` }}
          ></div>
        </div>
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div className="flex flex-col gap-1">
            <span className="text-gray-500 font-medium">Processing</span>
            {processed !== undefined ? (
              <span className="text-gray-900 font-mono">
                Processed: {processed?.toLocaleString()} /{" "}
                {total?.toLocaleString()}
              </span>
            ) : (
              <span className="text-gray-900 font-mono">
                Total Found: {total?.toLocaleString()}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-gray-500 font-medium">Results</span>
            <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono">
              {finalMetrics.folioUpdated !== undefined && (
                <>
                  <span className="text-emerald-700 font-semibold">
                    Folios: {finalMetrics.folioUpdated}
                  </span>
                  <span className="text-blue-700 font-semibold">
                    Txns: {finalMetrics.txnUpdated}
                  </span>
                </>
              )}
              {finalMetrics.inserted !== undefined && (
                <span className="text-green-700 font-semibold">
                  Inserted: {finalMetrics.inserted}
                </span>
              )}

              {/* [FIX] Render Sanity Check Metrics */}
              {finalMetrics.imperfectVsPerfect !== undefined && (
                <span
                  className="text-red-600 font-semibold"
                  title="Imperfect rows in groups with perfect rows"
                >
                  Imp-Perf: {finalMetrics.imperfectVsPerfect}
                </span>
              )}
              {finalMetrics.olderVersions !== undefined && (
                <span
                  className="text-orange-600 font-semibold"
                  title="Older valid versions"
                >
                  Old-Ver: {finalMetrics.olderVersions}
                </span>
              )}
              {finalMetrics.olderImperfects !== undefined && (
                <span
                  className="text-yellow-600 font-semibold"
                  title="Older imperfect duplicates"
                >
                  Old-Imp: {finalMetrics.olderImperfects}
                </span>
              )}

              {/* [FIX] This is the specific line missing for Mongo */}
              {finalMetrics.duplicates !== undefined && (
                <span className="text-orange-600 font-semibold">
                  Duplicates: {finalMetrics.duplicates}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Aggregate View Fallback
  return (
    <div className="mt-4 p-4 bg-gray-100 rounded-lg shadow-inner">
      <div className="flex justify-between items-center mb-2">
        <h4 className="font-semibold text-black">{title}</h4>
        <span className="text-xs font-bold">{percentage}%</span>
      </div>
      <div className="w-full bg-gray-300 rounded-full h-2.5 mb-3">
        <div
          className="bg-black h-2.5 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${percentage}%` }}
        ></div>
      </div>

      {/* This section was missing previously */}
      <div className="grid grid-cols-2 gap-y-2 text-[11px] font-medium uppercase tracking-tight">
        <div className="text-gray-600">
          Total {unit}:{" "}
          <span className="text-black font-bold">{total || 0}</span>
        </div>
        <div className="text-green-700">
          Success: <span className="font-bold">{successful || 0}</span>
        </div>
        <div className="text-red-600">
          Errors: <span className="font-bold">{errors || 0}</span>
        </div>
        {notFound !== undefined && notFound > 0 && (
          <div className="text-orange-600">
            Not Found: <span className="font-bold">{notFound}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProgressTrackingUI;
