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
  handleFallback: () => Promise<void>;
  handleSplitFiles: () => Promise<void>;
  handleSplitFilesWithMuPDF: () => Promise<void>;
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
  handleFallback,
  handleSplitFiles,
  handleSplitFilesWithMuPDF,
}) => {
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
          {loading ? "Uploading..." : "Upload and Process"}
        </button>

        <button
          onClick={handleFallback}
          disabled={loading || !selectedFile}
          className="btn ml-2"
        >
          {loading ? "Running..." : "Run Fallback Check"}
        </button>

        <button
          onClick={handleSplitFiles}
          disabled={loading}
          className="btn ml-29.5"
        >
          {loading ? "Splitting..." : "Split PDF"}
        </button>
        <button
          onClick={handleSplitFilesWithMuPDF}
          disabled={loading}
          className="btn ml-2"
        >
          {loading ? "Splitting..." : "Split with MuPDF"}
        </button>
      </div>

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
