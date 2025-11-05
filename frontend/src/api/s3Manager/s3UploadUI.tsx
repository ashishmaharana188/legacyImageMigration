import React from "react";
import { S3UploadUIProps } from "./s3ManagerType";

const S3UploadUI: React.FC<S3UploadUIProps> = ({
  loading,
  handleUploadToS3,
  handleUploadSplitFilesToS3,
}) => {
  return (
    <div className="border border-gray-300 rounded-lg p-4 flex flex-col justify-between">
      <div>
        <h4 className="font-semibold text-lg text-black mb-3">
          S3 Upload
        </h4>
        <p className="text-sm text-gray-600 mb-4">
          Upload the original or split files to Amazon S3.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <button onClick={handleUploadToS3} className="btn w-full" disabled={loading}>
          {loading ? "Uploading..." : "Upload Original to S3"}
        </button>
        <button
          onClick={handleUploadSplitFilesToS3}
          className="btn w-full"
          disabled={loading}
        >
          {loading ? "Uploading..." : "Upload Split Files to S3"}
        </button>
      </div>
    </div>
  );
};

export default S3UploadUI;