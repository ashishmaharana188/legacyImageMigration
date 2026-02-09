import React from "react";
import { MongoTaskUIProps } from "./mongoTaskType";

const MongoTaskUI: React.FC<MongoTaskUIProps> = ({
  loading,
  clientCode,
  setClientCode,
  handleTransferToMongo,
}) => {
  return (
    <div className="border border-gray-300 rounded-lg p-4 flex flex-col justify-between h-full bg-white shadow-sm">
      <div>
        <h4 className="font-semibold text-lg text-gray-800 mb-2">
          Mongo Transfer
        </h4>
        <p className="text-sm text-gray-600 mb-4">
          Transfer processed data from Postgres to MongoDB.
        </p>

        <div className="mb-4">
          <label
            htmlFor="clientCode"
            className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1"
          >
            Filter by Client Code (Optional)
          </label>
          <input
            type="text"
            id="clientCode"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm text-gray-900 p-2 border"
            value={clientCode}
            onChange={(e) => setClientCode(e.target.value)}
            placeholder="e.g., 150"
            disabled={loading}
          />
        </div>
      </div>

      <div className="mt-auto">
        <button
          onClick={() => handleTransferToMongo(clientCode)}
          className="btn w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-md transition-colors disabled:opacity-50"
          disabled={loading}
        >
          {loading ? "Transferring..." : "Transfer to Mongo"}
        </button>
        {/* [CLEANUP] Sync button removed */}
      </div>
    </div>
  );
};

export default MongoTaskUI;
