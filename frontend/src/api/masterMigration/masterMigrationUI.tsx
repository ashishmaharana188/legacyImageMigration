import { Input } from "@mui/material";
import React, { useRef } from "react";

interface MasterMigrationUIProps {
  selectedFile: File | null;
  uploadStatus: string;
  migrationType: string;
  masterType: string;
  clientCode: string;
  fundCode: string;
  pushToMongo: boolean;
  setClientCode: React.Dispatch<React.SetStateAction<string>>;
  setFundCode: React.Dispatch<React.SetStateAction<string>>;
  setMigrationType: React.Dispatch<React.SetStateAction<string>>;
  setMasterType: React.Dispatch<React.SetStateAction<string>>;
  setPushToMongo: React.Dispatch<React.SetStateAction<boolean>>;
  handleFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleUpload: () => void;
  handleETL: () => void;
}

const MasterMigrationUI: React.FC<MasterMigrationUIProps> = ({
  selectedFile,
  uploadStatus,
  migrationType,
  masterType,
  clientCode,
  fundCode,
  setClientCode,
  setFundCode,
  setMigrationType,
  setMasterType,
  pushToMongo,
  setPushToMongo,
  handleFileChange,
  handleUpload,
  handleETL,
}) => {
  const isUploadMigration = migrationType === "Staging-Upsert-Mongo";

  const isETLMigration = migrationType === "Master-Staging-Mongo";

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <div
          className="block text-sm text-gray-500 cursor-pointer
            py-2 mt-5 px-4 rounded-lg border border-gray-300 bg-gray-50
            hover:bg-gray-100 flex items-center justify-between"
        >
          <select
            value={migrationType}
            onChange={(e) => setMigrationType(e.target.value)}
            className="w-full bg-transparent outline-none"
          >
            <option value="">Select Migration Type</option>
            <option value="Staging-Upsert-Mongo">Staging-Upsert-Mongo</option>
            <option value="Master-Staging-Mongo">Master-Staging-Mongo</option>
          </select>
        </div>

        {(isUploadMigration || isETLMigration) && (
          <label className="flex items-center mt-5">
            <input
              type="checkbox"
              checked={pushToMongo}
              onChange={(e) => setPushToMongo(e.target.checked)}
            />
            <span className="ml-2">Transfer to Mongo</span>
          </label>
        )}
        {isUploadMigration && (
          <>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden" // Hide the native file input
            />
            <div
              onClick={handleButtonClick}
              className="block w-full text-sm text-gray-500 cursor-pointer
            py-2 px-4 rounded-lg border border-gray-300 mt-5 bg-gray-50
            hover:bg-gray-100 flex items-center justify-between"
            >
              <span className="truncate">
                {selectedFile ? selectedFile.name : "No file chosen"}
              </span>
              <span className="ml-2 py-1 px-3 rounded-full bg-[#212427] text-white text-xs font-semibold">
                Browse
              </span>
            </div>
          </>
        )}
        <div
          className="block text-sm text-gray-500 cursor-pointer
            py-2 mt-5 px-4 rounded-lg border border-gray-300 bg-gray-50
            hover:bg-gray-100 flex items-center justify-between"
        >
          <select
            value={masterType}
            onChange={(e) => setMasterType(e.target.value)}
            className="w-full bg-transparent outline-none"
          >
            <option value="">Select Master Type</option>
            <option value="client_master">Client Master</option>
            <option value="fund_scheme_master">Fund Master</option>
            <option value="class_plan_master">Class Master</option>
            <option value="plan_master">Plan Master</option>
            <option value="bank_master">Bank Master</option>
            <option value="contact_master">Contact Master</option>
            <option value="load_master">Load Master</option>
          </select>
        </div>

        {isETLMigration && (
          <div
            className="block text-sm text-gray-500 cursor-pointer
            py-2 mt-5 px-4 rounded-lg border border-gray-300 bg-gray-50
            hover:bg-gray-100 flex items-center justify-between"
          >
            <input
              type="text"
              value={clientCode}
              onChange={(e) => setClientCode(e.target.value)}
              placeholder="Enter Client Code"
              className="w-full bg-transparent outline-none py-2 px-3 border rounded"
            />
            <input
              type="text"
              value={fundCode}
              onChange={(e) => setFundCode(e.target.value)}
              placeholder="Enter Fund Code"
              className="w-full ml-5 bg-transparent outline-none py-2 px-3 border rounded"
            />
          </div>
        )}

        <button
          onClick={() => {
            if (isUploadMigration) {
              handleUpload();
            } else if (isETLMigration) {
              handleETL();
            }
          }}
          disabled={
            (isUploadMigration && !selectedFile) ||
            (isETLMigration && !clientCode.trim())
          }
          className={`mt-4 w-full bg-[#212427] text-white py-2 px-4 rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed ${
            !selectedFile ? "disabled:opacity-50" : ""
          }`}
        >
          {isUploadMigration ? "Upload and Check" : "Run ETL"}
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
