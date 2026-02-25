// frontend/src/api/uploadProcessor/uploadProcessorUI.tsx
import React from "react";
import { uploadProcessorUIProps } from "./uploadProcessorType";

const UploadProcessorUI: React.FC<uploadProcessorUIProps> = ({
  selectedFile,
  uploadMessage,
  loading,
  isUploading,
  handleFileChange,
  handleUpload,
  handleFallback,
  athenaQuery = "", // Default to empty string to prevent undefined crashes
  athenaResults,
  athenaError,
  setAthenaQuery,
  handleRunAthena,
  downloadAthenaCsv,
}) => {
  // Safe disabled check: button is only clickable if there is actual text
  const isRunQueryDisabled = loading || isUploading || athenaQuery.trim() === "";

  return (
    <div className="p-4 bg-gray-50 rounded-lg">
      <h3 className="text-xl font-bold text-black mb-4">
        Upload and Script Operations
      </h3>

      {/* --- 1. SQL EDITOR SECTION --- */}
      <div className="border border-gray-300 rounded-lg p-4 flex flex-col justify-between mb-6 bg-white shadow-sm">
        <div>
          <h4 className="font-semibold text-lg text-black mb-2">
            Step 1: Extract Data (AWS Athena Editor)
          </h4>
          <p className="text-sm text-gray-600 mb-4">
            Run a SQL query. If successful, download the CSV to automatically queue it for processing.
          </p>
        </div>

        <textarea
          className="form-input mb-3 h-32 p-3 text-sm font-mono border border-gray-300 rounded w-full bg-gray-900 text-green-400 focus:ring-2 focus:ring-blue-500"
          value={athenaQuery}
          onChange={(e) => setAthenaQuery && setAthenaQuery(e.target.value)}
          placeholder='SELECT * FROM "database"."table" LIMIT 100;'
          spellCheck={false}
        />

        <button
          onClick={handleRunAthena}
          disabled={isRunQueryDisabled}
          className="btn w-full mb-2"
        >
          {loading ? "Executing Query..." : "Run Query"}
        </button>

        {/* ERROR DISPLAY */}
        {athenaError && (
          <div className="mt-2 p-3 bg-red-50 border border-red-300 rounded text-red-700 text-sm">
            <span className="font-bold block mb-1">Query Error:</span>
            <span className="font-mono whitespace-pre-wrap">{athenaError}</span>
          </div>
        )}

        {/* SUCCESS DISPLAY & DOWNLOAD BUTTON */}
        {athenaResults && (
          <div className="mt-2 p-3 bg-green-50 border border-green-300 rounded flex flex-col items-center">
            <p className="text-green-800 font-semibold mb-3">Query Executed Successfully!</p>
            <button
              onClick={downloadAthenaCsv}
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded w-full transition-colors shadow"
            >
              Download CSV & Queue for Processing
            </button>
          </div>
        )}
      </div>

      {/* --- 2. UPLOAD & PROCESS SECTION --- */}
      <div className="border border-gray-300 rounded-lg p-4 flex flex-col justify-between bg-white shadow-sm">
        <div>
          <h4 className="font-semibold text-lg text-black mb-2">
            Step 2: Upload and Process
          </h4>
          <p className="text-sm text-gray-600 mb-4">
            The downloaded Athena file will appear here automatically. You can also manually browse for an Excel or CSV file.
          </p>
        </div>

        {/* Manual File Input */}
        <div className="mb-4">
          <input
            type="file"
            onChange={handleFileChange}
            accept=".csv, .xlsx, .xls"
            className="form-input w-full p-2 border border-gray-300 rounded cursor-pointer"
          />
        </div>

        {/* Visual confirmation of the loaded file */}
        {selectedFile && (
          <div className="mb-4 p-2 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800 font-medium">
            📁 File loaded: {selectedFile.name}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <button
            onClick={handleUpload}
            disabled={loading || !selectedFile || isUploading}
            className="btn w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Processing..." : "Upload and Process"}
          </button>
          <button
            onClick={handleFallback}
            disabled={loading || !selectedFile || isUploading}
            className="btn w-full disabled:opacity-50 disabled:cursor-not-allowed bg-gray-600 hover:bg-gray-700"
          >
            {loading ? "Running..." : "Run Fallback Check"}
          </button>
        </div>
      </div>

      {/* Global Status Message */}
      {uploadMessage && (
        <div className="mt-4 p-3 bg-indigo-50 text-indigo-800 rounded border border-indigo-200 font-medium shadow-sm">
          {uploadMessage}
        </div>
      )}
    </div>
  );
};

export default UploadProcessorUI;
