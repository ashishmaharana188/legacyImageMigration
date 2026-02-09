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

  async executeSql(req: Request, res: Response) {
    logger.info("API: Starting SQL Execution (Async)", { console: true });
    this.wrapper.executeSql();
    res.status(202).json({ message: "SQL Execution Started" });
  }

  async updateFolioAndTransaction(req: Request, res: Response) {
    logger.info("API: Starting Folio Update (Async)", { console: true });

    // [UPDATED] Check for updateAll flag in body
    const { updateAll } = req.body;
    const isUpdateAll = updateAll === true;

    if (isUpdateAll) {
      logger.info("Mode: GLOBAL UPDATE (All Records)", { console: true });
    } else {
      logger.info("Mode: SPECIFIC UPDATE (From CSV)", { console: true });
    }

    this.wrapper.updateFolioAndTransaction(isUpdateAll);
    res.status(202).json({
      message: isUpdateAll
        ? "Global Folio Update Started"
        : "Specific Folio Update Started",
    });
  }

  async transferDataFromPostgres(req: Request, res: Response) {
    logger.info("API: Starting Mongo Transfer (Async)", { console: true });
    this.wrapper.transferDataFromPostgres(req.query.clientCode as string);
    res.status(202).json({ message: "Transfer Started" });
  }

  async updateMongoTransactions(req: Request, res: Response) {
    logger.info("API: Starting Mongo Sync (Async) - [DISABLED]", {
      console: true,
    });
    const clientId = req.query.clientId
      ? parseInt(req.query.clientId as string)
      : undefined;
    this.wrapper.updateMongoTransactions(clientId);
    res.status(202).json({ message: "Sync Started (Disabled)" });
  }
}

export const imageDataTransferController = new ImageDataTransferController();
