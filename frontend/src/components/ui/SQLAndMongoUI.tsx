
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
      <h3>SQL and Mongo Operations</h3>
      <div>
        <button onClick={handleUploadSplitFilesToS3}>Upload Split Files to S3</button>
      </div>
      <div>
        <button onClick={handleUploadToS3}>Upload Original to S3</button>
      </div>
      <div>
        <button onClick={handleTransferToMongo}>Transfer to Mongo</button>
      </div>
      <div>
        <button onClick={handleGenerateSql}>Generate SQL</button>
        <button onClick={handleExecuteSql}>Execute SQL</button>
      </div>
      <div>
        <button onClick={handleupdateFolioAndTransaction}>Update Folio & Transaction</button>
      </div>
    </div>
  );
};

export default SQLAndMongoUI;
