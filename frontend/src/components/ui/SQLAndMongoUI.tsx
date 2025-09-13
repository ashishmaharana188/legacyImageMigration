import React from "react";

interface SQLAndMongoUIProps {
  loading: boolean;

  handleTransferToMongo: () => Promise<void>;
  handleGenerateSql: () => Promise<void>;
  handleExecuteSql: () => Promise<void>;
  handleupdateFolioAndTransaction: () => Promise<void>;
}

const SQLAndMongoUI: React.FC<SQLAndMongoUIProps> = ({
  handleTransferToMongo,
  handleExecuteSql,
  handleupdateFolioAndTransaction,
}) => {
  return (
    <div>
      <h3 className="text-xl font-bold text-black mb-4">
        SQL and Mongo Operations
      </h3>
      <div className="flex gap-4">
        <div className="flex gap-4">
          <button onClick={handleExecuteSql} className="btn">
            Execute SQL
          </button>
        </div>
        <button onClick={handleupdateFolioAndTransaction} className="btn">
          Update Folio & Transaction
        </button>
        <button onClick={handleTransferToMongo} className="btn">
          Transfer to Mongo
        </button>
      </div>
    </div>
  );
};

export default SQLAndMongoUI;
