import express from "express";
import { imageDataTransferController } from "./imageDataTransferController";

const router = express.Router();

// Routes are relative because this router is mounted at '/api/imageDataTransfer' in app.ts
router.post("/api/imageDataTransfer/execute-sql", (req, res) =>
  imageDataTransferController.executeSql(req, res)
);
router.post("/api/imageDataTransfer/update-folio", (req, res) =>
  imageDataTransferController.updateFolioAndTransaction(req, res)
);
router.get("/api/imageDataTransfer/transfer-postgres", (req, res) =>
  imageDataTransferController.transferDataFromPostgres(req, res)
);
router.get("/api/imageDataTransfer/update-mongo", (req, res) =>
  imageDataTransferController.updateMongoTransactions(req, res)
);

// [ADDED] Reconnect DB Route
router.post("/api/imageDataTransfer/reconnect-db", (req, res) =>
  imageDataTransferController.reconnectDb(req, res)
);

export default router;
