// backend/src/api/duplicateProcessor/duplicateProcessorWrapper.ts

import {
  SqlLog,
  MongoDuplicateCheckResult,
  DryRunResultRow,
} from "./dataCleanTypes";
import { DuplicateProcessorSqlUtil } from "./dataCleanSqlUtil";
import { DuplicateProcessorMongoUtil } from "./dataCleanMongoUtil";
import { SanityCheckResult } from "./dataCleanTypes";

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
    // Correct: Returns the Interface directly
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
    logs: SqlLog[];
  }> {
    return this.duplicateProcessorMongoUtil.sanityCheckMongoDuplicates(params);
  }
}
