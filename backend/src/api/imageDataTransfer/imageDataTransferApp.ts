import express from "express";
import { imageDataTransferController } from "./imageDataTransferController";

const router = express.Router();

// Routes are relative because this router is mounted at '/api/imageDataTransfer' in app.ts
router.post("/execute-sql", (req, res) =>
  imageDataTransferController.executeSql(req, res)
);
router.post("/update-folio", (req, res) =>
  imageDataTransferController.updateFolioAndTransaction(req, res)
);
router.get("/transfer-postgres", (req, res) =>
  imageDataTransferController.transferDataFromPostgres(req, res)
);
router.get("/update-mongo", (req, res) =>
  imageDataTransferController.updateMongoTransactions(req, res)
);

// [ADDED] Reconnect DB Route
router.post("/reconnect-db", (req, res) =>
  imageDataTransferController.reconnectDb(req, res)
);

export default router;
