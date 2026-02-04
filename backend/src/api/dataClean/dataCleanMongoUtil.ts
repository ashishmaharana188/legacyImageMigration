// backend/src/api/dataClean/dataCleanMongoUtil.ts

import {
  connectMongo,
  disconnectMongo,
  getMongoModel,
  getMongoDb,
} from "../../utils/dbConnect";
import mongoose, { Document, PipelineStage } from "mongoose";
import { createFeatureLogger } from "../../utils/logger";
import {
  SqlLog,
  MongoCountResult,
  MongoDuplicateGroupResult,
} from "./dataCleanTypes";
import { mongoAggregate, mongoDeleteMany } from "./dataCleanCore";
import { IAifDocument } from "../imageDataTransfer/imageDataTransferTypes";

const logger = createFeatureLogger("dataClean");

export class DuplicateProcessorMongoUtil {
  private model: mongoose.Model<IAifDocument>;

  constructor() {
    this.model = getMongoModel() as mongoose.Model<IAifDocument>;
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

  public async sanityCheckMongoDuplicates(params: {
    dryRun?: boolean;
    cutoffTms?: string;
    clientId?: string;
  }): Promise<{
    result: "success" | "failed";
    dryRun: boolean;
    totalDuplicateGroups: number;
    totalDuplicateDocuments: number;
    logs: SqlLog[];
  }> {
    const logs: SqlLog[] = [];
    const { dryRun = true, cutoffTms: cutoffDateString, clientId } = params;
    let cutoffDate: Date | null = null;

    if (cutoffDateString) {
      const [day, month, year] = cutoffDateString.split("/").map(Number);
      cutoffDate = new Date(year, month - 1, day, 0, 0, 0, 0);

      if (isNaN(cutoffDate.getTime())) {
        logs.push({
          row: 0,
          status: "error",
          message: `Invalid cutoffDateString provided: ${cutoffDateString}`,
        });
        await this.disconnect();
        return {
          result: "failed",
          dryRun,
          totalDuplicateGroups: 0,
          totalDuplicateDocuments: 0,
          logs,
        };
      }
    }

    try {
      await this.connect();

      const pipeline: PipelineStage[] = [
        ...(clientId ? [{ $match: { clientId: clientId } }] : []),
        {
          $addFields: {
            parts: { $split: ["$createdOn", ", "] },
          },
        },
        {
          $addFields: {
            datePart: { $arrayElemAt: ["$parts", 0] },
            timePart: { $arrayElemAt: ["$parts", 1] },
          },
        },
        // ... (standard parsing fields) ...
        {
          $addFields: {
            createdOnDate: {
              $dateFromString: {
                dateString: "$createdOn",
                onError: new Date(0),
              },
            },
          },
        },
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
                      regex: "_TRANSACTION_NUMBER_(d+)",
                    },
                  },
                },
                in: { $arrayElemAt: ["$$regexMatch.captures", 0] },
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
            },
          },
        },
        { $match: { count: { $gt: 1 } } },
      ];

      logger.info("Executing Mongo Aggregation...", { console: true });

      const duplicates = await mongoAggregate<MongoDuplicateGroupResult>(
        this.model as any,
        pipeline
      );

      const totalDuplicateGroups = duplicates.length;
      const totalDuplicateDocuments = duplicates.reduce(
        (sum, dup) => sum + dup.count,
        0
      );

      logger.info(
        `Mongo Aggregation complete. Groups: ${totalDuplicateGroups}, Total Docs: ${totalDuplicateDocuments}`,
        { category: "task-steps", console: true }
      );

      if (!dryRun) {
        logger.info(
          "sanityCheckMongoDuplicates: Dry run is false, proceeding with deletion.",
          { category: "task-steps", console: true }
        );

        const allDocumentsToDeleteIds: mongoose.Types.ObjectId[] = [];
        for (const dupGroup of duplicates) {
          if (dupGroup.documents.length > 1) {
            dupGroup.documents.sort((a, b) => {
              const dateComparison =
                new Date(a.createdOnDate).getTime() -
                new Date(b.createdOnDate).getTime();
              if (dateComparison !== 0) return dateComparison;
              return 0;
            });
            const documentsToDeleteIds = dupGroup.documents
              .slice(0, -1)
              .map((doc) => doc._id);
            allDocumentsToDeleteIds.push(...documentsToDeleteIds);
          }
        }

        if (allDocumentsToDeleteIds.length > 0) {
          const deleteResult = await mongoDeleteMany(this.model as any, {
            _id: { $in: allDocumentsToDeleteIds },
          });
          logger.info(
            `Successfully deleted ${deleteResult.deletedCount} documents.`,
            { console: true }
          );
          logs.push({
            row: 0,
            status: "info",
            message: `Deleted ${deleteResult.deletedCount} oldest duplicate documents.`,
          });
        }
      }

      await this.disconnect();

      return {
        result: "success",
        dryRun,
        // [STANDARD] Removed 'duplicates' array
        totalDuplicateGroups,
        totalDuplicateDocuments,
        logs,
      };
    } catch (error) {
      logger.error(`sanityCheckMongoDuplicates failed: ${error}`, {
        category: "task-steps",
        console: true,
      });
      logs.push({
        row: 0,
        status: "error",
        message: `sanityCheckMongoDuplicates failed: ${error}`,
      });
      return {
        result: "failed",
        dryRun,
        totalDuplicateGroups: 0,
        totalDuplicateDocuments: 0,
        logs,
      };
    }
  }
}
