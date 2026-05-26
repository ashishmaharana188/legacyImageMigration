import React, { useState } from "react";
import { S3UploadUIProps } from "./s3ManagerType";

const S3UploadUI: React.FC<S3UploadUIProps> = ({
  originalLoading,
  splitLoading,
  uploadStatuses = [],
  handleUploadToS3,
  handleUploadSplitFilesToS3,
}) => {
  const [localDir] = useState<string>("");
  const [prefix] = useState<string>("Data/");
  const [folderConcurrency, setFolderConcurrency] = useState(4);
  const [fileBatchSize, setFileBatchSize] = useState(15);

  const aggregateStatuses = uploadStatuses.filter(
    (status) =>
      status.fileName === "Original File" || status.fileName === "Split Files",
  );
  const folderStatuses = uploadStatuses.filter((status) => status.folderId);

  const uploadOptions = {
    folderConcurrency,
    fileBatchSize,
  };

  const onUploadOriginal = () => {
    handleUploadToS3(localDir, prefix, uploadOptions);
  };

  const onUploadSplitFiles = () => {
    handleUploadSplitFilesToS3(localDir, prefix, uploadOptions);
  };

  return (
    <div className="border border-gray-300 rounded-lg p-4 flex flex-col gap-4">
      <div>
        <h4 className="font-semibold text-lg text-black mb-3">S3 Upload</h4>
        <p className="text-sm text-gray-600 mb-4">
          Upload multiple client folders in parallel while tracking each folder.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="text-sm text-black">
          Folder concurrency
          <input
            type="number"
            min={1}
            max={8}
            value={folderConcurrency}
            onChange={(event) =>
              setFolderConcurrency(Number(event.target.value))
            }
            className="mt-1 w-full px-3 py-2 border rounded"
            disabled={originalLoading || splitLoading}
          />
        </label>
        <label className="text-sm text-black">
          Files per folder batch
          <input
            type="number"
            min={1}
            max={50}
            value={fileBatchSize}
            onChange={(event) => setFileBatchSize(Number(event.target.value))}
            className="mt-1 w-full px-3 py-2 border rounded"
            disabled={originalLoading || splitLoading}
          />
        </label>
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

      {aggregateStatuses.length > 0 && (
        <div className="border-t pt-3">
          <h5 className="font-semibold text-black mb-2">Overall Uploads</h5>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {aggregateStatuses.map((status) => (
              <div
                key={status.fileName}
                className="border rounded p-2 bg-gray-50 text-sm"
              >
                <div className="flex justify-between mb-1">
                  <span className="font-medium">{status.fileName}</span>
                  <span>{Math.round(status.progress || 0)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                  <div
                    className="bg-black h-2 rounded-full"
                    style={{ width: `${Math.round(status.progress || 0)}%` }}
                  />
                </div>
                <div className="text-gray-700">
                  {status.processedFiles || 0} / {status.totalFiles || 0}{" "}
                  folders
                  {typeof status.successfulFiles === "number" && (
                    <span>
                      {" "}
                      | files: {status.successfulFiles} ok,{" "}
                      {status.errorFiles || 0} failed
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {folderStatuses.length > 0 && (
        <div className="border-t pt-3">
          <h5 className="font-semibold text-black mb-2">
            Folder Upload Tracking
          </h5>
          <div className="max-h-72 overflow-auto border rounded">
            {folderStatuses.map((status) => (
              <div
                key={status.folderId}
                className="p-2 border-b last:border-b-0 text-sm"
              >
                <div className="flex justify-between gap-3">
                  <span className="font-medium truncate">
                    {status.fileName}
                  </span>
                  <span className="shrink-0">{status.status}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 my-2">
                  <div
                    className="bg-black h-2 rounded-full"
                    style={{ width: `${Math.round(status.progress || 0)}%` }}
                  />
                </div>
                <div className="text-gray-700">
                  {status.processedDirectories || 0} /{" "}
                  {status.totalDirectories || 0} subfolders | files:{" "}
                  {status.successfulFiles || 0} ok, {status.errorFiles || 0}{" "}
                  failed
                </div>
                {status.currentDirectory && (
                  <div className="text-gray-500 truncate">
                    {status.currentDirectory}
                  </div>
                )}
                {status.errorMessage && (
                  <div className="text-red-600">{status.errorMessage}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default S3UploadUI;
