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

  private async countPdfFiles(dir: string): Promise<number> {
    let count = 0;
    try {
      const items = await fs.readdir(dir);
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stats = await fs.stat(fullPath);
        if (stats.isDirectory()) {
          count += await this.countPdfFiles(fullPath);
        } else if (stats.isFile() && item.toLowerCase().endsWith(".pdf")) {
          count++;
        }
      }
    } catch (error) {
      logger.warn(`Failed to count files in ${dir}`, { error });
    }
    return count;
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

    let totalExpectedPagesFromCsv = 0;
    try {
      totalExpectedPagesFromCsv =
        await this.splitProcessorUtil.getTotalExpectedPagesFromCsv();
    } catch (e) {
      logger.warn("Could not fetch total expected pages from CSV.");
    }

    if (!totalExpectedPagesFromCsv || totalExpectedPagesFromCsv === 0) {
      logger.info("CSV Total missing. Counting actual files...", {
        console: true,
      });
      totalExpectedPagesFromCsv = await this.countPdfFiles(baseFolder);
    }

    if (totalExpectedPagesFromCsv === 0) totalExpectedPagesFromCsv = 1;

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

    const handleWorkerProgress = (update: SplitProgressUpdate) => {
      const now = Date.now();
      if (now - lastBroadcastTime > 2000 || update.status === "Error") {
        const enrichedUpdate = {
          ...update,
          totalExpectedPagesFromCsv,
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
          // Recursive step: Create the mirror folder and dive in
          await fs.mkdir(nextOutputDir, { recursive: true });
          await scanAndProcessDirectory(inputPath, nextOutputDir);
        } else if (stats.isFile() && item.toLowerCase().endsWith(".pdf")) {
          // --- [SMART FIX START] ---
          const fileNameNoExt = path.parse(item).name; // "FileA" from "FileA.pdf"
          const parentFolderName = path.basename(outputDir); // "FileA" from ".../split_output/FileA"

          let targetSplitFolder: string;

          // Check: Is the file ALREADY inside a folder with the same name?
          if (parentFolderName === fileNameNoExt) {
            // YES: Do not create another subfolder. Dump files here.
            // Result: .../FileA/FileA_1.pdf
            targetSplitFolder = outputDir;
          } else {
            // NO: Create a new folder for this file (Cleaner than dumping in root)
            // Result: .../SomeFolder/FileA/FileA_1.pdf
            targetSplitFolder = path.join(outputDir, fileNameNoExt);
          }
          // --- [SMART FIX END] ---

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
