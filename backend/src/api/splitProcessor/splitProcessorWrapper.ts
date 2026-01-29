import fs from "fs/promises";
import path from "path";
import winston from "winston";
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
    // Get total from your existing util
    const totalExpectedPagesFromCsv =
      await this.splitProcessorUtil.getTotalExpectedPagesFromCsv();

    let totalSplitFilesGenerated = 0;
    let splitErrors = 0;

    logger.info(`Starting file splitting ${useMuPDF ? "(MuPDF)" : ""}`);
    await fs.mkdir(splitFolder, { recursive: true });
    await fs.mkdir(baseFolder, { recursive: true });

    // Initial Broadcast
    this.sendProgress(0, 0, totalExpectedPagesFromCsv, "Starting...");

    const scanAndProcessDirectory = async (
      inputDir: string,
      outputDir: string
    ) => {
      let folders: string[];
      try {
        folders = await fs.readdir(inputDir);
      } catch (err) {
        logger.error(`Failed to read directory ${inputDir}`, { error: err });
        return;
      }

      for (const folder of folders) {
        const inputFolderPath = path.join(inputDir, folder);
        const outputFolderPath = path.join(outputDir, folder);
        const stats = await fs.stat(inputFolderPath);

        if (stats.isDirectory()) {
          await fs.mkdir(outputFolderPath, { recursive: true });
          const files = await fs.readdir(inputFolderPath);

          const fileTasks = files.map((file) =>
            (async () => {
              const filePath = path.join(inputFolderPath, file);
              const fileStats = await fs.stat(filePath);

              if (fileStats.isFile()) {
                const result = await performSplit(
                  filePath,
                  outputFolderPath,
                  logger,
                  () => {}, // No-op: we broadcast below
                  totalSplitFilesGenerated,
                  splitErrors,
                  useMuPDF
                );

                createdSplitFiles.push(...result.createdSplitFiles);

                const newFilesCount = result.createdSplitFiles.length;
                totalSplitFilesGenerated += newFilesCount;
                if (result.createdSplitFiles.length === 0)
                  splitErrors += result.splitErrors;

                // LIVE BROADCAST: This runs every time a file finishes
                this.sendProgress(
                  totalSplitFilesGenerated,
                  splitErrors,
                  totalExpectedPagesFromCsv,
                  `Processed ${file}`
                );
              }
            })()
          );

          await Promise.all(fileTasks);
          await scanAndProcessDirectory(inputFolderPath, outputFolderPath);
        }
      }
    };

    await scanAndProcessDirectory(baseFolder, splitFolder);

    const completionUpdate: SplitProgressComplete = {
      type: "splitProgressComplete",
      taskKey: "splitFiles",
      totalSplitFilesGenerated,
      splitErrors,
      totalExpectedPagesFromCsv,
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
