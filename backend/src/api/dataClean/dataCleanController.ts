// backend/src/api/dataClean/dataCleanController.ts

import { Request, Response } from "express";
import { DuplicateProcessorWrapper } from "./dataCleanWrapper";
import { createFeatureLogger } from "../../utils/logger";

const logger = createFeatureLogger("dataClean");

class DuplicateProcessorController {
  private duplicateProcessorWrapper: DuplicateProcessorWrapper;

  constructor() {
    this.duplicateProcessorWrapper = new DuplicateProcessorWrapper();
  }

  async sanityCheckDuplicates(req: Request, res: Response) {
    try {
      const { dryRun, normalize, cutoffTms, clientCode } = req.body;

      // [FIX] Correct logger signature: message string first
      logger.info("Initiating SQL duplicate sanity check.", {
        category: "api-calls",
        function: "sanityCheckDuplicates",
        dryRun,
        normalize,
        cutoffTms,
        clientCode,
        console: true,
      });

      const result = await this.duplicateProcessorWrapper.sanityCheckDuplicates(
        {
          dryRun: dryRun !== false,
          normalize: normalize === true || normalize === "true",
          cutoffTms: cutoffTms as string,
          clientCode: clientCode as string,
        }
      );

      res.status(200).json({ statusCode: 200, ...result });
    } catch (error) {
      // [FIX] Correct logger signature
      logger.error("Failed to perform SQL duplicate sanity check", {
        category: "api-calls",
        function: "sanityCheckDuplicates",
        error: error instanceof Error ? error.message : "Unknown error",
        console: true,
      });
      res.status(500).json({
        statusCode: 500,
        error: "Failed to perform SQL duplicate sanity check",
      });
    }
  }

  async sanityCheckMongoDuplicates(req: Request, res: Response) {
    try {
      const { dryRun, cutoffTms, clientId } = req.body;

      // [FIX] Correct logger signature
      logger.info("Initiating MongoDB duplicate sanity check.", {
        category: "api-calls",
        function: "sanityCheckMongoDuplicates",
        dryRun,
        cutoffTms,
        clientId,
        console: true,
      });

      const result =
        await this.duplicateProcessorWrapper.sanityCheckMongoDuplicates({
          dryRun: dryRun !== false,
          cutoffTms: cutoffTms as string,
          clientId: clientId as string,
        });

      res.status(200).json({ statusCode: 200, ...result });
    } catch (error) {
      // [FIX] Correct logger signature
      logger.error("Failed to perform MongoDB duplicate sanity check", {
        category: "api-calls",
        function: "sanityCheckMongoDuplicates",
        error: error instanceof Error ? error.message : "Unknown error",
        console: true,
      });
      res.status(500).json({
        statusCode: 500,
        error: "Failed to perform MongoDB duplicate sanity check",
      });
    }
  }
}

export const duplicateProcessorController = new DuplicateProcessorController();
