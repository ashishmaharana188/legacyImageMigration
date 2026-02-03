import React, { useState } from "react";

export interface ProgressTrackingUIProps {
  // [FIX] Standardized Props for Sidebar/Summary Display
  label?: string;
  status?: string;
  details?: string;

  // Existing Props for specific views
  title?: string;
  progress?: number;
  total?: number;
  processed?: number;
  successful?: number;
  errors?: number;
  notFound?: number;
  displayType?: "aggregate" | "default" | "simple";
  unit?: string;

  detailedMetrics?: {
    folioUpdated?: number;
    txnUpdated?: number;
    inserted?: number;
  };

  badRowsDetails?: Array<{
    id_ihno: string;
    id_acno: string;
    page_count_status: string | number;
  }>;

  // [FIX] Allow generic metrics pass-through
  metrics?: {
    inserted?: number;
    updated?: number;
    folioUpdated?: number;
    txnUpdated?: number;
    synced?: number;
    failed?: number;
  };
}

const ProgressTrackingUI: React.FC<ProgressTrackingUIProps> = ({
  title,
  label, // [FIX] Destructure new props
  status,
  details,
  progress = 0,
  total,
  processed,
  successful,
  errors,
  notFound,
  badRowsDetails,
  displayType = "default",
  detailedMetrics,
  metrics,
  unit = "files",
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const percentage = Math.round(progress);

  // Consolidate metrics
  const finalMetrics = detailedMetrics || metrics;

  // ---------------------------------------------------------
  // 1. THE "SIDEBAR" / GENERIC VIEW (Standardized)
  // ---------------------------------------------------------
  // This view is triggered when 'label' or 'status' is provided by ProgressTrackingTask
  if (label || status) {
    const isError = status === "Error" || status === "failed";
    const isSuccess =
      status === "Success" || status === "completed" || status === "Done";

    // Determine color based on status
    const statusColor = isError
      ? "text-red-600"
      : isSuccess
      ? "text-green-600"
      : "text-black";
    const barColor = isError
      ? "bg-red-500"
      : isSuccess
      ? "bg-green-500"
      : "bg-black";

    return (
      <div>
        <div className="mt-2 mb-4 w-full">
          <div className="flex justify-between items-center mb-1">
            {/* Label (e.g., "Uploading: Data/Folder1") */}
            <span
              className="text-xs font-semibold text-gray-700 truncate max-w-[70%]"
              title={label || title}
            >
              {label || title}
            </span>
            {/* Status (e.g., "UPLOADING 45%") */}
            <span className={`text-[10px] font-bold uppercase ${statusColor}`}>
              {status} {percentage}%
            </span>
          </div>

          {/* Progress Bar */}

          {/* Details (e.g., "45 / 100") */}
          {details && (
            <div className="text-[10px] text-gray-500 font-mono text-right">
              {details}
            </div>
          )}
        </div>
        <div className="w-full bg-gray-200 rounded-full h-1.5 mb-1">
          <div
            className={`h-1.5 rounded-full transition-all duration-300 ${barColor}`}
            style={{ width: `${percentage}%` }}
          ></div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------
  // 2. THE "SIMPLE" VIEW (For SQL/Mongo Task Lists)
  // ---------------------------------------------------------
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
            <span className="text-gray-900 font-mono">
              Processed: {processed?.toLocaleString()} /{" "}
              {total?.toLocaleString()}
            </span>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-gray-500 font-medium">Results</span>
            <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono">
              {finalMetrics?.folioUpdated !== undefined ? (
                <>
                  <span className="text-emerald-700 font-semibold">
                    Folios: {finalMetrics.folioUpdated}
                  </span>
                  <span className="text-blue-700 font-semibold">
                    Txns: {finalMetrics.txnUpdated}
                  </span>
                </>
              ) : finalMetrics?.inserted !== undefined ? (
                <span className="text-green-700 font-semibold">
                  Inserted: {finalMetrics.inserted?.toLocaleString()}
                </span>
              ) : (
                <span className="text-green-700 font-semibold">
                  Success: {successful?.toLocaleString()}
                </span>
              )}

              {(errors || 0) > 0 && (
                <span className="text-red-600 font-semibold">
                  Errors: {errors?.toLocaleString()}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------
  // 3. THE "AGGREGATE" VIEW (For Upload Headers)
  // ---------------------------------------------------------
  if (displayType === "aggregate") {
    return (
      <div className="mt-4 p-4 bg-gray-100 rounded-lg shadow-inner">
        <h4 className="font-semibold text-black mb-2">{title}</h4>

        <div className="w-full bg-gray-300 rounded-full h-3">
          <div
            className="bg-black h-3 rounded-full text-sm font-medium text-white text-center leading-6 transition-all duration-500 ease-out"
            style={{ width: `${percentage}%` }}
          ></div>
        </div>

        <div className="text-center mt-2 font-mono text-black text-sm grid grid-cols-3 gap-2">
          <div>
            <span className="font-bold">Total:</span> {total?.toLocaleString()}
          </div>
          <div className="text-green-700">
            <span className="font-bold">Success:</span>{" "}
            {successful?.toLocaleString()}
          </div>
          <div className="text-red-600">
            <span className="font-bold">Failed:</span>{" "}
            {((errors || 0) + (notFound || 0)).toLocaleString()}
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------
  // 4. THE "DETAILED" VIEW (Legacy Default)
  // ---------------------------------------------------------
  return (
    <div className="mt-4">
      <div className="flex justify-between items-center">
        <h5 className="font-semibold">{title}</h5>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-sm text-blue-600 hover:underline"
        >
          {isExpanded ? "Hide Details" : "Show Details"}
        </button>
      </div>

      {isExpanded && (
        <div className="bg-gray-100 p-2 rounded mt-2">
          <div className="w-full bg-gray-300 rounded-full h-4 mb-2">
            <div
              className="bg-black h-4 rounded-full text-xs font-medium text-white text-center p-0.5 leading-none transition-all duration-300"
              style={{ width: `${percentage}%` }}
            >
              {percentage}%
            </div>
          </div>
          <div className="text-sm grid grid-cols-2 gap-x-4 gap-y-1">
            <p>
              <strong>Total:</strong> {total}
            </p>
            <p>
              <strong>Processed:</strong> {processed}
            </p>
            <p className="text-green-700">
              <strong>Successful:</strong> {successful}
            </p>
            <p className="text-red-600">
              <strong>Errors:</strong> {errors}
            </p>
            <p className="text-orange-600">
              <strong>Not Found:</strong> {notFound}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProgressTrackingUI;
