// backend/src/api/duplicateProcessor/duplicateProcessorWrapper.ts

import logger from "../../utils/logger";
import { SqlLog, MongoDuplicateCheckResult } from "./duplicateProcessorTypes";
import { DuplicateProcessorSqlUtil } from "./duplicateProcessorSqlUtil";
import { DuplicateProcessorMongoUtil } from "./duplicateProcessorMongoUtil";

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
  }): Promise<{
    result: "success" | "failed";
    dryRun: boolean;
    cutoffTms: string;
    deletedCount?: number;
    rows?: any[];
    logs: SqlLog[];
    imperfectDuplicates?: string[];
    imperfectDuplicatesFilePath?: string | null;
    totalDuplicatesFound?: number;
  }> {
    return this.duplicateProcessorSqlUtil.sanityCheckDuplicates(params);
  }

  public async sanityCheckMongoDuplicates(params: {
    dryRun?: boolean;
    cutoffTms?: string;
    clientId?: string;
  }): Promise<{
    result: "success" | "failed";
    dryRun: boolean;
    duplicates: MongoDuplicateCheckResult[];
    totalDuplicateGroups: number;
    totalDuplicateDocuments: number;
    logs: any[];
  }> {
    return this.duplicateProcessorMongoUtil.sanityCheckMongoDuplicates(params);
  }
}
