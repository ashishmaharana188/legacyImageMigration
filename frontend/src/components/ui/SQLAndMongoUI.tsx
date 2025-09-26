import React, { useState } from "react";

interface SQLAndMongoUIProps {
  loading: boolean;

  handleTransferToMongo: () => Promise<void>;
  handleGenerateSql: () => Promise<void>;
  handleExecuteSql: () => Promise<void>;
  handleupdateFolioAndTransaction: (updateAll: boolean) => Promise<void>;
  handleReconnect: () => Promise<void>;
}

const SQLAndMongoUI: React.FC<SQLAndMongoUIProps> = ({
  handleTransferToMongo,
  handleExecuteSql,
  handleupdateFolioAndTransaction,
  handleReconnect,
}) => {
  const [updateAll, setUpdateAll] = useState<boolean>(false);

  return (
    <div>
      <h3 className="text-xl font-bold text-black mb-4">
        SQL and Mongo Operations
      </h3>
      <div className="flex gap-4 mb-4">
        <label className="inline-flex items-center">
          <input
            type="radio"
            className="form-radio"
            name="updateOption"
            value="processed"
            checked={!updateAll}
            onChange={() => setUpdateAll(false)}
          />
          <span className="ml-2 text-black">Update processed folios</span>
        </label>
        <label className="inline-flex items-center">
          <input
            type="radio"
            className="form-radio"
            name="updateOption"
            value="all"
            checked={updateAll}
            onChange={() => setUpdateAll(true)}
          />
          <span className="ml-2 text-black">Update all</span>
        </label>
      </div>
      <div className="flex gap-4">
        <div className="flex gap-4">
          <button onClick={handleExecuteSql} className="btn">
            Execute SQL
          </button>
        </div>
        <button onClick={() => handleupdateFolioAndTransaction(updateAll)} className="btn">
          Update Folio & Transaction
        </button>
        <button onClick={handleTransferToMongo} className="btn">
          Transfer to Mongo
        </button>
        <button onClick={handleReconnect} className="btn btn-danger">
          Reconnect to DB
        </button>
      </div>
    </div>
  );
};

export default SQLAndMongoUI;
