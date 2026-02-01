import mongoose, { Document, PipelineStage } from "mongoose";
import { createFeatureLogger } from "../../utils/logger";
import { SqlUtil } from "./sqlUtil";
import {
  connectMongo,
  disconnectMongo,
  getMongoModel,
  getMongoDb,
} from "../../utils/dbConnect";
import {
  mongoFindOne,
  mongoInsertMany,
  mongoBulkWrite,
  mongoFind,
  mongoAggregate,
} from "./imageDataTransferCore";
import {
  AifDocumentDetail,
  IAifDocument,
  IAifDocumentInput,
  IUpdatedDocumentSummary,
  ISyncedDocumentSummary,
  IBulkWriteResult,
} from "./imageDataTransferTypes";

const logger = createFeatureLogger("imageDataTransfer");

export class MongoUtil {
  private model: mongoose.Model<IAifDocument>;

  constructor() {
    this.model = getMongoModel();
  }

  public async connect(): Promise<void> {
    await connectMongo();
  }

  public getDb() {
    return getMongoDb();
  }

  public async disconnect(): Promise<void> {
    await disconnectMongo();
  }

  public async testConnectionAndQuery(): Promise<Document[]> {
    try {
      if (mongoose.connection.readyState !== 1) {
        logger.info("MongoDB not connected. Attempting to connect...");
        await this.connect();
      }
      const db = this.getDb();
      if (!db) {
        logger.error("Database connection is not available.");
        return [];
      }

      const result = await mongoFindOne(this.model);
      logger.info(
        `MongoDB connection test successful. Found ${
          result ? 1 : 0
        } document(s).`
      );
      return result ? [result] : [];
    } catch (error) {
      logger.error("MongoDB connection test failed", { error });
      throw error;
    }
  }

  public async transferDataFromPostgres(clientCode?: string): Promise<{
    transferredCount: number;
    documents?: IAifDocument[];
  }> {
    try {
      const sqlUtil = new SqlUtil();
      await this.connect();
      const db = this.getDb();
      if (!db) {
        logger.error("Database connection is not available.");
        return { transferredCount: 0 };
      }

      let pgClientId: number | undefined;
      if (clientCode) {
        const clientRes = await sqlUtil.getClientIdByCode(clientCode);
        if (clientRes) {
          pgClientId = clientRes.id;
          logger.info(
            `Found PostgreSQL client_id: ${pgClientId} for client_code: ${clientCode}`
          );
        } else {
          logger.warn(
            `Client code '${clientCode}' not found in PostgreSQL. Aborting transfer.`
          );
          return { transferredCount: 0 };
        }
      }

      const transactionsMap: Record<string, string> = {
        IC: "ICP",
        NCT: "NCTP",
      };

      logger.info(
        `Fetching documents from PG for transfer. ClientID: ${
          pgClientId || "N/A"
        }`
      );
      const pgData: AifDocumentDetail[] = await sqlUtil.getAifDocumentDetails(
        pgClientId
      );

      logger.info(`Fetched ${pgData.length} documents. Transforming data...`);
      const documentsToInsert: IAifDocumentInput[] = [];

      for (const data of pgData) {
        const docType = data.document_type || "";
        const docProcess = data.document_process || "";

        const doc: IAifDocumentInput = {
          activityStatus: data.activity_status || "O",
          applicationId: data.application_id || null,
          clientId: data.client_code,
          createdBy: data.created_by || "system",
          createdFrom: new Date(data.creation_date)
            .toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
            .toLocaleUpperCase(),
          createdOn: new Date(data.creation_date)
            .toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
            .toLocaleUpperCase(),
          currentStage: data.current_stage || 15,
          documentFormat: data.document_format,
          documentPath: data.document_path,
          documentSize: data.document_size || "",
          documentType: "APLCN",
          lastUpdatedBy: "",
          lastUpdatedFrom: data.last_updated_from || null,
          lastUpdatedOn: new Date()
            .toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
            .toLocaleUpperCase(),
          mimeType: data.mime_type,
          processCode: transactionsMap[docProcess] || docProcess,
          sourceUser: data.source_user || "system",
          totalPageCount: data.total_page_count || null,
          transactionCode: data.document_process,
          transactionNo: data.transaction_reference_id,
          transactionType: docType.replace("Form", "").trim(),
          workDate: new Date()
            .toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
            .toLocaleUpperCase(),
        };
        documentsToInsert.push(doc);
      }

      if (documentsToInsert.length > 0) {
        logger.info(
          `Inserting ${documentsToInsert.length} documents into MongoDB...`,
          { console: true }
        );
        const insertedDocuments = await this.insertDocument(documentsToInsert);
        logger.info("Insertion successful.");
        return {
          transferredCount: pgData.length,
          documents: insertedDocuments,
        };
      }

      await this.disconnect();
      logger.info("No documents to transfer.");
      return { transferredCount: pgData.length, documents: [] };
    } catch (error) {
      logger.error("Data transfer error", { error });
      throw error;
    }
  }

  public async insertDocument(
    documents: IAifDocumentInput[]
  ): Promise<IAifDocument[]> {
    try {
      const insertedDocs = await mongoInsertMany(this.model, documents);
      return insertedDocs;
    } catch (error) {
      logger.error("Error inserting documents into Mongo", { error });
      throw error;
    }
  }

  public async updateMongoTransactions(clientId?: number): Promise<{
    updatedCount: number;
    syncedCount: number;
    updatedDocuments: IUpdatedDocumentSummary[];
    syncedDocuments: ISyncedDocumentSummary[];
  }> {
    let totalUpdatedCount = 0;
    let totalSyncedCount = 0;
    const allUpdatedDocuments: IUpdatedDocumentSummary[] = [];
    const allSyncedDocuments: ISyncedDocumentSummary[] = [];

    logger.info(
      `Initiating Mongo Transaction Update. ClientId: ${clientId || "ALL"}`,
      { console: true }
    );

    try {
      const sqlUtil = new SqlUtil();
      await this.connect();
      const db = this.getDb();
      if (!db) {
        logger.error("Database connection is not available.");
        return {
          updatedCount: 0,
          syncedCount: 0,
          updatedDocuments: [],
          syncedDocuments: [],
        };
      }

      const processBatch = async (pgData: AifDocumentDetail[]) => {
        logger.info(
          `Processing batch of ${pgData.length} PostgreSQL documents.`
        );
        const bulkOperations: mongoose.BulkWriteOperation<IAifDocument>[] = [];
        const documentsToUpdate: IUpdatedDocumentSummary[] = [];
        const documentsToSync: ISyncedDocumentSummary[] = [];

        const uniqueFilters = pgData.map((data) => ({
          clientId: data.client_code,
          transactionNo: data.user_attr1,
        }));

        if (uniqueFilters.length === 0) return;

        const mongoQuery: Record<string, unknown> = {
          $or: uniqueFilters,
          sourceUser: "system",
        };

        logger.info("Fetching corresponding MongoDB documents...");
        const mongoDocs = await mongoFind(this.model, mongoQuery);
        const mongoDocMap = new Map<string, IAifDocument>();
        mongoDocs.forEach((doc) => {
          mongoDocMap.set(`${doc.clientId}-${doc.transactionNo}`, doc);
        });

        for (const data of pgData) {
          const key = `${data.client_code}-${data.user_attr1}`;
          const mongoDoc = mongoDocMap.get(key);

          if (mongoDoc) {
            if (mongoDoc.transactionNo !== data.transaction_reference_id) {
              bulkOperations.push({
                updateOne: {
                  filter: { _id: mongoDoc._id },
                  update: {
                    $set: {
                      transactionNo: data.transaction_reference_id,
                    },
                  },
                },
              });
              documentsToUpdate.push({
                clientId: data.client_code,
                oldTransactionNo: mongoDoc.transactionNo,
                newTransactionNo: data.transaction_reference_id,
                documentType: mongoDoc.documentType,
                processCode: mongoDoc.processCode,
              });
            } else {
              documentsToSync.push({
                clientId: data.client_code,
                transactionNo: mongoDoc.transactionNo,
              });
            }
          }
        }

        if (bulkOperations.length > 0) {
          logger.info(
            `Executing bulk write for ${bulkOperations.length} operations...`
          );
          const bulkWriteResult: IBulkWriteResult = await mongoBulkWrite(
            this.model,
            bulkOperations
          );
          totalUpdatedCount += bulkWriteResult.modifiedCount;
          allUpdatedDocuments.push(...documentsToUpdate);
        }

        totalSyncedCount += documentsToSync.length;
        allSyncedDocuments.push(...documentsToSync);
      };

      // Stream updates with throttling
      await sqlUtil.streamUpdateDetails(1000, processBatch, clientId);

      logger.info(
        `Mongo update completed. Updated: ${totalUpdatedCount}, Synced: ${totalSyncedCount}`,
        { console: true }
      );

      await this.disconnect();
      return {
        updatedCount: totalUpdatedCount,
        syncedCount: totalSyncedCount,
        updatedDocuments: allUpdatedDocuments,
        syncedDocuments: allSyncedDocuments,
      };
    } catch (error) {
      logger.error("Mongo transaction update error", { error });
      throw error;
    }
  }

  private convertCutoffTmsToDate(cutoffTms: string): Date | null {
    try {
      // Assuming cutoffTms is in "YYYY-MM-DDTHH:mm:ss.SSSS" format
      const date = new Date(cutoffTms);
      if (isNaN(date.getTime())) {
        logger.error({
          category: "task-steps",
          message: `Invalid cutoffTms date string: ${cutoffTms}`,
        });
        return null;
      }
      return date;
    } catch (error) {
      logger.error({
        category: "task-steps",
        message: `Error converting cutoffTms to Date: ${error}`,
      });
      return null;
    }
  }

  public async getDocumentsCreatedAfterDate(
    date: Date
  ): Promise<IAifDocument[]> {
    try {
      await this.connect();
      const pipeline: PipelineStage[] = [
        {
          $addFields: {
            createdOnDate: {
              $dateFromString: {
                dateString: "$createdOn",
                format: "%d/%m/%Y, %I:%M:%S %p", // Matches "8/3/2024, 10:49:51 AM"
                onError: new Date(0), // Default to epoch if conversion fails
                onNull: new Date(0), // Default to epoch if createdOn is null
              },
            },
          },
        },
        {
          $match: {
            createdOnDate: { $gt: date }, // Filter for documents created after the provided date
          },
        },
        {
          $project: {
            createdOnDate: 0, // Exclude the temporary createdOnDate field from the final output
          },
        },
      ];

      const documents = await mongoAggregate(this.model, pipeline);
      await this.disconnect();
      return documents;
    } catch (error) {
      logger.error({
        category: "task-steps",
        message: `Error fetching documents by date: ${error}`,
      });
      throw error;
    }
  }
}
