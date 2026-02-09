import React from "react";
import { SQLTaskUIProps } from "./sqlTaskType";

const SQLTaskUI: React.FC<SQLTaskUIProps> = ({
  loading,
  handleExecuteSql,
  handleUpdateFolioAndTransaction,
  handleReconnect,
  isUpdateAll,
  setIsUpdateAll,
}) => {
  return (
    <div className="border border-gray-300 rounded-lg p-4 flex flex-col justify-between h-full bg-white shadow-sm">
      <div>
        <h4 className="font-semibold text-lg text-gray-800 mb-2">
          Folio & Transaction Update
        </h4>
        <p className="text-sm text-gray-600 mb-4">
          Updates transaction references and folio IDs in Postgres.
        </p>

        {/* [NEW] Update Mode Toggle Section */}
        <div className="mb-4 bg-gray-50 p-3 rounded-md border border-gray-200">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 block">
            Update Scope
          </label>
          <div className="flex flex-col gap-2">
            <label className="flex items-center space-x-2 cursor-pointer hover:bg-gray-100 p-1 rounded">
              <input
                type="radio"
                name="updateMode"
                checked={!isUpdateAll}
                onChange={() => setIsUpdateAll(false)}
                className="form-radio text-indigo-600 h-4 w-4"
                disabled={loading}
              />
              <span className="text-sm text-gray-700">
                <strong>Specific:</strong> Only update records from Processed
                CSV
              </span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer hover:bg-gray-100 p-1 rounded">
              <input
                type="radio"
                name="updateMode"
                checked={isUpdateAll}
                onChange={() => setIsUpdateAll(true)}
                className="form-radio text-red-600 h-4 w-4"
                disabled={loading}
              />
              <span className="text-sm text-gray-700">
                <strong>Global:</strong> Update ALL matching records (Careful)
              </span>
            </label>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 mt-2">
        <button
          onClick={handleUpdateFolioAndTransaction}
          className={`btn w-full py-2 rounded-md transition-colors font-semibold ${
            isUpdateAll
              ? "bg-red-600 hover:bg-red-700 text-white border-red-700"
              : "bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-700"
          } disabled:opacity-50`}
          disabled={loading}
        >
          {loading
            ? "Processing..."
            : isUpdateAll
            ? "Run Global Update"
            : "Run Specific Update"}
        </button>

        <div className="flex gap-2">
          <button
            onClick={handleExecuteSql}
            className="flex-1 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
            disabled={loading}
          >
            Execute SQL
          </button>
          <button
            onClick={handleReconnect}
            className="flex-1 bg-white border border-gray-300 hover:bg-red-50 text-red-600 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
            disabled={loading}
          >
            Reconnect DB
          </button>
        </div>
      </div>
    </div>
  );
};

export default SQLTaskUI;
