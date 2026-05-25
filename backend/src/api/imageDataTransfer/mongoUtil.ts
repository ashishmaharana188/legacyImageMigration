import mongoose from "mongoose";
import { ImageDataProgress } from "./imageDataTransferTypes";
import { SqlUtil } from "./sqlUtil";
import { createFeatureLogger } from "../../utils/logger";
import { getMongoModel } from "../../utils/dbConnect";
import { IAifDocument, IAifDocumentInput } from "./imageDataTransferTypes";
import { mongoFind } from "./imageDataTransferCore";

const logger = createFeatureLogger("imageDataTransfer");

export class MongoUtil {
  private sqlUtil: SqlUtil;
  private model: mongoose.Model<IAifDocument>;

  constructor() {
    this.sqlUtil = new SqlUtil();
    this.model = getMongoModel();
  }

  // [HELPER] Safely convert value to string to prevent crashes
  private safeString(val: any): string {
    if (val === null || val === undefined) return "";
    if (typeof val === "string") return val;
    if (typeof val === "object") {
      if (Object.keys(val).length === 0) return "";
      return JSON.stringify(val);
    }
    return String(val);
  }

  // [HELPER] Force Dates to String Format (e.g. "16/2/2026, 3:03:12 pm")
  private formatDate(val: any): string {
    if (!val) return "";
    // If it's already a string, return it
    if (typeof val === "string") return val;
    // If it's a JS Date object (from Postgres), convert to Locale String
    if (val instanceof Date) return val.toLocaleString();
    return String(val);
  }

  private parsePageCount(row: {
    page_count?: number | string | null;
    total_page_count?: number | string | null;
  }): number | null {
    const rawPageCount = row.page_count ?? row.total_page_count;
    if (rawPageCount === null || rawPageCount === undefined) return null;

    const pageCount =
      typeof rawPageCount === "number"
        ? rawPageCount
        : Number(rawPageCount.toString().trim());

    return Number.isFinite(pageCount) ? pageCount : null;
  }

  async transferDataFromPostgres(
    clientCode: string | undefined,
    onProgress: (p: ImageDataProgress) => void,
    useCsv: boolean = true,
  ): Promise<void> {
    try {
      const modeStr = useCsv ? "CSV Filter" : "Direct Client Filter";
      logger.info(
        `Starting PG -> Mongo Transfer [Mode: ${modeStr}] (Client: ${
          clientCode || "ALL"
        })...`,
        { console: true },
      );

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
      const pgData = await this.sqlUtil.getAifDocumentDetails(
        targetClientId,
        useCsv,
      );
      const total = pgData.length;
      logger.info(`Fetched ${total} records from Postgres.`, { console: true });

      if (total === 0) {
        const msg = useCsv
          ? "No Data Found in PG (Check if Processed CSV exists)"
          : `No Data Found in PG for Client Code ${clientCode}`;

        onProgress({
          type: "mongoProgressUpdate",
          subTask: "transferMongo",
          total: 0,
          processed: 0,
          status: "Completed",
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
        message: `Found ${total} records. Starting Direct Insert...`,
      });

      let insertedCount = 0;
      const batchSize = 1000;

      // 3. Process in Batches (DIRECT INSERT MODE)
      for (let i = 0; i < total; i += batchSize) {
        const chunk = pgData.slice(i, i + batchSize);

        // [FIX] Sanitize IDs to prevent "Cast to string failed for value {}"
        const chunkTxnRefs = chunk
          .map((row) => this.safeString(row.transaction_reference_id))
          .filter((id) => id !== ""); // Remove empties to optimize query

        // Bulk Duplicate Check
        const existingDocs = await mongoFind(this.model, {
          transactionNo: { $in: chunkTxnRefs },
          ...(clientCode ? { clientId: clientCode } : {}),
        });

        // Create Set for O(1) lookup
        const existingSet = new Set<string>(
          existingDocs.map((doc) => doc.transactionNo),
        );

        const docsToInsert: IAifDocumentInput[] = [];

        // 4. In-Memory Filter & Map
        for (const row of chunk) {
          // [SAFETY] Sanitize key fields
          const safeTxnId = this.safeString(row.transaction_reference_id);

          // [FIX] Prepare Date Strings
          // Use Postgres creation_date as the source of truth
          const creationDateStr = this.formatDate(row.creation_date);
          // Use Postgres last_update_tms, fallback to creation_date
          const lastUpdateStr = row.last_update_tms
            ? this.formatDate(row.last_update_tms)
            : creationDateStr;

          docsToInsert.push({
            activityStatus: row.activity_status || "O",
            applicationId: row.application_id,
            clientId: row.client_code,

            // Mapped Key Field
            transactionNo: safeTxnId,

            documentType: "APLCN",
            processCode: row.document_process,
            sourceUser: row.source_user || "system",
            createdBy: row.created_by,

            // [FIX] Map all Date fields to Strings
            createdOn: creationDateStr,
            createdFrom: creationDateStr,
            workDate: creationDateStr,
            lastUpdatedOn: creationDateStr,
            lastUpdatedFrom: row.created_by || null, // Keeping null if empty as per req, or use ""

            currentStage: row.current_stage || 0,
            documentFormat: row.document_format,
            documentPath: row.document_path,
            // [FIX] Ensure size is string and page count is numeric for Mongo.
            documentSize: this.safeString(row.document_size || "0"),
            totalPageCount: this.parsePageCount(row),

            mimeType: row.mime_type,

            // User Attributes
            user_attr0: row.user_attr0 || undefined,
            user_attr1: row.user_attr1,
            user_attr2: row.user_attr2 || undefined,
            user_attr3: row.user_attr3 || undefined,
            user_attr4: row.user_attr4 || undefined,
            user_attr5: row.user_attr5 || undefined,

            barcode: "",
            branchId: "",
            lastUpdatedBy: row.last_updated_by || "system",
            transactionCode: row.document_process,
            transactionType: row.document_type,
          } as unknown as IAifDocumentInput);
        }

        // 4. Bulk Insert (No Lookup)
        if (docsToInsert.length > 0) {
          await this.model.insertMany(docsToInsert, { ordered: false });
          insertedCount += docsToInsert.length;
        }

        const currentProcessed = Math.min(i + batchSize, total);

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

  // [DISABLED] Sync Logic
  async updateMongoTransactions(
    clientId: number | undefined,
    onProgress: (p: ImageDataProgress) => void,
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
