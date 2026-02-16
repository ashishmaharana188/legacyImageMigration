import React from "react";
import { MongoTaskUIProps } from "./mongoTaskType";

const MongoTaskUI: React.FC<MongoTaskUIProps> = ({
  loading,
  clientCode,
  useCsv,
  setClientCode,
  setUseCsv, // [FIX] This was missing!
  handleTransferToMongo,
}) => {
  const isDirectModeInvalid = !useCsv && !clientCode;

  return (
    <div className="border border-gray-300 rounded-lg p-4 flex flex-col justify-between h-full bg-white shadow-sm">
      <div>
        <h4 className="font-semibold text-lg text-gray-800 mb-2">
          Mongo Transfer
        </h4>
        <p className="text-sm text-gray-600 mb-4">
          Transfer processed data from Postgres to MongoDB.
        </p>

        {/* Source Selection */}
        <div className="mb-4 bg-gray-50 p-3 rounded-md border border-gray-200">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 block">
            Data Source
          </label>
          <div className="flex flex-col gap-2">
            <label className="flex items-center space-x-2 cursor-pointer hover:bg-gray-100 p-1 rounded">
              <input
                type="radio"
                name="mongoSource"
                checked={useCsv}
                onChange={() => setUseCsv(true)}
                className="form-radio text-emerald-600 h-4 w-4"
                disabled={loading}
              />
              <span className="text-sm text-gray-700">
                <strong>From CSV:</strong> Use Processed CSV Folios
              </span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer hover:bg-gray-100 p-1 rounded">
              <input
                type="radio"
                name="mongoSource"
                checked={!useCsv}
                onChange={() => setUseCsv(false)}
                className="form-radio text-indigo-600 h-4 w-4"
                disabled={loading}
              />
              <span className="text-sm text-gray-700">
                <strong>Direct DB:</strong> Use Client Code (No CSV)
              </span>
            </label>
          </div>
        </div>

        <div className="mb-4">
          <label
            htmlFor="clientCode"
            className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1"
          >
            Filter by Client Code {useCsv ? "(Optional)" : "(Required)"}
          </label>
          <input
            type="text"
            id="clientCode"
            className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm p-2 border ${
              isDirectModeInvalid
                ? "border-red-500 focus:ring-red-500"
                : "border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
            }`}
            value={clientCode}
            onChange={(e) => setClientCode(e.target.value)}
            placeholder="e.g., 150"
            disabled={loading}
          />
          {!useCsv && !clientCode && (
            <p className="text-xs text-red-500 mt-1">Required for Direct Mode</p>
          )}
        </div>
      </div>

      <div className="mt-auto">
        <button
          onClick={() => handleTransferToMongo(clientCode)}
          className={`btn w-full py-2 rounded-md transition-colors font-semibold ${
            isDirectModeInvalid
              ? "bg-gray-300 text-gray-500 cursor-not-allowed"
              : "bg-emerald-600 hover:bg-emerald-700 text-white"
          }`}
          disabled={loading || isDirectModeInvalid}
        >
          {loading ? "Transferring..." : "Transfer to Mongo"}
        </button>
      </div>
    </div>
  );
};

export default MongoTaskUI;
