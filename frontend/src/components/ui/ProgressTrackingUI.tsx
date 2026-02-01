import React, { useState } from "react";

// [FIX] Explicitly define the props this UI component accepts
export interface ProgressTrackingUIProps {
  title: string;
  progress?: number;
  total?: number;
  processed?: number;
  successful?: number;
  errors?: number;
  notFound?: number;
  displayType?: "aggregate" | "default";
  unit?: string;
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
  unit = "files",
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const percentage = Math.round(progress);

  // 1. The "Summary Bar" View
  if (displayType === "aggregate") {
    return (
      <div className="mt-4 p-4 bg-gray-100 rounded-lg shadow-inner">
        <h4 className="font-semibold text-black mb-2">{title}</h4>

        {/* Progress Bar Container */}
        <div className="w-full bg-gray-300 rounded-full h-3">
          <div
            className="bg-black h-3 rounded-full text-sm font-medium text-white text-center leading-6 transition-all duration-500 ease-out"
            style={{ width: `${percentage}%` }}
          ></div>
        </div>

        {/* Stats Text */}
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

  // 2. The "Detailed/Expandable" View (Default)
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
