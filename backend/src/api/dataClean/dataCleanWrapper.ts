// backend/src/api/dataClean/dataCleanWrapper.ts

import { SqlLog, SanityCheckResult } from "./dataCleanTypes";
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

  public async sanityCheckDuplicates(params: {
    dryRun?: boolean;
    normalize?: boolean;
    cutoffTms?: string;
    clientCode?: string;
  }): Promise<SanityCheckResult> {
    // Broadcast logic will go here in Step 3

    try {
      const result = await this.duplicateProcessorSqlUtil.sanityCheckDuplicates(
        params
      );
      return result;
    } catch (error: any) {
      logger.error("Wrapper: SQL Check Failed", { error: error.message });
      throw error;
    }
  }

  public async sanityCheckMongoDuplicates(params: {
    dryRun?: boolean;
    cutoffTms?: string;
    clientId?: string;
  }): Promise<{
    result: "success" | "failed";
    dryRun: boolean;
    totalDuplicateGroups: number;
    totalDuplicateDocuments: number;
    logs: SqlLog[];
  }> {
    // Broadcast logic will go here in Step 3

    try {
      const result =
        await this.duplicateProcessorMongoUtil.sanityCheckMongoDuplicates(
          params
        );
      return result;
    } catch (error: any) {
      logger.error("Wrapper: Mongo Check Failed", { error: error.message });
      throw error;
    }
  }
}
