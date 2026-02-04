import React from "react";
import { S3UploadSummaryUIProps } from "./s3ManagerType";

const S3UploadSummaryUI: React.FC<S3UploadSummaryUIProps> = ({
  title,
  s3UploadStatus,
  displayType = "default",
  unit = "files",
}) => {
  const percentage = Math.round(s3UploadStatus.progress || 0);

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
          {(s3UploadStatus.processedFiles || 0).toLocaleString()} / {(s3UploadStatus.totalFiles || 0).toLocaleString()}{" "}
          {unit} uploaded
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <h5 className="font-semibold">{title}</h5>
      <div className="bg-gray-100 p-2 rounded">
        {s3UploadStatus.progress !== undefined && (
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
          {s3UploadStatus.totalFiles !== undefined && (
            <p>
              <strong>Total:</strong> {s3UploadStatus.totalFiles}
            </p>
          )}
          {s3UploadStatus.processedFiles !== undefined && (
            <p>
              <strong>Processing:</strong> {s3UploadStatus.processedFiles}
            </p>
          )}
          {s3UploadStatus.successfulFiles !== undefined && (
            <p>
              <strong>Successful:</strong> {s3UploadStatus.successfulFiles}
            </p>
          )}
          {s3UploadStatus.errorFiles !== undefined && (
            <p>
              <strong>Errors:</strong> {s3UploadStatus.errorFiles}
            </p>
          )}
          {s3UploadStatus.errorMessage && (
            <p>
              <strong>Error:</strong> {s3UploadStatus.errorMessage}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default S3UploadSummaryUI;
