import React, { useState } from "react";
import { S3UploadUIProps } from "./s3ManagerType";

const S3UploadUI: React.FC<S3UploadUIProps> = ({
  originalLoading,
  splitLoading,
  handleUploadToS3,
  handleUploadSplitFilesToS3,
}) => {
  const [localDir, setLocalDir] = useState<string>("");
  const [prefix, setPrefix] = useState<string>("Data/");

  const onUploadOriginal = () => {
    console.log(
      "🖱️ 'Upload Original' Clicked. Target Directory:",
      localDir || "(Default: output)"
    );
    handleUploadToS3(localDir, prefix);
  };

  const onUploadSplitFiles = () => {
    console.log(
      "🖱️ 'Upload Split Files' Clicked. Target Directory:",
      localDir || "(Default: split_output)"
    );
    handleUploadSplitFilesToS3(localDir, prefix);
  };

  return (
    <div className="border border-gray-300 rounded-lg p-4 flex flex-col justify-between">
      <div>
        <h4 className="font-semibold text-lg text-black mb-3">S3 Upload</h4>
        <p className="text-sm text-gray-600 mb-4">
          Upload the original or split files to Amazon S3.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <button
          onClick={onUploadOriginal}
          className="btn w-full"
          disabled={originalLoading}
        >
          {originalLoading ? "Uploading Original..." : "Upload Original to S3"}
        </button>

        <button
          onClick={onUploadSplitFiles}
          className="btn w-full"
          disabled={splitLoading}
        >
          {splitLoading ? "Uploading Splits..." : "Upload Split Files to S3"}
        </button>
      </div>
    </div>
  );
};

export default S3UploadUI;
