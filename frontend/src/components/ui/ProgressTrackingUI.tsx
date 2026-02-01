import React, { useState } from "react";

export interface ProgressTrackingUIProps {
  title: string;
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
    inserted?: number; // [NEW]
  };
  badRowsDetails?: Array<{
    id_ihno: string;
    id_acno: string;
    page_count_status: string | number;
  }>;
}

const ProgressTrackingUI: React.FC<ProgressTrackingUIProps> = ({
  title,
  progress = 0,
  total,
  processed,
  successful,
  errors,
  notFound,
  badRowsDetails,
  displayType = "default",
  detailedMetrics,
  unit = "files",
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const percentage = Math.round(progress);

  // 1. The "Simple" View (For SQL/Mongo Live Tasks)
  if (displayType === "simple") {
    return (
      <div className="mt-4 border border-gray-200 rounded p-3 bg-white shadow-sm">
        <div className="flex justify-between items-center mb-2">
          <h4 className="font-semibold text-sm text-gray-800">{title}</h4>
          <span className="text-xs font-mono text-gray-500">{percentage}%</span>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-2.5 mb-3">
          <div
            className={`h-2.5 rounded-full transition-all duration-300 ease-out ${
              (errors || 0) > 0 ? "bg-orange-500" : "bg-black"
            }`}
            style={{ width: `${percentage}%` }}
          ></div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div className="flex flex-col gap-1">
            <span className="text-gray-500 font-medium">CSV Processing</span>
            <span className="text-gray-900 font-mono">
              Processed: {processed?.toLocaleString()} /{" "}
              {total?.toLocaleString()}
            </span>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-gray-500 font-medium">DB Results</span>
            <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono">
              {/* Case 1: Folio Update Task */}
              {detailedMetrics?.folioUpdated !== undefined ? (
                <>
                  <span className="text-emerald-700 font-semibold">
                    Folios: {detailedMetrics.folioUpdated}
                  </span>
                  <span className="text-blue-700 font-semibold">
                    Txns: {detailedMetrics.txnUpdated}
                  </span>
                </>
              ) : detailedMetrics?.inserted !== undefined ? (
                /* Case 2: Execute SQL Task */
                <span className="text-green-700 font-semibold">
                  Inserted: {detailedMetrics.inserted?.toLocaleString()}
                </span>
              ) : (
                /* Case 3: Default Success */
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

  // 2. The "Aggregate" View (For Upload Headers)
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

  // 3. The "Detailed" View (Default)
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

          {badRowsDetails && badRowsDetails.length > 0 && (
            <div className="mt-2">
              <h6 className="font-semibold text-xs uppercase text-gray-500 mb-1">
                Error Details:
              </h6>
              <div className="max-h-32 overflow-y-auto border rounded bg-white">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs uppercase bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-2 py-1">IH No</th>
                      <th className="px-2 py-1">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {badRowsDetails.map((row, index) => (
                      <tr
                        key={index}
                        className="border-b last:border-0 hover:bg-gray-50"
                      >
                        <td className="px-2 py-1 font-mono">{row.id_ihno}</td>
                        <td className="px-2 py-1 text-red-600">
                          {row.page_count_status}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProgressTrackingUI;
