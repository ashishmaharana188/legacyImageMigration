// backend/src/api/duplicateProcessor/duplicateProcessorController.ts

import { Request, Response } from "express";
import { DuplicateProcessorWrapper } from "./dataCleanWrapper";
import logger from "../../utils/logger";

class DuplicateProcessorController {
  private duplicateProcessorWrapper: DuplicateProcessorWrapper;

  constructor() {
    this.duplicateProcessorWrapper = new DuplicateProcessorWrapper();
  }

  async sanityCheckDuplicates(req: Request, res: Response) {
    try {
      // FIX: Changed from req.query to req.body to read the POST JSON payload
      const { dryRun, normalize, cutoffTms, clientCode } = req.body;

      logger.info({
        category: "api-calls",
        function: "sanityCheckDuplicates",
        message: "Initiating SQL duplicate sanity check.",
        dryRun,
        normalize,
        cutoffTms,
        clientCode,
      });

      const result = await this.duplicateProcessorWrapper.sanityCheckDuplicates(
        {
          // FIX: Strict check. If dryRun is not explicitly FALSE, it stays TRUE (Safe)
          dryRun: dryRun !== false,
          normalize: normalize === true || normalize === "true",
          cutoffTms: cutoffTms as string,
          clientCode: clientCode as string,
        }
      );

      res.status(200).json({ statusCode: 200, ...result });
    } catch (error) {
      logger.error({
        category: "api-calls",
        function: "sanityCheckDuplicates",
        message: "Failed to perform SQL duplicate sanity check",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      res.status(500).json({
        statusCode: 500,
        error: "Failed to perform SQL duplicate sanity check",
      });
    }
  }

  async sanityCheckMongoDuplicates(req: Request, res: Response) {
    try {
      // FIX: Changed from req.query to req.body
      const { dryRun, cutoffTms, clientId } = req.body;

      logger.info({
        category: "api-calls",
        function: "sanityCheckMongoDuplicates",
        message: "Initiating MongoDB duplicate sanity check.",
        dryRun,
        cutoffTms,
        clientId,
      });

      const result =
        await this.duplicateProcessorWrapper.sanityCheckMongoDuplicates({
          dryRun: dryRun !== false, // Default to true for safety
          cutoffTms: cutoffTms as string,
          clientId: clientId as string,
        });

      res.status(200).json({ statusCode: 200, ...result });
    } catch (error) {
      res.status(500).json({
        statusCode: 500,
        error: "Failed to perform MongoDB duplicate sanity check",
      });
    }
  }
}

export const duplicateProcessorController = new DuplicateProcessorController();
