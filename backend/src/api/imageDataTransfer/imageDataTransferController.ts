import { Request, Response } from "express";
import { ImageDataTransferWrapper } from "./imageDataTransferWrapper";
import { createFeatureLogger } from "../../utils/logger";

const logger = createFeatureLogger("imageDataTransfer");

class ImageDataTransferController {
  private imageDataTransferWrapper: ImageDataTransferWrapper;

  constructor() {
    this.imageDataTransferWrapper = new ImageDataTransferWrapper();
  }

  // [ADDED] Reconnect Logic
  async reconnectDb(req: Request, res: Response) {
    try {
      logger.info("API: Reconnecting DB...", { console: true });
      const result = await this.imageDataTransferWrapper.reconnectDb();
      res.status(200).json({ statusCode: 200, ...result });
    } catch (error) {
      logger.error("API: Reconnect Failed", { error });
      res.status(500).json({ error: "Failed to reconnect DB" });
    }
  }

  async executeSql(req: Request, res: Response) {
    try {
      logger.info("API: Initiating SQL execution...", { console: true });
      const result = await this.imageDataTransferWrapper.executeSql();
      logger.info(
        `API: SQL Execution Completed. Inserted: ${result.summary.insertedRows}`,
        { console: true }
      );
      res.status(200).json({ statusCode: 200, ...result });
    } catch (error) {
      logger.error("API: Failed to execute SQL", {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({
        statusCode: 500,
        error: "Failed to execute SQL",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  async updateFolioAndTransaction(req: Request, res: Response) {
    try {
      const { updateAll, transactions, initialLogs } = req.body;
      const count = transactions ? transactions.length : 0;
      logger.info(
        `API: Initiating Update. Mode: ${
          updateAll ? "ALL" : "SELECTIVE"
        } (${count})`,
        { console: true }
      );

      const result =
        await this.imageDataTransferWrapper.updateFolioAndTransaction(
          updateAll,
          transactions,
          initialLogs
        );

      logger.info(
        `API: Update Completed. Folios: ${result.summary.updatedFolioRows}`,
        { console: true }
      );
      res.status(200).json({ statusCode: 200, ...result });
    } catch (error) {
      logger.error("API: Failed to update folio", { error });
      res.status(500).json({ error: "Failed to update folio" });
    }
  }

  async transferDataFromPostgres(req: Request, res: Response) {
    try {
      const { clientCode } = req.query;
      logger.info(`API: PG->Mongo Transfer. Client: ${clientCode || "ALL"}`, {
        console: true,
      });
      const result =
        await this.imageDataTransferWrapper.transferDataFromPostgres(
          clientCode as string
        );
      logger.info(`API: Transfer Completed. Docs: ${result.transferredCount}`, {
        console: true,
      });
      res.status(200).json({ statusCode: 200, ...result });
    } catch (error) {
      logger.error("API: Transfer Failed", { error });
      res.status(500).json({ error: "Transfer failed" });
    }
  }

  async updateMongoTransactions(req: Request, res: Response) {
    try {
      const { clientId } = req.query;
      logger.info(`API: Mongo Sync. ClientID: ${clientId || "ALL"}`, {
        console: true,
      });
      const result =
        await this.imageDataTransferWrapper.updateMongoTransactions(
          clientId ? parseInt(clientId as string, 10) : undefined
        );
      logger.info(
        `API: Sync Completed. Upd: ${result.updatedCount}, Syn: ${result.syncedCount}`,
        { console: true }
      );
      res.status(200).json({ statusCode: 200, ...result });
    } catch (error) {
      logger.error("API: Sync Failed", { error });
      res.status(500).json({ error: "Sync failed" });
    }
  }
}

export const imageDataTransferController = new ImageDataTransferController();
