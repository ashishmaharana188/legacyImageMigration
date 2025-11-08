// backend/src/api/imageDataTransfer/imageDataTransferWrapper.ts

import { SqlUtil } from "./sqlUtil";
import { MongoUtil } from "./mongoUtil";
import logger from "../../utils/logger";
import { SqlLog } from "./imageDataTransferTypes";
import { DuplicateProcessorSqlUtil } from "../duplicateProcessor/duplicateProcessorSqlUtil";
import { DuplicateProcessorMongoUtil } from "../duplicateProcessor/duplicateProcessorMongoUtil";
import { MongoDuplicateCheckResult } from "../duplicateProcessor/duplicateProcessorTypes";

export class ImageDataTransferWrapper {
  private sqlUtil: SqlUtil;
  private mongoUtil: MongoUtil;
  private duplicateProcessorSqlUtil: DuplicateProcessorSqlUtil;
  private duplicateProcessorMongoUtil: DuplicateProcessorMongoUtil;

  constructor() {
    this.sqlUtil = new SqlUtil();
    this.mongoUtil = new MongoUtil();
    this.duplicateProcessorSqlUtil = new DuplicateProcessorSqlUtil();
    this.duplicateProcessorMongoUtil = new DuplicateProcessorMongoUtil();
  }

  public async executeSql(): Promise<{
    result: string;
    logs: SqlLog[];
    summary: {
      insertedRows: number;
      errorRows: number;
      badRows: any[];
      badRowsFilePath: string | null;
    };
  }> {
    return this.sqlUtil.executeSql();
  }

  public async updateFolioAndTransaction(
    updateAll: boolean,
    transactions: {
      id_fund: number;
      id_trtype: string;
      id_ihno: number;
      id_path: string;
      id_acno: string;
      page_count: number | string;
    }[],
    initialLogs: SqlLog[]
  ): Promise<{
    result: string;
    logs: SqlLog[];
    summary: {
      updatedFolioRows: number;
      updatedTransactionRows: number;
      badRows: { user_attr1: string; user_attr2: string; reason: string }[];
      badRowsFilePath: string | null;
    };
  }> {
    return this.sqlUtil.updateFolioAndTransaction(
      updateAll,
      transactions,
      initialLogs
    );
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

  public async transferDataFromPostgres(clientCode?: string): Promise<{
    transferredCount: number;
    documents?: any[];
  }> {
    return this.mongoUtil.transferDataFromPostgres(clientCode);
  }

  public async updateMongoTransactions(clientId?: number): Promise<{
    updatedCount: number;
    syncedCount: number;
    updatedDocuments: any[];
    syncedDocuments: any[];
  }> {
    return this.mongoUtil.updateMongoTransactions(clientId);
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
