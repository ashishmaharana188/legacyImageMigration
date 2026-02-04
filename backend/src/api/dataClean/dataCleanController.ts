import { Request, Response } from "express";
import { DuplicateProcessorWrapper } from "./dataCleanWrapper";
import { createFeatureLogger } from "../../utils/logger";

// [STANDARD] Initialize feature logger
const logger = createFeatureLogger("dataClean");

class DuplicateProcessorController {
  private duplicateProcessorWrapper: DuplicateProcessorWrapper;

  constructor() {
    this.duplicateProcessorWrapper = new DuplicateProcessorWrapper();
  }

  async sanityCheckDuplicates(req: Request, res: Response) {
    try {
      const { dryRun, normalize, cutoffTms, clientCode } = req.body;

      logger.info("API: sanityCheckDuplicates started", {
        category: "api-calls",
        function: "sanityCheckDuplicates",
        dryRun,
        normalize,
        cutoffTms,
        clientCode,
        console: true, // [FIX] Force output to terminal
      });

      const result = await this.duplicateProcessorWrapper.sanityCheckDuplicates(
        {
          dryRun: dryRun !== false,
          normalize: normalize === true || normalize === "true",
          cutoffTms: cutoffTms as string,
          clientCode: clientCode as string,
        }
      );

      logger.info("API: sanityCheckDuplicates completed successfully", {
        category: "api-calls",
        function: "sanityCheckDuplicates",
        totalDuplicates: result.totalDuplicatesFound,
        console: true, // [FIX] Force output to terminal
      });

      res.status(200).json({
        statusCode: 200,
        ...result,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      logger.error("API: sanityCheckDuplicates failed", {
        category: "api-calls",
        function: "sanityCheckDuplicates",
        error: errorMessage,
        console: true, // [FIX] Force output to terminal
      });

      res.status(500).json({
        statusCode: 500,
        error: errorMessage,
      });
    }
  }

  async sanityCheckMongoDuplicates(req: Request, res: Response) {
    try {
      const { dryRun, cutoffTms, clientId } = req.body;

      logger.info("API: sanityCheckMongoDuplicates started", {
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

      logger.info("API: sanityCheckMongoDuplicates completed successfully", {
        category: "api-calls",
        function: "sanityCheckMongoDuplicates",
        totalDuplicateGroups: result.totalDuplicateGroups,
        console: true,
      });

      res.status(200).json({
        statusCode: 200,
        ...result,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      logger.error("API: sanityCheckMongoDuplicates failed", {
        category: "api-calls",
        function: "sanityCheckMongoDuplicates",
        error: errorMessage,
        console: true,
      });

      res.status(500).json({
        statusCode: 500,
        error: errorMessage,
      });
    }
  }
}

export const duplicateProcessorController = new DuplicateProcessorController();
