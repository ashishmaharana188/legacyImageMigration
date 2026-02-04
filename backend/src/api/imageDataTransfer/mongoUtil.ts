import mongoose, { Document } from "mongoose";
import { createFeatureLogger } from "../../utils/logger";
import { SqlUtil } from "./sqlUtil";
import {
  connectMongo,
  disconnectMongo,
  getMongoModel,
  getMongoDb,
} from "../../utils/dbConnect";
import {
  mongoInsertMany,
  mongoBulkWrite,
  mongoFind,
  mongoFindOne,
} from "./imageDataTransferCore";
import {
  AifDocumentDetail,
  IAifDocument,
  IAifDocumentInput,
  ImageDataProgress,
} from "./imageDataTransferTypes";

const logger = createFeatureLogger("imageDataTransfer");

export class MongoUtil {
  private model: mongoose.Model<IAifDocument>;

  constructor() {
    this.model = getMongoModel();
  }

  public async connect() {
    await connectMongo();
  }
  public getDb() {
    return getMongoDb();
  }
  public async disconnect() {
    await disconnectMongo();
  }

  public async transferDataFromPostgres(
    clientCode: string | undefined,
    onProgress: (p: ImageDataProgress) => void
  ) {
    try {
      // [LOG] Start
      logger.info(`Starting Mongo Transfer. Filter: ${clientCode || "ALL"}`, {
        console: true,
      });

      onProgress({
        type: "mongoProgressUpdate",
        subTask: "transferMongo",
        total: 0,
        processed: 0,
        status: "Running",
        message: "Initializing Connections...",
      });

      const sqlUtil = new SqlUtil();
      await this.connect();
      logger.info("MongoDB Connection Established.", { console: true });

      let pgClientId: number | undefined;

      // [LOG] Client Code Resolution
      if (clientCode) {
        logger.info(`Resolving Client Code '${clientCode}'...`, {
          console: true,
        });
        const clientRes = await sqlUtil.getClientIdByCode(clientCode);

        if (clientRes) {
          pgClientId = clientRes.id;
          logger.info(
            `Resolved Client Code '${clientCode}' to ID: ${pgClientId}`,
            { console: true }
          );
        } else {
          logger.warn(
            `Client Code '${clientCode}' NOT found in Postgres. Proceeding might return 0 records.`,
            { console: true }
          );
        }
      }

      // [LOG] Fetching Data
      logger.info(
        `Fetching data from Postgres (Client ID: ${pgClientId || "ALL"})...`,
        { console: true }
      );
      const pgData = await sqlUtil.getAifDocumentDetails(pgClientId);
      const total = pgData.length;
      logger.info(`Fetched ${total} records from Postgres.`, { console: true });

      if (total === 0) {
        onProgress({
          type: "mongoProgressUpdate",
          subTask: "transferMongo",
          total: 0,
          processed: 0,
          status: "Completed",
          message: "No data found to transfer",
        });
        return;
      }

      onProgress({
        type: "mongoProgressUpdate",
        subTask: "transferMongo",
        total,
        processed: 0,
        status: "Running",
        message: `Fetched ${total} records... Preparing Insert`,
      });

      const documentsToInsert: IAifDocumentInput[] = [];
      const trxnMap: Record<string, string> = { IC: "ICP", NCT: "NCTP" };

      for (const data of pgData) {
        const docProcess = data.document_process || "";
        documentsToInsert.push({
          activityStatus: data.activity_status || "O",
          clientId: data.client_code,
          transactionNo: data.transaction_reference_id,
          documentType: "APLCN",
          processCode: trxnMap[docProcess] || docProcess,
          sourceUser: "system",
          applicationId: data.application_id,
          createdBy: data.created_by,
          creation_date: data.creation_date,
          currentStage: data.current_stage,
          documentFormat: data.document_format,
          documentPath: data.document_path,
          documentSize: data.document_size,
          mimeType: data.mime_type,
          lastUpdatedFrom: data.last_updated_from,
          totalPageCount: data.total_page_count,
          createdOn: new Date().toLocaleString(),
          lastUpdatedOn: new Date().toLocaleString(),
          // Ensure all required fields from IAifDocumentInput are mapped
          barcode: "",
          branchId: "",
          createdFrom: "",
          lastUpdatedBy: "system",
          transactionCode: "",
          transactionType: "",
          workDate: "",
        } as unknown as IAifDocumentInput);
      }

      // Bulk Insert in chunks
      const batchSize = 1000;
      logger.info(`Starting Bulk Insert of ${total} documents...`, {
        console: true,
      });

      for (let i = 0; i < documentsToInsert.length; i += batchSize) {
        const chunk = documentsToInsert.slice(i, i + batchSize);
        await mongoInsertMany(this.model, chunk);

        const currentCount = i + chunk.length;

        // [LOG] Batch Progress
        if (currentCount % 5000 === 0 || currentCount === total) {
          logger.info(`Inserted ${currentCount}/${total} documents...`, {
            console: true,
          });
        }

        onProgress({
          type: "mongoProgressUpdate",
          subTask: "transferMongo",
          total,
          processed: currentCount,
          status: "Running",
          metrics: { inserted: currentCount },
        });
      }

      logger.info("Mongo Transfer Completed Successfully.", { console: true });
      onProgress({
        type: "mongoProgressUpdate",
        subTask: "transferMongo",
        total,
        processed: total,
        status: "Completed",
        metrics: { inserted: total },
      });
    } catch (error: any) {
      // [LOG] Error
      logger.error("Mongo Transfer Failed", { error: error, console: true });
      onProgress({
        type: "mongoProgressUpdate",
        subTask: "transferMongo",
        total: 0,
        processed: 0,
        status: "Error",
        message: error.message,
      });
    }
  }

  public async updateMongoTransactions(
    clientId: number | undefined,
    onProgress: (p: ImageDataProgress) => void
  ) {
    let totalUpdated = 0;
    let totalSynced = 0;
    let processedCount = 0;

    try {
      logger.info(`Starting Mongo Sync (Client ID: ${clientId || "ALL"})...`, {
        console: true,
      });
      const sqlUtil = new SqlUtil();
      await this.connect();

      const EST_BATCH_SIZE = 1000;

      const processBatch = async (pgData: AifDocumentDetail[]) => {
        const bulkOps: any[] = [];

        const uniqueFilters = pgData.map((d) => ({
          clientId: d.client_code,
          transactionNo: d.user_attr1,
        }));

        // Optimize: Only fetch fields needed for comparison
        const mongoDocs = await mongoFind(this.model, {
          $or: uniqueFilters,
          sourceUser: "system",
        });

        const mongoDocMap = new Map(
          mongoDocs.map((d) => [`${d.clientId}-${d.transactionNo}`, d])
        );

        pgData.forEach((data) => {
          const doc = mongoDocMap.get(`${data.client_code}-${data.user_attr1}`);
          if (doc) {
            // Check if transaction number matches the new reference ID
            if (doc.transactionNo !== data.transaction_reference_id) {
              bulkOps.push({
                updateOne: {
                  filter: { _id: doc._id },
                  update: {
                    $set: { transactionNo: data.transaction_reference_id },
                  },
                },
              });
              totalUpdated++;
            } else {
              totalSynced++;
            }
          }
        });

        if (bulkOps.length > 0) {
          await mongoBulkWrite(this.model, bulkOps);
        }

        processedCount += pgData.length;

        if (processedCount % 5000 === 0) {
          logger.info(
            `Sync Progress: Processed ${processedCount}, Updated ${totalUpdated}, Synced ${totalSynced}`,
            { console: true }
          );
        }

        onProgress({
          type: "mongoProgressUpdate",
          subTask: "syncMongo",
          total: processedCount + EST_BATCH_SIZE, // Keep "running" ahead
          processed: processedCount,
          status: "Running",
          metrics: { updated: totalUpdated, synced: totalSynced },
        });
      };

      await sqlUtil.streamUpdateDetails(1000, processBatch, clientId);

      logger.info(`Mongo Sync Completed. Total Updated: ${totalUpdated}`, {
        console: true,
      });
      onProgress({
        type: "mongoProgressUpdate",
        subTask: "syncMongo",
        total: processedCount,
        processed: processedCount,
        status: "Completed",
        metrics: { updated: totalUpdated, synced: totalSynced },
      });
    } catch (error: any) {
      logger.error("Mongo Sync Failed", { error: error, console: true });
      onProgress({
        type: "mongoProgressUpdate",
        subTask: "syncMongo",
        total: 0,
        processed: 0,
        status: "Error",
        message: error.message,
      });
    }
  }
}
