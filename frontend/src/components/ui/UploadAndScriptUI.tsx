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
  handleFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleUpload: () => Promise<void>;
  handleSplitFiles: () => Promise<void>;
}

const UploadAndScriptUI: React.FC<UploadAndScriptUIProps> = ({
  selectedFile,
  uploadMessage,
  splitMessage,
  splitFiles,
  loading,
  handleFileChange,
  handleUpload,
  handleSplitFiles,
}) => {
  return (
    <div>
      <div className="mb-4">
        <input type="file" onChange={handleFileChange} />
        <button onClick={handleUpload} disabled={loading || !selectedFile} className="btn">
          {loading ? "Uploading..." : "Upload PDF"}
        </button>
        {uploadMessage && <p>{uploadMessage}</p>}
      </div>
      <div>
        <button onClick={handleSplitFiles} disabled={loading} className="btn">
          {loading ? "Splitting..." : "Split PDF"}
        </button>
        {splitMessage && <p>{splitMessage}</p>}
      </div>
    </div>
  );
};

export default UploadAndScriptUI;
