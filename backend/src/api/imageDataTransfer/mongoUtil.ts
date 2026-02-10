import mongoose from "mongoose";
import { ImageDataProgress } from "./imageDataTransferTypes";
import {
  mongoInsertMany,
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

  // [HELPER] Safely convert any value to string to prevent Mongoose CastErrors
  private safeString(val: any): string {
    if (val === null || val === undefined) return "";
    if (typeof val === "string") return val;
    if (typeof val === "object") {
      // If it's an empty object (which caused your crash), return empty string or stringify
      if (Object.keys(val).length === 0) return "";
      return JSON.stringify(val);
    }
    return String(val);
  }

  async transferDataFromPostgres(
    clientCode: string | undefined,
    onProgress: (p: ImageDataProgress) => void
  ): Promise<void> {
    try {
      logger.info(`Starting PG -> Mongo Transfer (Filter: ${clientCode || "ALL"})...`, { console: true });

      onProgress({
        type: "mongoProgressUpdate",
        subTask: "transferMongo",
        total: 0,
        processed: 0,
        status: "Running",
        message: "Fetching PG Data...",
      });

      // 1. Resolve Client ID
      let targetClientId: number | undefined = undefined;
      if (clientCode) {
        const clientData = await this.sqlUtil.getClientIdByCode(clientCode);
        if (!clientData) {
            const msg = `Client Code '${clientCode}' not found in Postgres.`;
            logger.warn(msg, { console: true });
            throw new Error(msg);
        }
        targetClientId = clientData.id;
      }

      // 2. Fetch Data from Postgres
      const pgData = await this.sqlUtil.getAifDocumentDetails(targetClientId);
      const total = pgData.length;

      logger.info(`Fetched ${total} records from Postgres.`, { console: true });

      if (total === 0) {
        onProgress({
          type: "mongoProgressUpdate",
          subTask: "transferMongo",
          total: 0,
          processed: 0,
          status: "Completed",
          message: "No Data Found in PG",
        });
        return;
      }

      onProgress({
        type: "mongoProgressUpdate",
        subTask: "transferMongo",
        total,
        processed: 0,
        status: "Running",
        message: `Found ${total} records. Starting Batch Insert...`,
      });

      let insertedCount = 0;
      const batchSize = 1000;

      // 3. Process in Batches
      for (let i = 0; i < total; i += batchSize) {
        const chunk = pgData.slice(i, i + batchSize);

        // [FIX] Sanitize IDs to prevent "Cast to string failed for value {}"
        const chunkTxnRefs = chunk
          .map(row => this.safeString(row.transaction_reference_id))
          .filter(id => id !== ""); // Remove empties to optimize query

        // Bulk Duplicate Check
        const existingDocs = await mongoFind(this.model, {
          transactionNo: { $in: chunkTxnRefs },
          ...(clientCode ? { clientId: clientCode } : {})
        });

        // Create Set for O(1) lookup
        const existingSet = new Set<string>(
            existingDocs.map((doc) => doc.transactionNo)
        );

        const docsToInsert: IAifDocumentInput[] = [];

        // 4. In-Memory Filter & Map
        for (const row of chunk) {
          const safeTxnId = this.safeString(row.transaction_reference_id);

          // Check specific Transaction Reference ID
          if (existingSet.has(safeTxnId)) {
            continue; // Skip duplicate
          }

          docsToInsert.push({
            activityStatus: row.activity_status || "O",
            applicationId: row.application_id,
            clientId: row.client_code,

            // [FIX] Use sanitized string value
            transactionNo: safeTxnId,

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

            user_attr0: row.user_attr0 || undefined,
            user_attr1: row.user_attr1,
            user_attr2: row.user_attr2 || undefined,
            user_attr3: row.user_attr3 || undefined,
            user_attr4: row.user_attr4 || undefined,
            user_attr5: row.user_attr5 || undefined,

            barcode: "",
            branchId: "",
            createdFrom: "",
            lastUpdatedBy: row.last_updated_by || "system",
            transactionCode: "",
            transactionType: "",
            workDate: "",
          } as unknown as IAifDocumentInput);
        }

        // 5. Bulk Insert
        if (docsToInsert.length > 0) {
          await this.model.insertMany(docsToInsert, { ordered: false });
          insertedCount += docsToInsert.length;
        }

        const currentProcessed = Math.min(i + batchSize, total);

        if (currentProcessed % 5000 === 0 || currentProcessed === total) {
           logger.info(`Processed ${currentProcessed}/${total} records...`, { console: true });
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

      logger.info(`Transfer Completed. Total Inserted: ${insertedCount}`, { console: true });

      onProgress({
        type: "mongoProgressUpdate",
        subTask: "transferMongo",
        total,
        processed: total,
        status: "Completed",
        metrics: { inserted: insertedCount },
      });
    } catch (err: any) {
      logger.error("Mongo Transfer Failed", { error: err.message, console: true });
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

  // [DISABLED] Sync Logic
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
