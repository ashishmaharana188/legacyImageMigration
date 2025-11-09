// backend/src/api/imageDataTransfer/imageDataTransferController.ts

import { Request, Response } from "express";
import { ImageDataTransferWrapper } from "./imageDataTransferWrapper";
import logger from "../../utils/logger";

class ImageDataTransferController {
  private imageDataTransferWrapper: ImageDataTransferWrapper;

  constructor() {
    this.imageDataTransferWrapper = new ImageDataTransferWrapper();
  }

  async executeSql(req: Request, res: Response) {
    try {
      logger.info({
        category: "api-calls",
        function: "executeSql",
        message: "Initiating SQL execution.",
      });
      const result = await this.imageDataTransferWrapper.executeSql();
      logger.debug({
        category: "responses",
        function: "executeSql",
        message: "SQL execution completed",
        result,
      });
      res.status(200).json({ statusCode: 200, ...result });
    } catch (error) {
      logger.error({
        category: "api-calls",
        function: "executeSql",
        message: "Failed to execute SQL",
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
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
      logger.info({
        category: "api-calls",
        function: "updateFolioAndTransaction",
        message: "Initiating folio and transaction update.",
        updateAll,
        transactionCount: transactions ? transactions.length : 0,
      });
      const result = await this.imageDataTransferWrapper.updateFolioAndTransaction(
        updateAll,
        transactions,
        initialLogs
      );
      logger.debug({
        category: "responses",
        function: "updateFolioAndTransaction",
        message: "Folio and transaction update completed",
        result,
      });
      res.status(200).json({ statusCode: 200, ...result });
    } catch (error) {
      logger.error({
        category: "api-calls",
        function: "updateFolioAndTransaction",
        message: "Failed to update folio and transaction",
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      });
      res.status(500).json({
        statusCode: 500,
        error: "Failed to update folio and transaction",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  async transferDataFromPostgres(req: Request, res: Response) {
    try {
      const { clientCode } = req.query;
      logger.info({
        category: "api-calls",
        function: "transferDataFromPostgres",
        message: "Initiating data transfer from PostgreSQL to MongoDB.",
        clientCode,
      });
      const result = await this.imageDataTransferWrapper.transferDataFromPostgres(
        clientCode as string
      );
      logger.debug({
        category: "responses",
        function: "transferDataFromPostgres",
        message: "Data transfer to MongoDB completed",
        result,
      });
      res.status(200).json({ statusCode: 200, ...result });
    } catch (error) {
      logger.error({
        category: "api-calls",
        function: "transferDataFromPostgres",
        message: "Failed to transfer data from PostgreSQL to MongoDB",
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      });
      res.status(500).json({
        statusCode: 500,
        error: "Failed to transfer data from PostgreSQL to MongoDB",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  async updateMongoTransactions(req: Request, res: Response) {
    try {
      const { clientId } = req.query;
      logger.info({
        category: "api-calls",
        function: "updateMongoTransactions",
        message: "Initiating MongoDB transaction update.",
        clientId,
      });
      const result = await this.imageDataTransferWrapper.updateMongoTransactions(
        clientId ? parseInt(clientId as string, 10) : undefined
      );
      logger.debug({
        category: "responses",
        function: "updateMongoTransactions",
        message: "MongoDB transaction update completed",
        result,
      });
      res.status(200).json({ statusCode: 200, ...result });
    } catch (error) {
      logger.error({
        category: "api-calls",
        function: "updateMongoTransactions",
        message: "Failed to update MongoDB transactions",
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      });
      res.status(500).json({
        statusCode: 500,
        error: "Failed to update MongoDB transactions",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }


}

export const imageDataTransferController = new ImageDataTransferController();
