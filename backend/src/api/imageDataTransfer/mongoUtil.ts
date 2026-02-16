import mongoose from "mongoose";
import { ImageDataProgress } from "./imageDataTransferTypes";
import {
  mongoInsertMany,
  mongoFindOne,
  mongoFind,
} from "./imageDataTransferCore";
import { SqlUtil } from "./sqlUtil";
import { createFeatureLogger } from "../../utils/logger";
import { getMongoModel } from "../../utils/dbConnect";
import { IAifDocument, IAifDocumentInput } from "./imageDataTransferTypes";

const logger = createFeatureLogger("imageDataTransfer");

export class MongoUtil {
  private sqlUtil: SqlUtil;
  private model: mongoose.Model<IAifDocument>;

  constructor() {
    this.sqlUtil = new SqlUtil();
    this.model = getMongoModel();
  }

  async transferDataFromPostgres(
    clientCode: string | undefined,
    onProgress: (p: ImageDataProgress) => void
  ): Promise<void> {
    try {
      // [LOG] Added console log
      logger.info("Starting PG -> Mongo Transfer Logic...", { console: true });

      onProgress({
        type: "mongoProgressUpdate",
        subTask: "transferMongo",
        total: 0,
        processed: 0,
        status: "Running",
        message: "Fetching PG Data...",
      });

      let targetClientId: number | undefined = undefined;
      if (clientCode) {
        const clientData = await this.sqlUtil.getClientIdByCode(clientCode);
        if (!clientData) throw new Error(`Invalid Client Code: ${clientCode}`);
        targetClientId = clientData.id;
      }

      const pgData = await this.sqlUtil.getAifDocumentDetails(targetClientId);
      const total = pgData.length;

      // [LOG] Added console log for count
      logger.info(`Fetched ${total} records from Postgres.`, { console: true });

      if (total === 0) {
        const msg = "No Data Found in PG (Check if Processed CSV exists)";
        logger.warn(msg, { console: true }); // [LOG] Log warning to console
        onProgress({
          type: "mongoProgressUpdate",
          subTask: "transferMongo",
          total: 0,
          processed: 0,
          status: "Error",
          message: msg,
        });
        return;
      }

      onProgress({
        type: "mongoProgressUpdate",
        subTask: "transferMongo",
        total,
        processed: 0,
        status: "Running",
        message: `Found ${total} records. Checking Mongo...`,
      });

      let insertedCount = 0;
      const batchSize = 1000;

      for (let i = 0; i < total; i += batchSize) {
        const chunk = pgData.slice(i, i + batchSize);
        const docsToInsert: IAifDocumentInput[] = [];

        for (const row of chunk) {
          const exists = await mongoFindOne(this.model);

          if (exists) {
            const isDup = await mongoFind(this.model, {
              user_attr1: row.user_attr1,
              user_attr2: row.user_attr2 || "",
              clientId: row.client_code,
              documentType: row.document_type,
            });
            if (isDup.length > 0) continue;
          }

          // Map Postgres Row to Mongo Input Interface
          docsToInsert.push({
            activityStatus: row.activity_status || "O",
            applicationId: row.application_id,
            clientId: row.client_code,
            transactionNo: row.transaction_reference_id,
            documentType: "APLCN",
            processCode: row.document_process,
            sourceUser: row.source_user || "system",
            createdBy: row.created_by,
            creation_date: row.creation_date,
            currentStage: row.current_stage || 0,
            documentFormat: row.document_format,
            documentPath: row.document_path,
            documentSize: row.document_size || "0",
            mimeType: row.mime_type,
            lastUpdatedFrom: row.last_updated_from,
            totalPageCount: row.page_count || row.total_page_count || 0,
            createdOn: new Date().toLocaleString(),
            lastUpdatedOn: new Date().toLocaleString(),
            barcode: "",
            branchId: "",
            createdFrom: row.creation_date,
            lastUpdatedBy: row.last_updated_by || "system",
            transactionCode: row.document_process,
            transactionType: row.document_type,
            workDate: row.creation_date,
          } as unknown as IAifDocumentInput);
        }

        if (docsToInsert.length > 0) {
          await mongoInsertMany(this.model, docsToInsert);
          insertedCount += docsToInsert.length;
        }

        const currentProcessed = Math.min(i + batchSize, total);

        // [LOG] Log every 5000 records to console to avoid spamming
        if (currentProcessed % 5000 === 0 || currentProcessed === total) {
          logger.info(`Processed ${currentProcessed}/${total} records...`, {
            console: true,
          });
        }

        onProgress({
          type: "mongoProgressUpdate",
          subTask: "transferMongo",
          total,
          processed: currentProcessed,
          status: "Running",
          metrics: { inserted: insertedCount },
        });
      }

      logger.info(`Transfer Completed. Total Inserted: ${insertedCount}`, {
        console: true,
      });

      onProgress({
        type: "mongoProgressUpdate",
        subTask: "transferMongo",
        total,
        processed: total,
        status: "Completed",
        metrics: { inserted: insertedCount },
      });
    } catch (err: any) {
      logger.error("Mongo Transfer Failed", {
        error: err.message,
        console: true,
      });
      onProgress({
        type: "mongoProgressUpdate",
        subTask: "transferMongo",
        total: 0,
        processed: 0,
        status: "Error",
        message: err.message,
      });
    }
  }

  async updateMongoTransactions(
    clientId: number | undefined,
    onProgress: (p: ImageDataProgress) => void
  ): Promise<void> {
    logger.warn("Sync disabled.", { console: true });
    onProgress({
      type: "mongoProgressUpdate",
      subTask: "syncMongo",
      total: 0,
      processed: 0,
      status: "Warning",
      message: "Sync functionality is disabled",
    });
    return Promise.resolve();
  }
}
