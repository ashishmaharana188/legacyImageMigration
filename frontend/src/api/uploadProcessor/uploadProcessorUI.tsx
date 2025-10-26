import React from "react";
import {uploadProcessorUIProps} from "./uploadProcessorType"



const UploadProcessorUI: React.FC<uploadProcessorUIProps> = ({
  selectedFile,
  uploadMessage,
  loading,
  isUploading,
  handleFileChange,
  handleUpload,
  handleFallback,
}) => {

  return (
    <div className="p-4 bg-gray-50 rounded-lg">
      <h3 className="text-xl font-bold text-black mb-4">
        Upload and Script Operations
      </h3>

      <div className="mb-4">
        <input type="file" onChange={handleFileChange} className="form-input" />
      </div>

      <div className="mt-4">
        {uploadMessage && <p className="text-blue-500">{uploadMessage}</p>}

      </div>

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
            disabled={loading || !selectedFile || isUploading}
            className="btn w-full"
          >
            {loading ? "Uploading..." : "Upload and Process"}
          </button>
          <button
            onClick={handleFallback}
            disabled={loading || !selectedFile || isUploading}
            className="btn w-full"
          >
            {loading ? "Running..." : "Run Fallback Check"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UploadProcessorUI;
