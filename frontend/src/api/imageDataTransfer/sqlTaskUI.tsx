import React from "react";
import { SQLTaskUIProps } from "./sqlTaskType";

const SQLTaskUI: React.FC<SQLTaskUIProps> = ({
  loading,
  handleExecuteSql,
  handleUpdateFolioAndTransaction,
  handleReconnect,
  updateAll,
  setUpdateAll,
}) => {
  return (
    <div className="border border-gray-300 rounded-lg p-4 flex flex-col justify-between">
      <div>
        <h4 className="font-semibold text-lg text-black mb-3">
          Folio & Transaction Update
        </h4>
        <p className="text-sm text-gray-600 mb-4">
          Updates folio and transaction reference IDs in the database.
        </p>
        <div className="flex flex-col gap-2 mb-4">
          <label className="inline-flex items-center">
            <input
              type="radio"
              className="form-checkbox"
              name="updateOption"
              value="processed"
              checked={!updateAll}
              onChange={() => setUpdateAll(false)}
            />
            <span className="ml-2 text-black">Update from Processed CSV</span>
          </label>
          <label className="inline-flex items-center">
            <input
              type="radio"
              className="form-checkbox"
              name="updateOption"
              value="all"
              checked={updateAll}
              onChange={() => setUpdateAll(true)}
            />
            <span className="ml-2 text-black">Update All Records</span>
          </label>
        </div>
      </div>
      <button
        onClick={() => handleUpdateFolioAndTransaction(updateAll)}
        className="btn w-full"
        disabled={loading}
      >
        {loading ? "Updating..." : "Update Folio & Transaction"}
      </button>
      <div className="mt-4 flex gap-4 justify-end">
        <button onClick={handleExecuteSql} className="btn" disabled={loading}>
          {loading ? "Executing..." : "Execute SQL"}
        </button>
        <button
          onClick={handleReconnect}
          className="btn btn-danger"
          disabled={loading}
        >
          {loading ? "Reconnecting..." : "Reconnect to DB"}
        </button>
      </div>
    </div>
  );
};

export default SQLTaskUI;
