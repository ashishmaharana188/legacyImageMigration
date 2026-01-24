import {
  connectMongo,
  disconnectMongo,
  getMongoModel,
  getMongoDb,
} from "../../utils/dbConnect";
import mongoose, { Document, PipelineStage } from "mongoose";
import logger from "../../utils/logger";
import {
  MongoDuplicateCheckResult,
  SqlLog,
  MongoCountResult,
  MongoDuplicateGroupResult,
} from "./dataCleanTypes";
import { mongoAggregate, mongoDeleteMany } from "./dataCleanCore";
import { IAifDocument } from "../imageDataTransfer/imageDataTransferTypes";

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
      // Parse cutoffDateString (e.g., "9/5/2025") into a Date object at 00:00:00 AM
      const [day, month, year] = cutoffDateString.split("/").map(Number);
      // Month is 0-indexed in JavaScript Date objects
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
      logger.debug({
        category: "task-steps",
        message: `sanityCheckMongoDuplicates: Using cutoffDate for comparison: ${cutoffDate.toISOString()}`,
      });
    }

    logger.debug({
      category: "task-steps",
      message: `sanityCheckMongoDuplicates: Received dryRun: ${dryRun}, clientId: ${
        clientId || "N/A"
      }`,
    });

    try {
      await this.connect();

      const pipeline: PipelineStage[] = [
        ...(clientId ? [{ $match: { clientId: clientId } }] : []),
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
      const documentsAfterCutoff = await mongoAggregate<MongoCountResult>(
        this.model as any,
        [
          ...pipeline.slice(
            0,
            pipeline.findIndex((stage) => "$group" in stage)
          ), // Get stages up to the group stage
          { $count: "count" },
        ]
      );

      logger.info({
        category: "task-steps",
        message: `sanityCheckMongoDuplicates: Documents after cutoff date filter: ${
          documentsAfterCutoff[0]?.count || 0
        }`,
      });

      const duplicates = await mongoAggregate<MongoDuplicateGroupResult>(
        this.model as any,
        pipeline
      );

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
          const deleteResult = await mongoDeleteMany(this.model as any, {
            _id: { $in: allDocumentsToDeleteIds },
          });
          logs.push({
            row: 0,
            status: "info",
            message: `Deleted ${deleteResult.deletedCount} oldest duplicate documents across all groups.`,
          });
          logger.debug({
            category: "task-steps",
            message: `Deleted ${deleteResult.deletedCount} oldest duplicate documents across all groups.`,
          });
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
      logger.error({
        category: "task-steps",
        message: `sanityCheckMongoDuplicates failed: ${error}`,
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
