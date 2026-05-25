// backend/src/api/dataClean/dataCleanWrapper.ts

import {
  SqlLog,
  SanityCheckResult,
  MongoDuplicateCheckResult,
} from "./dataCleanTypes";
import { DuplicateProcessorSqlUtil } from "./dataCleanSqlUtil";
import { DuplicateProcessorMongoUtil } from "./dataCleanMongoUtil";
import { broadcast } from "../../utils/webSocketService";
import { createFeatureLogger } from "../../utils/logger";

const logger = createFeatureLogger("dataClean");

export class DuplicateProcessorWrapper {
  private duplicateProcessorSqlUtil: DuplicateProcessorSqlUtil;
  private duplicateProcessorMongoUtil: DuplicateProcessorMongoUtil;

  constructor() {
    this.duplicateProcessorSqlUtil = new DuplicateProcessorSqlUtil();
    this.duplicateProcessorMongoUtil = new DuplicateProcessorMongoUtil();
  }

  // Helper to safely broadcast without crashing the main thread
  private safeBroadcast(payload: any) {
    try {
      broadcast(JSON.stringify(payload));
    } catch (err: any) {
      logger.error("Wrapper: WebSocket broadcast failed (Process continuing)", {
        error: err.message,
        console: true,
      });
    }
  }

  public async sanityCheckDuplicates(params: {
    dryRun?: boolean;
    normalize?: boolean;
    cutoffTms?: string;
    clientCode?: string;
  }): Promise<SanityCheckResult> {
    logger.info("Wrapper: Starting SQL Check...", { console: true });

    // 1. Broadcast START
    this.safeBroadcast({
      type: "sanity-progress",
      task: "pgSanityCheck",
      status: "Running",
      progress: 10,
      message: "Analyzing PostgreSQL Data...",
      metrics: {},
    });

    try {
      const result = await this.duplicateProcessorSqlUtil.sanityCheckDuplicates(
        params
      );

      const totalDups = result.totalDuplicatesFound || result.deletedCount || 0;
      const status = totalDups > 0 ? "Warning" : "Success";

      logger.info("Wrapper: SQL Check Complete. Broadcasting results.", {
        metrics: result.metrics,
        console: true,
      });

      // 2. Broadcast SUCCESS with METRICS
      this.safeBroadcast({
        type: "sanity-progress",
        task: "pgSanityCheck",
        status: status,
        progress: 100,
        message: params.dryRun ? "Dry Run Complete" : "Cleanup Complete",
        metrics: result.metrics || {},
        totalDuplicates: totalDups,
      });

      return result;
    } catch (error: any) {
      logger.error("Wrapper: SQL Check Failed", {
        error: error.message,
        console: true,
      });

      // 3. Broadcast ERROR
      this.safeBroadcast({
        type: "sanity-progress",
        task: "pgSanityCheck",
        status: "Error",
        progress: 100,
        message: `Failed: ${error.message}`,
      });
      throw error;
    }
  }

  public async sanityCheckMongoDuplicates(params: {
    dryRun?: boolean;
    cutoffTms?: string;
    clientCode?: string;
  }): Promise<{
    result: "success" | "failed";
    dryRun: boolean;
    totalDuplicateGroups: number;
    totalDuplicateDocuments: number;
    logs: SqlLog[];
  }> {
    logger.info("Wrapper: Starting Mongo Check...", { console: true });

    // 1. Broadcast START
    this.safeBroadcast({
      type: "sanity-progress",
      task: "mongoSanityCheck",
      status: "Running",
      progress: 10,
      message: "Scanning MongoDB...",
      metrics: {},
    });

    try {
      const result =
        await this.duplicateProcessorMongoUtil.sanityCheckMongoDuplicates(
          params
        );

      const totalDuplicates =
        result.totalDuplicateDocuments - result.totalDuplicateGroups;
      const status = totalDuplicates > 0 ? "Warning" : "Success";

      logger.info("Wrapper: Mongo Check Complete. Broadcasting results.", {
        totalDuplicates,
        console: true,
      });

      // 2. Broadcast SUCCESS
      this.safeBroadcast({
        type: "sanity-progress",
        task: "mongoSanityCheck",
        status: status,
        progress: 100,
        message: "Mongo Check Complete",
        metrics: { duplicates: totalDuplicates },
        totalDuplicates: totalDuplicates,
      });

      return result;
    } catch (error: any) {
      logger.error("Wrapper: Mongo Check Failed", {
        error: error.message,
        console: true,
      });

      // 3. Broadcast ERROR
      this.safeBroadcast({
        type: "sanity-progress",
        task: "mongoSanityCheck",
        status: "Error",
        progress: 100,
        message: `Failed: ${error.message}`,
      });
      throw error;
    }
  }
}
