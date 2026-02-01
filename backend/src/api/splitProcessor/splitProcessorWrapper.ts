import fs from "fs/promises";
import path from "path";
import winston from "winston";
// [FIX] Correctly import broadcast logic
import { broadcast } from "../../utils/webSocketService";
import {
  SplitResult,
  SplitFileDetail,
  SplitProgressComplete,
  SplitProgressUpdate,
} from "./splitProcessorTypes";
import { performSplit } from "./splitProcessor";
import { SplitProcessorUtil } from "./splitProcessorUtil";

const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: "logs/error.log", level: "error" }),
    new winston.transports.File({ filename: "logs/combined.log" }),
  ],
});

// [PRESERVED] Your original folder structure
const baseFolder = path.join(process.cwd(), "output");
const splitFolder = path.join(process.cwd(), "split_output");

export class SplitProcessorWrapper {
  private splitProcessorUtil: SplitProcessorUtil;

  constructor() {
    this.splitProcessorUtil = new SplitProcessorUtil();
  }

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

    // 1. Get total expected pages (for the 100% calculation)
    let totalExpectedPagesFromCsv = 0;
    try {
      totalExpectedPagesFromCsv =
        await this.splitProcessorUtil.getTotalExpectedPagesFromCsv();
    } catch (e) {
      logger.warn(
        "Could not fetch total expected pages from CSV, defaulting to 0."
      );
    }

    let totalSplitFilesGenerated = 0;
    let splitErrors = 0;

    logger.info(`Starting file splitting ${useMuPDF ? "(MuPDF)" : ""}`);
    await fs.mkdir(splitFolder, { recursive: true });
    await fs.mkdir(baseFolder, { recursive: true });

    // 2. Initial Broadcast (Sets UI to 0%)
    this.sendProgress(0, 0, totalExpectedPagesFromCsv, "Starting...");

    // [NEW] Throttling State
    let lastBroadcastTime = 0;

    // 3. Define the "Live Wire" Callback
    const handleWorkerProgress = (update: SplitProgressUpdate) => {
      const now = Date.now();
      // Throttle: Update only if 2s passed OR if it's an Error
      if (now - lastBroadcastTime > 2000 || update.status === "Error") {
        const enrichedUpdate = {
          ...update,
          totalExpectedPagesFromCsv, // Inject global total
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
        const outputPath = path.join(outputDir, item);

        let stats;
        try {
          stats = await fs.stat(inputPath);
        } catch {
          continue;
        }

        if (stats.isDirectory()) {
          await fs.mkdir(outputPath, { recursive: true });

          // Process files inside this directory
          const files = await fs.readdir(inputPath);

          // [FIX] Process sequentially to avoid memory spikes, or Promise.all for speed
          for (const file of files) {
            const filePath = path.join(inputPath, file);
            const fileStats = await fs.stat(filePath);

            if (fileStats.isFile() && file.toLowerCase().endsWith(".pdf")) {
              const result = await performSplit(
                filePath,
                outputPath,
                logger,
                handleWorkerProgress, // <--- [CRITICAL FIX] Pass the real callback here!
                totalSplitFilesGenerated,
                splitErrors,
                useMuPDF
              );

              createdSplitFiles.push(...result.createdSplitFiles);
              totalSplitFilesGenerated = result.totalSplitFilesGenerated;
              splitErrors = result.splitErrors;
            }
          }

          // Recurse deeper
          await scanAndProcessDirectory(inputPath, outputPath);
        }
      }
    };

    await scanAndProcessDirectory(baseFolder, splitFolder);

    // 4. Final Completion Broadcast (Forces UI to 100%)
    const completionUpdate: SplitProgressComplete = {
      type: "splitProgressComplete",
      taskKey: "splitFiles",
      totalSplitFilesGenerated,
      splitErrors,
      totalExpectedPagesFromCsv:
        totalExpectedPagesFromCsv || totalSplitFilesGenerated,
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
