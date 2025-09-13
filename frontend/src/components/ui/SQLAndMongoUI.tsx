
import React from 'react';

interface SQLAndMongoUIProps {
  loading: boolean;
  handleUploadSplitFilesToS3: () => Promise<void>;
  handleUploadToS3: () => Promise<void>;
  handleTransferToMongo: () => Promise<void>;
  handleGenerateSql: () => Promise<void>;
  handleExecuteSql: () => Promise<void>;
  handleupdateFolioAndTransaction: () => Promise<void>;
}

const SQLAndMongoUI: React.FC<SQLAndMongoUIProps> = ({
  handleUploadSplitFilesToS3,
  handleUploadToS3,
  handleTransferToMongo,
  handleGenerateSql,
  handleExecuteSql,
  handleupdateFolioAndTransaction,
}) => {
  return (
    <div>
      <h3 className="text-xl font-bold text-black mb-4">SQL and Mongo Operations</h3>
      <div className="flex flex-col gap-4">
        <button onClick={handleUploadSplitFilesToS3} className="btn">Upload Split Files to S3</button>
        <button onClick={handleUploadToS3} className="btn">Upload Original to S3</button>
        <button onClick={handleTransferToMongo} className="btn">Transfer to Mongo</button>
        <div className="flex gap-4">
          <button onClick={handleGenerateSql} className="btn">Generate SQL</button>
          <button onClick={handleExecuteSql} className="btn">Execute SQL</button>
        </div>
        <button onClick={handleupdateFolioAndTransaction} className="btn">Update Folio & Transaction</button>
      </div>
    </div>
  );
};

export default SQLAndMongoUI;
