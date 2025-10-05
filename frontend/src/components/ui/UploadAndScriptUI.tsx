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
  handleFileChange,
  handleUpload,
  handleFallback,
  handleSplitFiles,
  handleSplitFilesWithMuPDF,
  handleUploadToS3,
  handleUploadSplitFilesToS3,
  loading,
}) => {
  return (
    <div className="p-4 bg-gray-50 rounded-lg">
      <h3 className="text-xl font-bold text-black mb-4">
        Upload and Script Operations
      </h3>

      <div className="mb-4">
        <input type="file" onChange={handleFileChange} className="form-input" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Upload and Process Section */}
        <div className="border border-gray-300 rounded-lg p-4 flex flex-col justify-between">
          <div>
            <h4 className="font-semibold text-lg text-black mb-3">
              Upload and Process
            </h4>
            <p className="text-sm text-gray-600 mb-4">
              Upload a file for processing and run a fallback check if needed.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <button
              onClick={handleUpload}
              disabled={loading || !selectedFile}
              className="btn w-full"
            >
              {loading ? "Uploading..." : "Upload and Process"}
            </button>
            <button
              onClick={handleFallback}
              disabled={loading || !selectedFile}
              className="btn w-full"
            >
              {loading ? "Running..." : "Run Fallback Check"}
            </button>
          </div>
        </div>

        {/* PDF Splitting Section */}
        <div className="border border-gray-300 rounded-lg p-4 flex flex-col justify-between">
          <div>
            <h4 className="font-semibold text-lg text-black mb-3">
              PDF Splitting
            </h4>
            <p className="text-sm text-gray-600 mb-4">
              Split the uploaded PDF into individual pages using different
              methods.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <button
              onClick={handleSplitFiles}
              disabled={loading}
              className="btn w-full"
            >
              {loading ? "Splitting..." : "Split PDF"}
            </button>
            <button
              onClick={handleSplitFilesWithMuPDF}
              disabled={loading}
              className="btn w-full"
            >
              {loading ? "Splitting..." : "Split with MuPDF"}
            </button>
          </div>
        </div>

        {/* S3 Upload Section */}
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
            <button onClick={handleUploadToS3} className="btn w-full">
              Upload Original to S3
            </button>
            <button
              onClick={handleUploadSplitFilesToS3}
              className="btn w-full"
            >
              Upload Split Files to S3
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
export default UploadAndScriptUI;
