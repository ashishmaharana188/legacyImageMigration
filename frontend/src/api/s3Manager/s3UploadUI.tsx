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
        <div className="mb-4">
          <label
            htmlFor="localDir"
            className="block text-sm font-medium text-gray-700"
          >
            Local Directory
          </label>
          <input
            type="text"
            id="localDir"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            value={localDir}
            onChange={(e) => setLocalDir(e.target.value)}
            placeholder="Leave empty for defaults (Original=output, Split=split_output)"
          />
          <p className="text-xs text-gray-500 mt-1">
            ⚠️ If you enter a path here, it overrides the default source folder
            for BOTH buttons.
          </p>
        </div>
        <div className="mb-4">
          <label
            htmlFor="prefix"
            className="block text-sm font-medium text-gray-700"
          >
            S3 Prefix
          </label>
          <input
            type="text"
            id="prefix"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            value={prefix}
            onChange={(e) => setPrefix(e.target.value)}
            placeholder="e.g., Data/"
          />
        </div>
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
