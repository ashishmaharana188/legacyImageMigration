import mongoose, { Document } from "mongoose";
import logger from "../../utils/logger"; // Adjusted path
import { SqlUtil } from "./sqlUtil"; // Import SqlUtil for PostgreSQL operations
import {
  connectMongo,
  disconnectMongo,
  getMongoModel,
  getMongoDb,
} from "../../utils/dbConnect"; // Adjusted path
import {
  mongoFindOne,
  mongoInsertMany,
  mongoBulkWrite,
  mongoFind,
  mongoAggregate,
} from "./imageDataTransferCore";

export class MongoUtil {
  private model: mongoose.Model<Document>;

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
        logger.warn({
          category: "app-flow",
          message: "MongoDB not connected. Attempting to connect...",
        });
        await this.connect();
      }
      const db = this.getDb();
      if (!db) {
        logger.error({
          category: "app-flow",
          message: "Database connection is not available.",
        });
        return [];
      }

      const result = await mongoFindOne(this.model);
      logger.info({
        category: "app-flow",
        message: `MongoDB connection test successful. Found ${result ? 1 : 0} document(s).`,
      });
      return result ? [result] : [];
    } catch (error) {
      logger.error({
        category: "app-flow",
        message: `MongoDB connection test failed: ${error}`,
      });
      throw error;
    }
  }

  public async transferDataFromPostgres(clientCode?: string): Promise<{
    transferredCount: number;
    documents?: Document[]; // Added to return the documents
  }> {
    try {
      const sqlUtil = new SqlUtil(); // Use SqlUtil
      await this.connect();
      const db = this.getDb();
      if (!db) {
        logger.error({
          category: "task-steps",
          message: "Database connection is not available.",
        });
        return { transferredCount: 0 };
      }

      let pgClientId: number | undefined;
      if (clientCode) {
        const clientRes = await sqlUtil.getClientIdByCode(clientCode);
        if (clientRes) {
          pgClientId = clientRes.id;
          logger.info({
            category: "task-steps",
            message: `Found PostgreSQL client_id: ${pgClientId} for client_code: ${clientCode}`,
          });
        } else {
          logger.warn({
            category: "task-steps",
            message: `Client code '${clientCode}' not found in PostgreSQL. Aborting transfer.`,
          });
          return { transferredCount: 0 };
        }
      }

      const transactionsMap: Record<string, string> = {
        IC: "ICP",
        NCT: "NCTP",
      };

      const pgData = await sqlUtil.getAifDocumentDetails(pgClientId);
      logger.info({
        category: "task-steps",
        message: `Fetched ${pgData.length} documents from PostgreSQL for transfer. (pgClientId: ${pgClientId || "N/A"})`,
        pgClientId: pgClientId || "N/A",
        pgDataCount: pgData.length,
      });
      const documentsToInsert: Document[] = [];

      for (const data of pgData) {
        const docType = data.document_type;
        const docProcess = data.document_process;

        const doc: Document = {
          activityStatus: data.activity_status || "O",
          applicationId: data.application_id || null,
          clientId: data.client_code, // Use the correct client_code
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
          processCode: transactionsMap[docProcess],
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
        await this.insertDocument(documentsToInsert);
      }

      await this.disconnect();
      return { transferredCount: pgData.length, documents: documentsToInsert };
    } catch (error) {
      logger.error({
        category: "task-steps",
        message: `Data transfer error: ${error}`,
      });
      throw error;
    }
  }

  public async insertDocument(documents: Document[]): Promise<void> {
    try {
      await mongoInsertMany(this.model, documents);
    } catch (error) {
      logger.error({
        category: "task-steps",
        message: `Error inserting documents: ${error}`,
      });
      throw error;
    }
  }

  public async updateMongoTransactions(clientId?: number): Promise<{
    updatedCount: number;
    syncedCount: number;
    updatedDocuments: Document[];
    syncedDocuments: Document[];
  }> {
    let totalUpdatedCount = 0;
    let totalSyncedCount = 0;
    const allUpdatedDocuments: Document[] = [];
    const allSyncedDocuments: Document[] = [];

    logger.info({
      category: "task-steps",
      message: `Initiating updateMongoTransactions for clientId: ${clientId || "all"}`,
      clientId: clientId || "N/A",
    });

    try {
      const sqlUtil = new SqlUtil(); // Use SqlUtil
      await this.connect();
      const db = this.getDb();
      if (!db) {
        logger.error({
          category: "task-steps",
          message: "Database connection is not available.",
        });
        return {
          updatedCount: 0,
          syncedCount: 0,
          updatedDocuments: [],
          syncedDocuments: [],
        };
      }

      const processBatch = async (pgData: unknown[]) => {
        logger.info({
          category: "task-steps",
          message: `Processing batch of ${pgData.length} PostgreSQL documents.`,
          pgDataSample: pgData.slice(0, 2), // Log first 2 items for brevity
          pgDataCount: pgData.length,
        });
        const bulkOperations: mongoose.BulkWriteOperation<Document>[] = [];
        const documentsToUpdate: Document[] = [];
        const documentsToSync: Document[] = [];

        const uniqueFilters = pgData.map((data) => ({
          clientId: data.client_code, // Use client_code (string) from PostgreSQL
          transactionNo: data.user_attr1,
        }));

        if (uniqueFilters.length === 0) {
          logger.warn({
            category: "task-steps",
            message:
              "No unique filters generated from PostgreSQL data. Skipping batch.",
          });
          return;
        }

        const mongoQuery: Record<string, unknown> = { $or: uniqueFilters, sourceUser: "system" };
        // The clientId filter is already part of the uniqueFilters if clientId was provided to streamUpdateDetails
        // No need to add it again as a top-level AND condition.

        logger.info({
          category: "task-steps",
          message: "Fetching MongoDB documents with query.",
          mongoQuery: JSON.stringify(mongoQuery),
          uniqueFilters: JSON.stringify(uniqueFilters), // Log uniqueFilters as well
        });
        const mongoDocs = await mongoFind(this.model, mongoQuery);
        logger.info({
          category: "task-steps",
          message: `Fetched ${mongoDocs.length} documents from MongoDB.`,
          mongoDocsCount: mongoDocs.length,
        });
        const mongoDocMap = new Map<string, Document>();
        mongoDocs.forEach((doc) => {
          mongoDocMap.set(`${doc.clientId}-${doc.transactionNo}`, doc);
        });

        for (const data of pgData as Record<string, unknown>[]) {
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
          const bulkWriteResult = await mongoBulkWrite(this.model, bulkOperations);
          totalUpdatedCount += bulkWriteResult.modifiedCount;
          allUpdatedDocuments.push(...documentsToUpdate);
        }

        totalSyncedCount += documentsToSync.length;
        allSyncedDocuments.push(...documentsToSync);
      };

      await sqlUtil.streamUpdateDetails(1000, processBatch, clientId);

      logger.info({
        category: "task-steps",
        message: `Mongo transaction update process completed. Updated: ${totalUpdatedCount}, Synced: ${totalSyncedCount}`,
      });

      await this.disconnect();
      return {
        updatedCount: totalUpdatedCount,
        syncedCount: totalSyncedCount,
        updatedDocuments: allUpdatedDocuments,
        syncedDocuments: allSyncedDocuments,
      };
    } catch (error) {
      logger.error({
        category: "task-steps",
        message: `Mongo transaction update error: ${error}`,
      });
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

  public async getDocumentsCreatedAfterDate(date: Date): Promise<Document[]> {
    try {
      await this.connect();
      const pipeline: Record<string, unknown>[] = [
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
