import express from "express";
import { imageDataTransferController } from "./imageDataTransferController";

const router = express.Router();

router.post("/image-data/execute-sql", (req, res) =>
  imageDataTransferController.executeSql(req, res)
);

router.post("/image-data/update-folio", (req, res) =>
  imageDataTransferController.updateFolioAndTransaction(req, res)
);

router.post("/image-data/transfer-mongo", (req, res) =>
  imageDataTransferController.transferDataFromPostgres(req, res)
);

router.post("/image-data/update-mongo", (req, res) =>
  imageDataTransferController.updateMongoTransactions(req, res)
);
router.post("/image-data/reconnect-db", (req, res) =>
  imageDataTransferController.reconnectDb(req, res)
);

export default router;
