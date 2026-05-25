// backend/src/api/dataClean/dataCleanMongoUtil.ts

import {
  connectMongo,
  disconnectMongo,
  getMongoModel,
  getMongoDb,
} from "../../utils/dbConnect";
import mongoose, { PipelineStage } from "mongoose";
import { createFeatureLogger } from "../../utils/logger";
import {
  SqlLog,
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

  private parseCutoffDate(cutoffDateString?: string): Date | null {
    if (!cutoffDateString) return null;

    const trimmed = cutoffDateString.trim();
    const isoDate = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (isoDate) {
      const [, year, month, day] = isoDate.map(Number);
      return new Date(year, month - 1, day, 0, 0, 0, 0);
    }

    const slashDate = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (slashDate) {
      const first = Number(slashDate[1]);
      const second = Number(slashDate[2]);
      const year = Number(slashDate[3]);

      const month = first > 12 ? second : first;
      const day = first > 12 ? first : second;
      return new Date(year, month - 1, day, 0, 0, 0, 0);
    }

    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private getObjectIdTime(id: mongoose.Types.ObjectId): number {
    try {
      return new mongoose.Types.ObjectId(String(id)).getTimestamp().getTime();
    } catch {
      return 0;
    }
  }

  private parseDocumentTime(doc: {
    _id: mongoose.Types.ObjectId;
    createdOn?: string | Date | null;
    createdOnDate?: Date | string | null;
  }): number {
    const dateValue = doc.createdOn ?? doc.createdOnDate;
    if (dateValue instanceof Date) return dateValue.getTime();

    if (typeof dateValue === "string" && dateValue.trim() !== "") {
      const direct = new Date(dateValue);
      if (!Number.isNaN(direct.getTime())) return direct.getTime();

      const slashDateTime = dateValue
        .trim()
        .match(
          /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:,\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([ap]m)?)?$/i,
        );
      if (slashDateTime) {
        const first = Number(slashDateTime[1]);
        const second = Number(slashDateTime[2]);
        const year = Number(slashDateTime[3]);
        let hours = Number(slashDateTime[4] || 0);
        const minutes = Number(slashDateTime[5] || 0);
        const seconds = Number(slashDateTime[6] || 0);
        const meridiem = slashDateTime[7]?.toLowerCase();

        if (meridiem === "pm" && hours < 12) hours += 12;
        if (meridiem === "am" && hours === 12) hours = 0;

        const month = first > 12 ? second : first;
        const day = first > 12 ? first : second;
        const parsed = new Date(year, month - 1, day, hours, minutes, seconds);
        if (!Number.isNaN(parsed.getTime())) return parsed.getTime();
      }
    }

    return this.getObjectIdTime(doc._id);
  }

  public async sanityCheckMongoDuplicates(params: {
    dryRun?: boolean;
    cutoffTms?: string;
    clientCode?: string;
  }): Promise<{
    result: "success" | "failed";
    dryRun: boolean;
    totalDuplicateGroups: number;
    totalDuplicateDocuments: number;
    logs: SqlLog[];
  }> {
    const logs: SqlLog[] = [];
    const { dryRun = true, cutoffTms: cutoffDateString, clientCode } = params;
    const cutoffDate = this.parseCutoffDate(cutoffDateString);

    if (cutoffDateString && !cutoffDate) {
      logs.push({
        row: 0,
        status: "error",
        message: `Invalid cutoffDateString provided: ${cutoffDateString}`,
      });
      return {
        result: "failed",
        dryRun,
        totalDuplicateGroups: 0,
        totalDuplicateDocuments: 0,
        logs,
      };
    }

    try {
      await this.connect();

      const pipeline: PipelineStage[] = [
        ...(clientCode ? [{ $match: { clientId: clientCode.trim() } }] : []),
        {
          $addFields: {
            createdOnDate: {
              $dateFromString: {
                dateString: "$createdOn",
                onError: null,
                onNull: null,
              },
            },
          },
        },
        {
          $addFields: {
            modifiedDocumentPathNo: {
              $let: {
                vars: {
                  regexMatch: {
                    $regexFind: {
                      input: { $ifNull: ["$documentPath", ""] },
                      regex: /_TRANSACTION_NUMBER_(\d+)/,
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
              $push: {
                _id: "$_id",
                createdOn: "$createdOn",
                createdOnDate: "$createdOnDate",
              },
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

      const scopedDuplicates = cutoffDate
        ? duplicates.filter((dupGroup) =>
            dupGroup.documents.some(
              (doc) => this.parseDocumentTime(doc) >= cutoffDate.getTime(),
            ),
          )
        : duplicates;

      const totalDuplicateGroups = scopedDuplicates.length;
      const totalDuplicateDocuments = scopedDuplicates.reduce(
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
        for (const dupGroup of scopedDuplicates) {
          if (dupGroup.documents.length > 1) {
            dupGroup.documents.sort((a, b) => {
              const dateComparison =
                this.parseDocumentTime(a) - this.parseDocumentTime(b);
              if (dateComparison !== 0) return dateComparison;
              return String(a._id).localeCompare(String(b._id));
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
