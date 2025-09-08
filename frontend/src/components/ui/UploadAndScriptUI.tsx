import React from "react";

interface UploadAndScriptUIProps {
  selectedFile: File | null;
  uploadMessage: string;
  splitMessage: string;
  splitFiles: string[];
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
      <div>
        <input type="file" onChange={handleFileChange} />
        <button onClick={handleUpload} disabled={loading || !selectedFile}>
          {loading ? "Uploading..." : "Upload PDF"}
        </button>
        {uploadMessage && <p>{uploadMessage}</p>}
      </div>
      <div>
        <button onClick={handleSplitFiles} disabled={loading || !selectedFile}>
          {loading ? "Splitting..." : "Split PDF"}
        </button>
        {splitMessage && <p>{splitMessage}</p>}
        {splitFiles.length > 0 && (
          <div>
            <h4>Split Files:</h4>
            <ul>
              {splitFiles.map((file, index) => (
                <li key={index}>{file}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default UploadAndScriptUI;
