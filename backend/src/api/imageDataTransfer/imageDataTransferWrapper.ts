import { SqlUtil } from "./sqlUtil";
import { MongoUtil } from "./mongoUtil";
import { ImageDataProgress } from "./imageDataTransferTypes";
import { createFeatureLogger } from "../../utils/logger";
import { broadcast } from "../../utils/webSocketService";

const logger = createFeatureLogger("imageDataTransfer");

export class ImageDataTransferWrapper {
  private sqlUtil: SqlUtil;
  private mongoUtil: MongoUtil;

  constructor() {
    this.sqlUtil = new SqlUtil();
    this.mongoUtil = new MongoUtil();
  }

  public async reconnectDb() {
    return this.sqlUtil.reconnectPool();
  }

  public async executeSql(): Promise<void> {
    this.sqlUtil
      .executeSql((progress) => {
        broadcast(JSON.stringify(progress));
      })
      .catch((err) => {
        logger.error("Background SQL Error", { error: err, console: true });
      });
  }

  // [UPDATED] now accepts optional boolean flag
  public async updateFolioAndTransaction(
    isUpdateAll: boolean = false
  ): Promise<void> {
    if (isUpdateAll) {
      this.sqlUtil
        .updateAllFolioAndTransaction((progress) => {
          broadcast(JSON.stringify(progress));
        })
        .catch((err) => {
          logger.error("Background Global Update Error", {
            error: err,
            console: true,
          });
        });
    } else {
      this.sqlUtil
        .updateFolioAndTransaction((progress) => {
          broadcast(JSON.stringify(progress));
        })
        .catch((err) => {
          logger.error("Background Specific Update Error", {
            error: err,
            console: true,
          });
        });
    }
  }

  public async transferDataFromPostgres(clientCode?: string): Promise<void> {
    this.mongoUtil
      .transferDataFromPostgres(clientCode, (progress) => {
        broadcast(JSON.stringify(progress));
      })
      .catch((err) => {
        logger.error("Background Mongo Transfer Error", {
          error: err,
          console: true,
        });
      });
  }

  public async updateMongoTransactions(clientId?: number): Promise<void> {
    this.mongoUtil
      .updateMongoTransactions(clientId, (progress) => {
        broadcast(JSON.stringify(progress));
      })
      .catch((err) => {
        logger.error("Background Mongo Sync Error", {
          error: err,
          console: true,
        });
      });
  }
}
