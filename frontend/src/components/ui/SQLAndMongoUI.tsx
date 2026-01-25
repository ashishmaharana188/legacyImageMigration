import React, { useState } from "react";

interface SQLAndMongoUIProps {
  loading: boolean;
  clientCode: string;
  setClientCode: (code: string) => void;
  handleTransferToMongo: (
    updateAll: boolean,
    clientCode: string
  ) => Promise<void>;
  handleExecuteSql: () => Promise<void>;
  handleupdateFolioAndTransaction: (updateAll: boolean) => Promise<void>;
  handleReconnect: () => Promise<void>;
}

const SQLAndMongoUI: React.FC<SQLAndMongoUIProps> = ({
  handleTransferToMongo,
  handleExecuteSql,
  handleupdateFolioAndTransaction,
  handleReconnect,
  clientCode,
  setClientCode,
}) => {
  const [updateAll, setUpdateAll] = useState<boolean>(false);
  const [updateAllMongo, setUpdateAllMongo] = useState<boolean>(false);

  return (
    <div className="p-4 bg-gray-50 rounded-lg">
      <h3 className="text-xl font-bold text-black mb-4">
        SQL and Mongo Operations
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Folio & Transaction Update Section */}
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
                <span className="ml-2 text-black">
                  Update from Processed CSV
                </span>
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
            onClick={() => handleupdateFolioAndTransaction(updateAll)}
            className="btn w-full"
          >
            Update Folio & Transaction
          </button>
        </div>

        {/* Mongo Operations Section */}
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
              <label
                htmlFor="clientCode"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Client Code (Optional)
              </label>
              <input
                type="text"
                id="clientCode"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm text-black p-2"
                value={clientCode}
                onChange={(e) => setClientCode(e.target.value)}
                placeholder="e.g., 150"
              />
            </div>
            <div className="flex flex-col gap-2 mb-4">
              <label className="inline-flex items-center">
                <input
                  type="checkbox"
                  className="form-checkbox"
                  checked={updateAllMongo}
                  onChange={() => setUpdateAllMongo(!updateAllMongo)}
                />
                <span className="ml-2 text-black">Update All Documents</span>
              </label>
            </div>
          </div>
          <button
            onClick={() => handleTransferToMongo(updateAllMongo, clientCode)}
            className="btn w-full"
          >
            {updateAllMongo ? "Update Mongo Transactions" : "Transfer to Mongo"}
          </button>
        </div>
      </div>

      {/* General Actions Section */}
      <div className="mt-6 border-t pt-4 flex gap-4 justify-end">
        <button onClick={handleExecuteSql} className="btn">
          Execute SQL
        </button>
        <button onClick={handleReconnect} className="btn btn-danger">
          Reconnect to DB
        </button>
      </div>
    </div>
  );
};

export default SQLAndMongoUI;
