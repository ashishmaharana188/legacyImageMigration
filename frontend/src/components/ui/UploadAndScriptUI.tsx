import React from "react";

interface SplitFile {
  originalPath: string;
  url: string;
  page: number;
}

interface UploadAndScriptUIProps {
  selectedFile: File | null;
  uploadMessage: string;
  splitMessage: string;
  splitFiles: SplitFile[];
  loading: boolean;
  handleUploadSplitFilesToS3: () => Promise<void>;
  handleUploadToS3: () => Promise<void>;
  handleFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleUpload: () => Promise<void>;
  handleSplitFiles: () => Promise<void>;
  progressData: any; // { totalRows, processedRows, successfulRows, errors, notFound }
  badRowsDetails: any[]; // { rowNumber, id_acno, id_ihno, page_count_status }
}

const UploadAndScriptUI: React.FC<UploadAndScriptUIProps> = ({
  selectedFile,
  uploadMessage,
  splitMessage,
  splitFiles,
  handleUploadSplitFilesToS3,
  handleUploadToS3,
  loading,
  handleFileChange,
  handleUpload,
  handleSplitFiles,
  progressData,
  badRowsDetails,
}) => {
  const progress =
    progressData && progressData.totalRows > 0
      ? (progressData.processedRows / progressData.totalRows) * 100
      : 0;

  return (
    <div>
      <div className="mb-4">
        <input type="file" onChange={handleFileChange} />
      </div>
      <div>
        <button
          onClick={handleUpload}
          disabled={loading || !selectedFile}
          className="btn"
        >
          {loading ? "Uploading..." : "Upload PDF"}
        </button>

        <button
          onClick={handleSplitFiles}
          disabled={loading}
          className="btn ml-29.5"
        >
          {loading ? "Splitting..." : "Split PDF"}
        </button>
        {splitMessage && <p>{splitMessage}</p>}
      </div>

      {progressData && (
        <div className="mt-4">
          <h3>Processing Progress:</h3>
          <div
            style={{
              width: "100%",
              backgroundColor: "#e0e0e0",
              borderRadius: "5px",
            }}
          >
            <div
              style={{
                width: `${progress}%`,
                backgroundColor: "#76c7c0",
                height: "20px",
                borderRadius: "5px",
                textAlign: "center",
                color: "white",
                lineHeight: "20px",
              }}
            >
              {progress.toFixed(2)}%
            </div>
          </div>
          <p>Total Rows: {progressData.totalRows}</p>
          <p>Processed Rows: {progressData.processedRows}</p>
          <p>Successful Rows: {progressData.successfulRows}</p>
          <p>Errors: {progressData.errors}</p>
          <p>Not Found: {progressData.notFound}</p>
        </div>
      )}

      {badRowsDetails.length > 0 && (
        <div className="mt-4">
          <h3>Bad Rows Details:</h3>
          <ul>
            {badRowsDetails.map((row, index) => (
              <li key={index}>
                Row {row.rowNumber}: ACNO: {row.id_acno}, IHNO: {row.id_ihno},
                Status: {row.page_count_status}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4">
        <button onClick={handleUploadToS3} className="btn">
          Upload Original to S3
        </button>
        <button onClick={handleUploadSplitFilesToS3} className="btn ml-10">
          Upload Split Files to S3
        </button>
      </div>
    </div>
  );
};
export default UploadAndScriptUI;
