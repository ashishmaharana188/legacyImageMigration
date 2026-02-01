import { Request, Response } from "express";
import { ImageDataTransferWrapper } from "./imageDataTransferWrapper";
import { createFeatureLogger } from "../../utils/logger";

const logger = createFeatureLogger("imageDataTransfer");

class ImageDataTransferController {
  private wrapper = new ImageDataTransferWrapper();

  async reconnectDb(req: Request, res: Response) {
    try {
      await this.wrapper.reconnectDb();
      res.json({ message: "DB Reconnected" });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  // [ASYNC START]
  async executeSql(req: Request, res: Response) {
    logger.info("API: Starting SQL Execution (Async)", { console: true });
    this.wrapper.executeSql(); // No await
    res.status(202).json({ message: "SQL Execution Started" });
  }

  async updateFolioAndTransaction(req: Request, res: Response) {
    logger.info("API: Starting Folio Update (Async)", { console: true });
    this.wrapper.updateFolioAndTransaction(req.body.updateAll);
    res.status(202).json({ message: "Folio Update Started" });
  }

  async transferDataFromPostgres(req: Request, res: Response) {
    logger.info("API: Starting Mongo Transfer (Async)", { console: true });
    this.wrapper.transferDataFromPostgres(req.query.clientCode as string);
    res.status(202).json({ message: "Transfer Started" });
  }

  async updateMongoTransactions(req: Request, res: Response) {
    logger.info("API: Starting Mongo Sync (Async)", { console: true });
    const clientId = req.query.clientId
      ? parseInt(req.query.clientId as string)
      : undefined;
    this.wrapper.updateMongoTransactions(clientId);
    res.status(202).json({ message: "Sync Started" });
  }
}

export const imageDataTransferController = new ImageDataTransferController();
