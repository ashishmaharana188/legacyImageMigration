import React from "react";

// The error log said "Did you mean 'UploadProcessDisplay'?" - So we export it as that.
export const UploadProcessDisplay: React.FC<any> = ({
  title,
  progress,
  total,
  processed,
  successful,
  errors,
  notFound,
  unit,
}) => {
  return (
    <div className="p-4 bg-gray-100 rounded-lg shadow-inner mb-4">
      <h4 className="font-semibold text-black mb-2">{title}</h4>
      <div className="w-full bg-gray-300 rounded-full h-4 mb-2">
        <div
          className="bg-black h-4 rounded-full text-xs font-medium text-white text-center p-0.5 leading-none"
          style={{ width: `${Math.round(progress || 0)}%` }}
        >
          {Math.round(progress || 0)}%
        </div>
      </div>
      <div className="text-sm grid grid-cols-2 gap-2">
        <div>
          <strong>Total:</strong> {total}
        </div>
        <div>
          <strong>Processed:</strong> {processed}
        </div>
        <div className="text-green-700">
          <strong>Success:</strong> {successful}
        </div>
        <div className="text-red-600">
          <strong>Errors:</strong> {errors}
        </div>
        <div>
          <strong>Not Found:</strong> {notFound}
        </div>
      </div>
    </div>
  );
};

// Also ensuring this is exported, as it was missing in the error log
export const BadRowsDetailsTable: React.FC<{ parsedBadRows: any[] }> = ({
  parsedBadRows,
}) => {
  if (!parsedBadRows || parsedBadRows.length === 0) return null;
  return (
    <div className="overflow-x-auto mt-2">
      <table className="min-w-full text-xs text-left text-gray-500">
        <thead className="text-xs text-gray-700 uppercase bg-gray-100">
          <tr>
            {Object.keys(parsedBadRows[0]).map((key) => (
              <th key={key} className="px-2 py-1">
                {key}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {parsedBadRows.map((row, i) => (
            <tr key={i} className="bg-white border-b">
              {Object.values(row).map((val: any, j) => (
                <td key={j} className="px-2 py-1">
                  {val}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
