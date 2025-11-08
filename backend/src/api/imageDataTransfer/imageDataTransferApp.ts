// backend/src/api/imageDataTransfer/imageDataTransferApp.ts

import express from "express";
import { imageDataTransferController } from "./imageDataTransferController";

const imageDataTransferRouter = express.Router();

imageDataTransferRouter.post(
  "/sql/execute",
  imageDataTransferController.executeSql.bind(imageDataTransferController)
);
imageDataTransferRouter.post(
  "/sql/update-folio-transaction",
  imageDataTransferController.updateFolioAndTransaction.bind(imageDataTransferController)
);

imageDataTransferRouter.post(
  "/mongo/transfer-from-postgres",
  imageDataTransferController.transferDataFromPostgres.bind(imageDataTransferController)
);
imageDataTransferRouter.post(
  "/mongo/update-transactions",
  imageDataTransferController.updateMongoTransactions.bind(imageDataTransferController)
);


export default imageDataTransferRouter;
