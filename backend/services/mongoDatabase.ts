import {
  connectMongo,
  disconnectMongo,
  getMongoModel,
  getMongoDb,
} from "../controllers/dbConnect";
import mongoose from "mongoose";
import logger from "../utils/logger";

interface MongoDuplicateCheckResult {
  _id: { clientId: string; transactionNo: string };
  count: number;
  documents: { _id: mongoose.Types.ObjectId; createdOnDate: Date }[];
}

export class MongoDatabase {
  private model: mongoose.Model<any>;

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

  public async testConnectionAndQuery(): Promise<any[]> {
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

      const result = await this.model.find({}).limit(1).lean();
      logger.info({
        category: "app-flow",
        message: `MongoDB connection test successful. Found ${result.length} document(s).`,
      });
      return result;
    } catch (error) {
      logger.error({
        category: "app-flow",
        message: `MongoDB connection test failed: ${error}`,
      });
      throw error;
    }
  }

  public async transferDataFromPostgres(): Promise<{
    transferredCount: number;
    documents?: any[]; // Added to return the documents
  }> {
    try {
      const database = new (await import("./database.js")).Database();
      await this.connect();
      const db = this.getDb();
      if (!db) {
        logger.error({
          category: "task-steps",
          message: "Database connection is not available.",
        });
        return { transferredCount: 0 };
      }

      const transactionsMap: Record<string, string> = {
        IC: "ICP",
        NCT: "NCTP",
      };

      const pgData = await database.getAifDocumentDetails();
      const documentsToInsert = [];

      for (const data of pgData) {
        const docType = data.document_type;
        const docProcess = data.document_process;

        const doc = {
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

  public async insertDocument(documents: any[]): Promise<void> {
    try {
      await this.model.insertMany(documents);
    } catch (error) {
      logger.error({
        category: "task-steps",
        message: `Error inserting documents: ${error}`,
      });
      throw error;
    }
  }

  public async updateMongoTransactions(): Promise<{
    updatedCount: number;
    syncedCount: number;
    updatedDocuments: any[];
    syncedDocuments: any[];
  }> {
    let totalUpdatedCount = 0;
    let totalSyncedCount = 0;
    const allUpdatedDocuments: any[] = [];
    const allSyncedDocuments: any[] = [];

    try {
      const database = new (await import("./database.js")).Database();
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

      const processBatch = async (pgData: any[]) => {
        const bulkOperations = [];
        const documentsToUpdate = [];
        const documentsToSync = [];

        const uniqueFilters = pgData.map((data) => ({
          clientId: data.client_code,
          transactionNo: data.user_attr1,
        }));

        if (uniqueFilters.length === 0) {
          return;
        }

        const mongoDocs = await this.model.find({ $or: uniqueFilters }).lean();
        const mongoDocMap = new Map<string, any>();
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
          const bulkWriteResult = await this.model.bulkWrite(bulkOperations);
          totalUpdatedCount += bulkWriteResult.modifiedCount;
          allUpdatedDocuments.push(...documentsToUpdate);
        }

        totalSyncedCount += documentsToSync.length;
        allSyncedDocuments.push(...documentsToSync);
      };

      await database.streamUpdateDetails(200, processBatch);

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

  public async getDocumentsCreatedAfterDate(date: Date): Promise<any[]> {
    try {
      await this.connect();
      const pipeline: any[] = [
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

      const documents = await this.model.aggregate(pipeline).exec();
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

  public async sanityCheckMongoDuplicates(params: {
    dryRun?: boolean;
    cutoffTms?: string;
  }): Promise<{
    result: "success" | "failed";
    dryRun: boolean;
    duplicates: MongoDuplicateCheckResult[];
    totalDuplicateGroups: number;
    totalDuplicateDocuments: number;
    logs: any[];
  }> {
    const logs: any[] = [];
    const { dryRun = true, cutoffTms: cutoffDateString } = params;
    let cutoffDate: Date | null = null;

    if (cutoffDateString) {
      // Parse cutoffDateString (e.g., "9/5/2025") into a Date object at 00:00:00 AM
      const [day, month, year] = cutoffDateString.split("/").map(Number);
      // Month is 0-indexed in JavaScript Date objects
      cutoffDate = new Date(year, month - 1, day, 0, 0, 0, 0);

      if (isNaN(cutoffDate.getTime())) {
        logs.push({
          status: "error",
          message: `Invalid cutoffDateString provided: ${cutoffDateString}`,
        });
        await this.disconnect();
        return {
          result: "failed",
          dryRun,
          duplicates: [],
          totalDuplicateGroups: 0,
          totalDuplicateDocuments: 0,
          logs,
        };
      }
      logger.debug({
        category: "task-steps",
        message: `sanityCheckMongoDuplicates: Using cutoffDate for comparison: ${cutoffDate.toISOString()}`,
      });
    }

    logger.debug({
      category: "task-steps",
      message: `sanityCheckMongoDuplicates: Received dryRun: ${dryRun}`,
    });

    try {
      await this.connect();

      const pipeline: any[] = [
        {
          $addFields: {
            // Split by comma and space to get date and time parts
            parts: { $split: ["$createdOn", ", "] },
          },
        },
        {
          $addFields: {
            datePart: { $arrayElemAt: ["$parts", 0] }, // e.g., "8/3/2024"
            timePart: { $arrayElemAt: ["$parts", 1] }, // e.g., "10:49:51 AM"
          },
        },
        {
          $addFields: {
            // Split datePart by '/' to get day, month, year
            dateComponents: { $split: ["$datePart", "/"] },
            // Split timePart by ' ' to separate time and AM/PM
            timeComponents: { $split: ["$timePart", " "] },
          },
        },
        {
          $addFields: {
            day: { $toInt: { $arrayElemAt: ["$dateComponents", 0] } }, // Day is first in D/M/YYYY
            month: { $toInt: { $arrayElemAt: ["$dateComponents", 1] } }, // Month is second in D/M/YYYY
            year: { $toInt: { $arrayElemAt: ["$dateComponents", 2] } },
            timeOnly: { $arrayElemAt: ["$timeComponents", 0] }, // e.g., "10:49:51"
            ampm: { $arrayElemAt: ["$timeComponents", 1] }, // e.g., "AM"
          },
        },
        {
          $addFields: {
            // Split timeOnly by ':' to get hour, minute, second
            hmsComponents: { $split: ["$timeOnly", ":"] },
          },
        },
        {
          $addFields: {
            hour12: { $toInt: { $arrayElemAt: ["$hmsComponents", 0] } },
            minute: { $toInt: { $arrayElemAt: ["$hmsComponents", 1] } },
            second: { $toInt: { $arrayElemAt: ["$hmsComponents", 2] } },
          },
        },
        {
          $addFields: {
            // Convert 12-hour to 24-hour format
            hour24: {
              $cond: {
                if: { $eq: ["$ampm", "PM"] },
                then: {
                  $cond: {
                    if: { $eq: ["$hour12", 12] },
                    then: 12,
                    else: { $add: ["$hour12", 12] },
                  },
                },
                else: {
                  $cond: {
                    if: { $eq: ["$hour12", 12] },
                    then: 0,
                    else: "$hour12",
                  },
                },
              },
            },
          },
        },
        {
          $addFields: {
            // Construct the final Date object using $dateFromParts
            createdOnDate: {
              $dateFromParts: {
                year: "$year",
                month: "$month",
                day: "$day",
                hour: "$hour24",
                minute: "$minute",
                second: "$second",
              },
            },
          },
        },
        // Match documents created on or after the cutoff date
        ...(cutoffDate
          ? [{ $match: { createdOnDate: { $gte: cutoffDate } } }]
          : []),
        {
          $addFields: {
            modifiedDocumentPathNo: {
              $let: {
                vars: {
                  regexMatch: {
                    $regexFind: {
                      input: "$documentPath",
                      regex: "_TRANSACTION_NUMBER_(\\d+)",
                    },
                  },
                },
                in: {
                  $arrayElemAt: ["$$regexMatch.captures", 0],
                },
              },
            },
          },
        },
        {
          $group: {
            _id: {
              clientId: "$clientId",
              transactionNo: "$transactionNo",
              modifiedDocumentPathNo: "$modifiedDocumentPathNo",
              sourceUser: "$sourceUser",
            },
            count: { $sum: 1 },
            documents: {
              $push: { _id: "$_id", createdOnDate: "$createdOnDate" },
            }, // Correctly populate documents array
          },
        },
        {
          $match: {
            count: { $gt: 1 },
          },
        },
      ];

      // Log the count of documents after the cutoff date filter
      const documentsAfterCutoff = await this.model
        .aggregate([
          ...pipeline.slice(
            0,
            pipeline.findIndex((stage) => "$group" in stage)
          ), // Get stages up to the group stage
          { $count: "count" },
        ])
        .exec();

      logger.info({
        category: "task-steps",
        message: `sanityCheckMongoDuplicates: Documents after cutoff date filter: ${
          documentsAfterCutoff[0]?.count || 0
        }`,
      });

      const duplicates = await this.model
        .aggregate<MongoDuplicateCheckResult>(pipeline)
        .exec();

      const totalDuplicateGroups = duplicates.length;
      const totalDuplicateDocuments = duplicates.reduce(
        (sum, dup) => sum + dup.count,
        0
      );

      logger.info({
        category: "task-steps",
        message: `sanityCheckMongoDuplicates: dry-run complete. Found ${totalDuplicateDocuments} duplicate documents across ${totalDuplicateGroups} groups.`,
      });

      if (!dryRun) {
        logger.info({
          category: "task-steps",
          message:
            "sanityCheckMongoDuplicates: Dry run is false, proceeding with deletion of oldest duplicates.",
        });
        const allDocumentsToDeleteIds: mongoose.Types.ObjectId[] = [];
        for (const dupGroup of duplicates) {
          if (dupGroup.documents.length > 1) {
            dupGroup.documents.sort((a, b) => {
              const dateComparison =
                a.createdOnDate.getTime() - b.createdOnDate.getTime();
              if (dateComparison !== 0) {
                return dateComparison;
              }
              return (
                a._id.getTimestamp().getTime() - b._id.getTimestamp().getTime()
              );
            });

            const documentsToDeleteIds = dupGroup.documents
              .slice(0, -1)
              .map((doc) => doc._id);
            allDocumentsToDeleteIds.push(...documentsToDeleteIds);
          }
        }

        if (allDocumentsToDeleteIds.length > 0) {
          const deleteResult = await this.model.deleteMany({
            _id: { $in: allDocumentsToDeleteIds },
          });
          logs.push({
            status: "info",
            message: `Deleted ${deleteResult.deletedCount} oldest duplicate documents across all groups.`,
          });
          logger.debug({
            category: "task-steps",
            message: `Deleted ${deleteResult.deletedCount} oldest duplicate documents across all groups.`,
          });
        }
        logs.push({
          status: "info",
          message: "Oldest duplicate deletion process completed.",
        });
      }

      await this.disconnect();

      return {
        result: "success",
        dryRun,
        duplicates,
        totalDuplicateGroups,
        totalDuplicateDocuments,
        logs,
      };
    } catch (error) {
      logger.error({
        category: "task-steps",
        message: `sanityCheckMongoDuplicates failed: ${error}`,
      });
      logs.push({
        status: "error",
        message: `sanityCheckMongoDuplicates failed: ${error}`,
      });
      return {
        result: "failed",
        dryRun,
        duplicates: [],
        totalDuplicateGroups: 0,
        totalDuplicateDocuments: 0,
        logs,
      };
    }
  }
}
