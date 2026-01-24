// backend/src/api/imageDataTransfer/imageDataTransferApp.ts

import express from "express";
import { imageDataTransferController } from "./imageDataTransferController";

const imageDataTransferRouter = express.Router();

// Change this line to match the URL in your axios call
imageDataTransferRouter.post(
  "/process-sql-mongo",
  imageDataTransferController.executeSql.bind(imageDataTransferController)
);

imageDataTransferRouter.post(
  "/process-sql-mongo/sql/execute",
  imageDataTransferController.executeSql.bind(imageDataTransferController)
);
imageDataTransferRouter.post(
  "/process-sql-mongo/sql/update-folio-transaction",
  imageDataTransferController.updateFolioAndTransaction.bind(
    imageDataTransferController
  )
);

imageDataTransferRouter.post(
  "/transfer-to-mongo",
  imageDataTransferController.transferDataFromPostgres.bind(
    imageDataTransferController
  )
);
imageDataTransferRouter.post(
  "/process-sql-mongo/mongo/update-transactions",
  imageDataTransferController.updateMongoTransactions.bind(
    imageDataTransferController
  )
);

export default imageDataTransferRouter;
