import React from "react";
import dayjs from "dayjs";
import { SanityCheckUIProps } from "./sanityCheckType";

const SanityCheckUI: React.FC<SanityCheckUIProps> = ({
  handlePgSanityCheck,
  handleMongoSanityCheck,
  isDeleteEnabled,
  setIsDeleteEnabled,
  normalize,
  setNormalize,
  cutoffDate,
  setCutoffDate,
  clientCode,
  setClientCode,
  isLoadingPg,
  isLoadingMongo,
  duplicateMongoCheckResult,
  isMongoDeleteEnabled,
  setIsMongoDeleteEnabled,
}) => {
  return (
    <div className="p-4 mt-2 border rounded">
      <h3 className="text-xl font-bold text-black mb-4">
        Sanity Check for Duplicates
      </h3>
      <div className="flex flex-col gap-4">
        <input
          type="date"
          value={cutoffDate ? cutoffDate.format("YYYY-MM-DD") : ""}
          onChange={(e) => setCutoffDate(dayjs(e.target.value))}
          disabled={isLoadingPg || isLoadingMongo}
          className="p-2 border rounded"
        />
        <input
          type="text"
          placeholder="Enter Client Code (optional)"
          value={clientCode}
          onChange={(e) => setClientCode(e.target.value)}
          disabled={isLoadingPg || isLoadingMongo}
          className="p-2 border rounded"
        />

        {/* PostgreSQL Duplicate Check */}
        <div className="mt-4 p-2 border rounded">
          <h4 className="font-semibold mb-2">PostgreSQL Duplicates</h4>
          <label>
            <input
              type="checkbox"
              className="form-checkbox"
              checked={normalize}
              onChange={(e) => setNormalize(e.target.checked)}
              disabled={isLoadingPg || isLoadingMongo}
            />
            <span className="ml-2">Normalize keys for comparison</span>
          </label>
          <button
            onClick={() => handlePgSanityCheck(true)}
            disabled={isLoadingPg || isLoadingMongo}
            className="btn mt-2 ml-2"
          >
            {isLoadingPg ? "Checking" : "PG Duplicate"}
          </button>
          <label className="block mt-2">
            <input
              type="checkbox"
              className="form-checkbox"
              checked={isDeleteEnabled}
              onChange={(e) => setIsDeleteEnabled(e.target.checked)}
              disabled={isLoadingPg || isLoadingMongo}
            />
            <span className="ml-2">Enable Deletion Mode (PG)</span>
          </label>
          {isDeleteEnabled && (
            <button
              onClick={() => handlePgSanityCheck(false)}
              disabled={isLoadingPg || isLoadingMongo}
              className="btn-danger mt-2"
            >
              {isLoadingPg ? "Deleting" : "Delete Duplicates"}
            </button>
          )}
        </div>

        {/* MongoDB Duplicate Check */}
        <div className="mt-4 p-2 border rounded">
          <h4 className="font-semibold mb-2">MongoDB Duplicates</h4>
          <button
            onClick={() => handleMongoSanityCheck(true)}
            disabled={isLoadingPg || isLoadingMongo}
            className="btn"
          >
            {isLoadingMongo ? "Checking" : "Mongo Duplicate"}
          </button>
          <label className="block mt-2">
            <input
              type="checkbox"
              className="form-checkbox"
              checked={isMongoDeleteEnabled}
              onChange={(e) => setIsMongoDeleteEnabled(e.target.checked)}
              disabled={isLoadingPg || isLoadingMongo}
            />
            <span className="ml-2">Enable Deletion Mode (Mongo)</span>
          </label>
          {isMongoDeleteEnabled && (
            <button
              onClick={() => handleMongoSanityCheck(false)}
              disabled={isLoadingPg || isLoadingMongo}
              className="btn-danger mt-2"
            >
              {isLoadingMongo ? "Deleting" : "Delete Duplicates"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SanityCheckUI;
