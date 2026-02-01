import { SqlUtil } from "./sqlUtil";
import { MongoUtil } from "./mongoUtil";
import { SqlLog } from "./imageDataTransferTypes";
import { createFeatureLogger } from "../../utils/logger";

const logger = createFeatureLogger("imageDataTransfer");

export class ImageDataTransferWrapper {
  private sqlUtil: SqlUtil;
  private mongoUtil: MongoUtil;

  constructor() {
    this.sqlUtil = new SqlUtil();
    this.mongoUtil = new MongoUtil();
  }

  // [ADDED] Support for "Reconnect DB" button
  public async reconnectDb(): Promise<{ message: string }> {
    logger.info("Wrapper: Calling SqlUtil.reconnectPool...");
    await this.sqlUtil.reconnectPool();
    return { message: "Database reconnected successfully." };
  }

  public async executeSql(): Promise<{
    result: string;
    logs: SqlLog[];
    summary: {
      insertedRows: number;
      errorRows: number;
      badRows: unknown[];
      badRowsFilePath: string | null;
    };
  }> {
    logger.info("Wrapper: Calling SqlUtil.executeSql...");
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
    logger.info("Wrapper: Calling SqlUtil.updateFolioAndTransaction...");
    return this.sqlUtil.updateFolioAndTransaction(
      updateAll,
      transactions,
      initialLogs
    );
  }

  public async transferDataFromPostgres(clientCode?: string): Promise<{
    transferredCount: number;
    documents?: unknown[];
  }> {
    logger.info("Wrapper: Calling MongoUtil.transferDataFromPostgres...");
    return this.mongoUtil.transferDataFromPostgres(clientCode);
  }

  public async updateMongoTransactions(clientId?: number): Promise<{
    updatedCount: number;
    syncedCount: number;
    updatedDocuments: unknown[];
    syncedDocuments: unknown[];
  }> {
    logger.info("Wrapper: Calling MongoUtil.updateMongoTransactions...");
    return this.mongoUtil.updateMongoTransactions(clientId);
  }
}
