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
  MongoDuplicateCheckResult,
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

  private convertCutoffTmsToDate(cutoffTms: string): Date | null {
    try {
      const date = new Date(cutoffTms);
      if (isNaN(date.getTime())) {
        // [FIX] Pass string message first, then metadata object
        logger.error(`Invalid cutoffTms date string: ${cutoffTms}`, {
          category: "task-steps",
          console: true,
        });
        return null;
      }
      return date;
    } catch (error) {
      logger.error(`Error converting cutoffTms to Date: ${error}`, {
        category: "task-steps",
        console: true,
      });
      return null;
    }
  }

  public async sanityCheckMongoDuplicates(params: {
    dryRun?: boolean;
    cutoffTms?: string;
    clientId?: string;
  }): Promise<{
    result: "success" | "failed";
    dryRun: boolean;
    duplicates: MongoDuplicateCheckResult[];
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
          duplicates: [],
          totalDuplicateGroups: 0,
          totalDuplicateDocuments: 0,
          logs,
        };
      }
      logger.debug(
        `sanityCheckMongoDuplicates: Using cutoffDate for comparison: ${cutoffDate.toISOString()}`,
        { category: "task-steps" }
      );
    }

    logger.debug(
      `sanityCheckMongoDuplicates: Received dryRun: ${dryRun}, clientId: ${
        clientId || "N/A"
      }`,
      { category: "task-steps" }
    );

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
        {
          $addFields: {
            dateComponents: { $split: ["$datePart", "/"] },
            timeComponents: { $split: ["$timePart", " "] },
          },
        },
        {
          $addFields: {
            day: { $toInt: { $arrayElemAt: ["$dateComponents", 0] } },
            month: { $toInt: { $arrayElemAt: ["$dateComponents", 1] } },
            year: { $toInt: { $arrayElemAt: ["$dateComponents", 2] } },
            timeOnly: { $arrayElemAt: ["$timeComponents", 0] },
            ampm: { $arrayElemAt: ["$timeComponents", 1] },
          },
        },
        {
          $addFields: {
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
            },
          },
        },
        {
          $match: {
            count: { $gt: 1 },
          },
        },
      ];

      const documentsAfterCutoff = await mongoAggregate<MongoCountResult>(
        this.model as any,
        [
          ...pipeline.slice(
            0,
            pipeline.findIndex((stage) => "$group" in stage)
          ),
          { $count: "count" },
        ]
      );

      logger.info(
        `sanityCheckMongoDuplicates: Documents after cutoff date filter: ${
          documentsAfterCutoff[0]?.count || 0
        }`,
        { category: "task-steps", console: true }
      );

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
        `sanityCheckMongoDuplicates: dry-run complete. Found ${totalDuplicateDocuments} duplicate documents across ${totalDuplicateGroups} groups.`,
        { category: "task-steps", console: true }
      );

      if (!dryRun) {
        logger.info(
          "sanityCheckMongoDuplicates: Dry run is false, proceeding with deletion of oldest duplicates.",
          { category: "task-steps", console: true }
        );
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
          const deleteResult = await mongoDeleteMany(this.model as any, {
            _id: { $in: allDocumentsToDeleteIds },
          });
          logs.push({
            row: 0,
            status: "info",
            message: `Deleted ${deleteResult.deletedCount} oldest duplicate documents across all groups.`,
          });
          logger.debug(
            `Deleted ${deleteResult.deletedCount} oldest duplicate documents across all groups.`,
            { category: "task-steps" }
          );
        }
        logs.push({
          row: 0,
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
        duplicates: [],
        totalDuplicateGroups: 0,
        totalDuplicateDocuments: 0,
        logs,
      };
    }
  }
}
