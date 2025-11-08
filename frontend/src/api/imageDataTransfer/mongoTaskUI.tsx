import React from "react";
import { MongoTaskUIProps } from "./mongoTaskType";

const MongoTaskUI: React.FC<MongoTaskUIProps> = ({
  loading,
  clientCode,
  setClientCode,
  handleTransferToMongo,
  updateAllMongo,
  setUpdateAllMongo,
}) => {
  return (
    <div className="border border-gray-300 rounded-lg p-4 flex flex-col justify-between">
      <div>
        <h4 className="font-semibold text-lg text-black mb-3">
          Mongo Operations
        </h4>
        <p className="text-sm text-gray-600 mb-4">
          Transfers new data or updates existing transaction numbers in
          MongoDB.
        </p>
        <div className="mb-4">
          <label htmlFor="clientCode" className="block text-sm font-medium text-gray-700 mb-1">
            Client Code (Optional)
          </label>
          <input
            type="text"
            id="clientCode"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm text-black p-2"
            value={clientCode}
            onChange={(e) => setClientCode(e.target.value)}
            placeholder="e.g., 150"
            disabled={loading}
          />
        </div>
        <div className="flex flex-col gap-2 mb-4">
          <label className="inline-flex items-center">
            <input
              type="checkbox"
              className="form-checkbox"
              checked={updateAllMongo}
              onChange={() => setUpdateAllMongo(!updateAllMongo)}
              disabled={loading}
            />
            <span className="ml-2 text-black">Update All Documents</span>
          </label>
        </div>
      </div>
      <button
        onClick={() => handleTransferToMongo(updateAllMongo, clientCode)}
        className="btn w-full"
        disabled={loading}
      >
        {loading ? (updateAllMongo ? "Updating..." : "Transferring...") : (updateAllMongo ? "Update Mongo Transactions" : "Transfer to Mongo")}
      </button>
    </div>
  );
};

export default MongoTaskUI;
