import fs from "fs/promises";
import path from "path";
import { createFeatureLogger } from "../../utils/logger";
import { broadcast } from "../../utils/webSocketService";
import {
  SplitResult,
  SplitFileDetail,
  SplitProgressComplete,
  SplitProgressUpdate,
} from "./splitProcessorTypes";
import { performSplit } from "./splitProcessor";
import { SplitProcessorUtil } from "./splitProcessorUtil";

const logger = createFeatureLogger("splitProcessor");

const baseFolder = path.join(process.cwd(), "output");
const splitFolder = path.join(process.cwd(), "split_output");

export class SplitProcessorWrapper {
  private splitProcessorUtil: SplitProcessorUtil;

  constructor() {
    this.splitProcessorUtil = new SplitProcessorUtil();
  }

  // [REMOVED] countPdfFiles method - It caused the unit mismatch (Files vs Pages).

  async splitFiles(): Promise<SplitResult> {
    return this._executeSplit(false, "File splitting complete");
  }

  async splitFilesWithMuPDF(): Promise<SplitResult> {
    return this._executeSplit(true, "File splitting with MuPDF complete");
  }

  private async _executeSplit(
    useMuPDF: boolean,
    completionStatus: string
  ): Promise<SplitResult> {
    const createdSplitFiles: SplitFileDetail[] = [];

    // [FIX] Strictly fetch total from CSV. No fallback to file count.
    let totalExpectedPagesFromCsv = 0;
    try {
      totalExpectedPagesFromCsv =
        await this.splitProcessorUtil.getTotalExpectedPagesFromCsv();
    } catch (e) {
      logger.warn("Could not fetch total expected pages from CSV.");
    }

    // If 0, we leave it as 0. Frontend handles 0 as "Indeterminate" or "Processing..."
    // Falling back to '1' or 'file count' would break the percentage calculation.

    let totalSplitFilesGenerated = 0;
    let splitErrors = 0;

    logger.info(
      `Initiating file splitting ${
        useMuPDF ? "(MuPDF)" : ""
      }. Total Expected: ${totalExpectedPagesFromCsv}`,
      { console: true }
    );

    await fs.mkdir(splitFolder, { recursive: true });
    await fs.mkdir(baseFolder, { recursive: true });

    this.sendProgress(0, 0, totalExpectedPagesFromCsv, "Starting...");

    let lastBroadcastTime = 0;

    // [NOTE] This function injects the CSV total into updates from the worker
    const handleWorkerProgress = (update: SplitProgressUpdate) => {
      const now = Date.now();
      // Throttle updates to avoid flooding WebSocket
      if (now - lastBroadcastTime > 1000 || update.status === "Error") {
        const enrichedUpdate = {
          ...update,
          totalExpectedPagesFromCsv, // <--- Correctly maps CSV total here
        };
        broadcast(JSON.stringify(enrichedUpdate));
        lastBroadcastTime = now;
      }
    };

    const scanAndProcessDirectory = async (
      inputDir: string,
      outputDir: string
    ) => {
      let items: string[];
      try {
        items = await fs.readdir(inputDir);
      } catch (err) {
        logger.error(`Failed to read directory ${inputDir}`, { error: err });
        return;
      }

      for (const item of items) {
        const inputPath = path.join(inputDir, item);
        const nextOutputDir = path.join(outputDir, item);

        let stats;
        try {
          stats = await fs.stat(inputPath);
        } catch {
          continue;
        }

        if (stats.isDirectory()) {
          await fs.mkdir(nextOutputDir, { recursive: true });
          await scanAndProcessDirectory(inputPath, nextOutputDir);
        } else if (
          stats.isFile() &&
          [".pdf", ".tif", ".tiff"].includes(path.extname(item).toLowerCase())
        ) {
          const fileNameNoExt = path.parse(item).name;
          const parentFolderName = path.basename(outputDir);

          let targetSplitFolder: string;

          if (parentFolderName === fileNameNoExt) {
            targetSplitFolder = outputDir;
          } else {
            targetSplitFolder = path.join(outputDir, fileNameNoExt);
          }

          const result = await performSplit(
            inputPath,
            targetSplitFolder,
            logger,
            handleWorkerProgress,
            totalSplitFilesGenerated,
            splitErrors,
            useMuPDF
          );

          createdSplitFiles.push(...result.createdSplitFiles);
          totalSplitFilesGenerated = result.totalSplitFilesGenerated;
          splitErrors = result.splitErrors;

          logger.info(
            `Processed: ${item} -> ${result.createdSplitFiles.length} pages`
          );

          if (totalSplitFilesGenerated % 50 === 0) {
            logger.info(
              `Running... Processed ${totalSplitFilesGenerated} files`,
              { console: true }
            );
          }
        }
      }
    };

    await scanAndProcessDirectory(baseFolder, splitFolder);

    logger.info(
      `Split Task Completed. Generated: ${totalSplitFilesGenerated}, Errors: ${splitErrors}`,
      { console: true }
    );

    const completionUpdate: SplitProgressComplete = {
      type: "splitProgressComplete",
      taskKey: "splitFiles",
      totalSplitFilesGenerated,
      splitErrors,
      totalExpectedPagesFromCsv: totalExpectedPagesFromCsv,
      status: completionStatus,
    };
    broadcast(JSON.stringify(completionUpdate));

    return {
      summary: {
        totalSplitFilesGenerated,
        splitErrors,
        totalExpectedPagesFromCsv,
      },
    };
  }

  private sendProgress(
    generated: number,
    errors: number,
    total: number,
    statusMsg: string
  ) {
    const update: SplitProgressUpdate = {
      type: "splitProgressUpdate",
      taskKey: "splitFiles",
      totalSplitFilesGenerated: generated,
      splitErrors: errors,
      totalExpectedPagesFromCsv: total,
      currentlySplittingFiles: "processing...",
      status: statusMsg,
    };
    broadcast(JSON.stringify(update));
  }
}
