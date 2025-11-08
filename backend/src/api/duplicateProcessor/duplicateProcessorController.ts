// backend/src/api/duplicateProcessor/duplicateProcessorController.ts

import { Request, Response } from "express";
import { DuplicateProcessorWrapper } from "./duplicateProcessorWrapper";
import logger from "../../utils/logger";

class DuplicateProcessorController {
  private duplicateProcessorWrapper: DuplicateProcessorWrapper;

  constructor() {
    this.duplicateProcessorWrapper = new DuplicateProcessorWrapper();
  }

  async sanityCheckDuplicates(req: Request, res: Response) {
    try {
      const { dryRun, normalize, cutoffTms, clientCode } = req.query;
      logger.info({
        category: "api-calls",
        function: "sanityCheckDuplicates",
        message: "Initiating SQL duplicate sanity check.",
        dryRun,
        normalize,
        cutoffTms,
        clientCode,
      });
      const result = await this.duplicateProcessorWrapper.sanityCheckDuplicates({
        dryRun: dryRun === "true",
        normalize: normalize === "true",
        cutoffTms: cutoffTms as string,
        clientCode: clientCode as string,
      });
      logger.debug({
        category: "responses",
        function: "sanityCheckDuplicates",
        message: "SQL duplicate sanity check completed",
        result,
      });
      res.status(200).json({ statusCode: 200, ...result });
    } catch (error) {
      logger.error({
        category: "api-calls",
        function: "sanityCheckDuplicates",
        message: "Failed to perform SQL duplicate sanity check",
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      });
      res.status(500).json({
        statusCode: 500,
        error: "Failed to perform SQL duplicate sanity check",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  async sanityCheckMongoDuplicates(req: Request, res: Response) {
    try {
      const { dryRun, cutoffTms, clientId } = req.query;
      logger.info({
        category: "api-calls",
        function: "sanityCheckMongoDuplicates",
        message: "Initiating MongoDB duplicate sanity check.",
        dryRun,
        cutoffTms,
        clientId,
      });
      const result = await this.duplicateProcessorWrapper.sanityCheckMongoDuplicates({
        dryRun: dryRun === "true",
        cutoffTms: cutoffTms as string,
        clientId: clientId as string,
      });
      logger.debug({
        category: "responses",
        function: "sanityCheckMongoDuplicates",
        message: "MongoDB duplicate sanity check completed",
        result,
      });
      res.status(200).json({ statusCode: 200, ...result });
    } catch (error) {
      logger.error({
        category: "api-calls",
        function: "sanityCheckMongoDuplicates",
        message: "Failed to perform MongoDB duplicate sanity check",
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      });
      res.status(500).json({
        statusCode: 500,
        error: "Failed to perform MongoDB duplicate sanity check",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}

export const duplicateProcessorController = new DuplicateProcessorController();
