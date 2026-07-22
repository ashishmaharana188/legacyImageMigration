import React, { useRef } from "react";

interface MasterMigrationUIProps {
  selectedFile: File | null;
  uploadStatus: string;
  handleFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleUpload: () => void;
  handleETL: () => void;
}

const MasterMigrationUI: React.FC<MasterMigrationUIProps> = ({
  selectedFile,
  uploadStatus,
  handleFileChange,
  handleUpload,
  handleETL,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6">
      <h1 className="text-4xl font-bold mb-6">CHECK</h1>
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden" // Hide the native file input
        />
        <div
          onClick={handleButtonClick}
          className="block w-full text-sm text-gray-500 cursor-pointer
            py-2 px-4 rounded-lg border border-gray-300 bg-gray-50
            hover:bg-gray-100 flex items-center justify-between"
        >
          <span className="truncate">
            {selectedFile ? selectedFile.name : "No file chosen"}
          </span>
          <span className="ml-2 py-1 px-3 rounded-full bg-[#212427] text-white text-xs font-semibold">
            Browse
          </span>
        </div>
        <button
          onClick={() => {
            handleUpload();
            handleETL();
          }}
          disabled={!selectedFile}
          className={`mt-4 w-full bg-[#212427] text-white py-2 px-4 rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed ${
            !selectedFile ? "disabled:opacity-50" : ""
          }`}
        >
          Upload and Check
        </button>
        {uploadStatus && (
          <p
            className="mt-4 text-center text-sm text-gray-700"
            style={{ whiteSpace: "pre-wrap" }}
          >
            {uploadStatus}
          </p>
        )}
      </div>
    </div>
  );
};

export default MasterMigrationUI;
