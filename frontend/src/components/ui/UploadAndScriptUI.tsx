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
      <div className="mt-4">
        <button onClick={handleUploadSplitFilesToS3} className="btn">
          Upload Split Files to S3
        </button>
        <button onClick={handleUploadToS3} className="btn ml-10">
          Upload Original to S3
        </button>
      </div>
    </div>
  );
};

export default UploadAndScriptUI;
