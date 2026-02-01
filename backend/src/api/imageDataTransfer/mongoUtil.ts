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

  // [FIX] Progress Callback
  public async transferDataFromPostgres(
    clientCode: string | undefined,
    onProgress: (p: ImageDataProgress) => void
  ) {
    try {
      const sqlUtil = new SqlUtil();
      await this.connect();

      let pgClientId: number | undefined;
      if (clientCode) {
        const clientRes = await sqlUtil.getClientIdByCode(clientCode);
        if (clientRes) pgClientId = clientRes.id;
      }

      const pgData = await sqlUtil.getAifDocumentDetails(pgClientId);
      const total = pgData.length;

      if (total === 0) {
        onProgress({
          type: "mongoProgressUpdate",
          subTask: "transferMongo",
          total: 0,
          processed: 0,
          status: "Completed",
          message: "No data to transfer",
        });
        return;
      }

      onProgress({
        type: "mongoProgressUpdate",
        subTask: "transferMongo",
        total,
        processed: 0,
        status: "Running",
        message: `Fetched ${total} records...`,
      });

      const documentsToInsert: IAifDocumentInput[] = [];
      const trxnMap: Record<string, string> = { IC: "ICP", NCT: "NCTP" };

      for (const data of pgData) {
        // ... (Mapping logic same as before) ...
        const docProcess = data.document_process || "";
        documentsToInsert.push({
          activityStatus: data.activity_status || "O",
          clientId: data.client_code,
          transactionNo: data.transaction_reference_id,
          documentType: "APLCN",
          processCode: trxnMap[docProcess] || docProcess,
          sourceUser: "system",
          // ... minimal mapping for brevity, assuming full object construction here
          createdOn: new Date().toLocaleString(),
          lastUpdatedOn: new Date().toLocaleString(),
        } as any);
      }

      // Bulk Insert in chunks
      const batchSize = 1000;
      for (let i = 0; i < documentsToInsert.length; i += batchSize) {
        const chunk = documentsToInsert.slice(i, i + batchSize);
        await mongoInsertMany(this.model, chunk);
        onProgress({
          type: "mongoProgressUpdate",
          subTask: "transferMongo",
          total,
          processed: i + chunk.length,
          status: "Running",
          metrics: { inserted: i + chunk.length },
        });
      }

      onProgress({
        type: "mongoProgressUpdate",
        subTask: "transferMongo",
        total,
        processed: total,
        status: "Completed",
        metrics: { inserted: total },
      });
    } catch (error: any) {
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
      const sqlUtil = new SqlUtil();
      await this.connect();

      // We don't know total easily with streams, so we guess or just show processed count
      const EST_BATCH_SIZE = 1000;

      const processBatch = async (pgData: AifDocumentDetail[]) => {
        const bulkOps: any[] = [];

        // ... (Logic to fetch Mongo docs and compare) ...
        const uniqueFilters = pgData.map((d) => ({
          clientId: d.client_code,
          transactionNo: d.user_attr1,
        }));
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

        if (bulkOps.length > 0) await mongoBulkWrite(this.model, bulkOps);

        processedCount += pgData.length;
        onProgress({
          type: "mongoProgressUpdate",
          subTask: "syncMongo",
          total: processedCount + EST_BATCH_SIZE, // Dynamic total
          processed: processedCount,
          status: "Running",
          metrics: { updated: totalUpdated, synced: totalSynced },
        });
      };

      await sqlUtil.streamUpdateDetails(1000, processBatch, clientId);

      onProgress({
        type: "mongoProgressUpdate",
        subTask: "syncMongo",
        total: processedCount,
        processed: processedCount,
        status: "Completed",
        metrics: { updated: totalUpdated, synced: totalSynced },
      });
    } catch (error: any) {
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
