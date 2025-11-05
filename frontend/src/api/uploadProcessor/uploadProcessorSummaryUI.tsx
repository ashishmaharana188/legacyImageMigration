import React from "react";
import {UploadProcessDisplayProps} from "./uploadProcessorType";


export const UploadProcessDisplay: React.FC<UploadProcessDisplayProps> = ({
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
  const percentage = Math.round(progress);

  if (displayType === "aggregate") {
    return (
      <div className="mt-4 p-4 bg-gray-100 rounded-lg shadow-inner">
        <h4 className="font-semibold text-black mb-2">{title}</h4>
        <div className="w-full bg-gray-300 rounded-full h-6">
          <div
            className="bg-black h-6 rounded-full text-lg font-medium text-white text-center leading-6"
            style={{ width: `${percentage}%` }}
          >
            {percentage}%
          </div>
        </div>
        <div className="text-center mt-2 font-mono text-black">
          {(processed || 0).toLocaleString()} / {(total || 0).toLocaleString()}{" "}
          {unit} uploaded
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <h5 className="font-semibold">{title}</h5>
      <div className="bg-gray-100 p-2 rounded">
        {progress !== undefined && (
          <div className="w-full bg-gray-300 rounded-full h-4 mb-2">
            <div
              className="bg-black h-4 rounded-full text-xs font-medium text-white text-center p-0.5 leading-none"
              style={{ width: `${percentage}%` }}
            >
              {percentage}%
            </div>
          </div>
        )}
        <div className="text-sm">
          {total !== undefined && (
            <p>
              <strong>Total:</strong> {total}
            </p>
          )}
          {processed !== undefined && (
            <p>
              <strong>Processing:</strong> {processed}
            </p>
          )}
          {successful !== undefined && (
            <p>
              <strong>Successful:</strong> {successful}
            </p>
          )}
          {errors !== undefined && (
            <p>
              <strong>Errors:</strong> {errors}
            </p>
          )}
          {notFound !== undefined && (
            <p>
              <strong>Not Found:</strong> {notFound}
            </p>
          )}
        </div>
        {badRowsDetails && badRowsDetails.length > 0 && (
          <div className="mt-2">
            <h6 className="font-semibold">Bad Rows Details:</h6>
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase bg-gray-50">
                <tr>
                  <th scope="col" className="px-2 py-1">
                    IH No
                  </th>
                  <th scope="col" className="px-2 py-1">
                    AC No
                  </th>
                  <th scope="col" className="px-2 py-1">
                    Reason
                  </th>
                </tr>
              </thead>
              <tbody>
                {badRowsDetails.map((row, index) => (
                  <tr key={index} className="bg-white border-b">
                    <td className="px-2 py-1">{row.id_ihno}</td>
                    <td className="px-2 py-1">{row.id_acno}</td>
                    <td className="px-2 py-1">{row.page_count_status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
