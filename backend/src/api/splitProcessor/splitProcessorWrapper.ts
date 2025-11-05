import fs from "fs/promises";
import path from "path";
import winston from "winston";
import { broadcast } from "../../../services/webSocketService";
import { SplitResult, SplitFileDetail, SplitProgressComplete } from "./splitProcessorTypes";
import { performSplit } from "./splitProcessor";
import { SplitProcessorUtil } from "./splitProcessorUtil"; // Import SplitProcessorUtil for its helper methods

const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  transports: [
    new winston.transports.File({
      filename: "logs/error.log",
      level: "error",
    }),
    new winston.transports.File({ filename: "logs/combined.log" }),
  ],
});

const baseFolder = path.join(__dirname, "../../output");
const splitFolder = path.join(__dirname, "../../split_output");

export class SplitProcessorWrapper {
  private splitProcessorUtil: SplitProcessorUtil;

  constructor() {
    this.splitProcessorUtil = new SplitProcessorUtil();
  }

  async splitFiles(): Promise<SplitResult> {
    const createdSplitFiles: SplitFileDetail[] = [];
    let totalSplitFilesGenerated = 0;
    let splitErrors = 0;

    logger.info("Starting file splitting");

    await fs.mkdir(splitFolder, { recursive: true });

    const scanAndProcessDirectory = async (
      inputDir: string,
      outputDir: string
    ) => {
      let folders: string[];
      try {
        folders = await fs.readdir(inputDir);
      } catch (err) {
        logger.error(`Failed to read directory ${inputDir}`, {
          error: err,
        });
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
                const {
                  createdSplitFiles: newSplitFiles,
                  totalSplitFilesGenerated: updatedSplitFilesGenerated,
                  splitErrors: updatedSplitErrors,
                } = await performSplit(
                  filePath,
                  outputFolderPath,
                  logger,
                  (update) => broadcast(JSON.stringify(update)),
                  totalSplitFilesGenerated,
                  splitErrors,
                  false
                );

                createdSplitFiles.push(...newSplitFiles);
                totalSplitFilesGenerated = updatedSplitFilesGenerated;
                splitErrors = updatedSplitErrors;
              }
            })()
          );
          await Promise.all(fileTasks);
          await scanAndProcessDirectory(inputFolderPath, outputFolderPath);
        }
      }
    };

    await scanAndProcessDirectory(baseFolder, splitFolder);
    logger.info("File splitting complete");

    const totalExpectedPagesFromCsv = await this.splitProcessorUtil.getTotalExpectedPagesFromCsv();

    const completionUpdate: SplitProgressComplete = {
      type: "splitProgressComplete",
      totalSplitFilesGenerated,
      splitErrors,
      totalExpectedPagesFromCsv,
      status: "File splitting complete",
    };
    broadcast(JSON.stringify(completionUpdate));

    return {
      splitFiles: createdSplitFiles,
      summary: {
        totalSplitFilesGenerated,
        splitErrors,
        totalExpectedPagesFromCsv,
      },
    };
  }

  async splitFilesWithMuPDF(): Promise<SplitResult> {
    const createdSplitFiles: SplitFileDetail[] = [];
    let totalSplitFilesGenerated = 0;
    let splitErrors = 0;

    logger.info("Starting file splitting with MuPDF");

    await fs.mkdir(splitFolder, { recursive: true });

    const scanAndProcessDirectory = async (
      inputDir: string,
      outputDir: string
    ) => {
      let folders: string[];
      try {
        folders = await fs.readdir(inputDir);
      } catch (err) {
        logger.error(`Failed to read directory ${inputDir}`, {
          error: err,
        });
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
                const {
                  createdSplitFiles: newSplitFiles,
                  totalSplitFilesGenerated: updatedSplitFilesGenerated,
                  splitErrors: updatedSplitErrors,
                } = await performSplit(
                  filePath,
                  outputFolderPath,
                  logger,
                  (update) => broadcast(JSON.stringify(update)),
                  totalSplitFilesGenerated,
                  splitErrors,
                  true
                );

                createdSplitFiles.push(...newSplitFiles);
                totalSplitFilesGenerated = updatedSplitFilesGenerated;
                splitErrors = updatedSplitErrors;
              }
            })()
          );
          await Promise.all(fileTasks);
          await scanAndProcessDirectory(inputFolderPath, outputFolderPath);
        }
      }
    };

    await scanAndProcessDirectory(baseFolder, splitFolder);
    logger.info("File splitting with MuPDF complete");

    const totalExpectedPagesFromCsv = await this.splitProcessorUtil.getTotalExpectedPagesFromCsv();

    const completionUpdate: SplitProgressComplete = {
      type: "splitProgressComplete",
      totalSplitFilesGenerated,
      splitErrors,
      totalExpectedPagesFromCsv,
      status: "File splitting with MuPDF complete",
    };
    broadcast(JSON.stringify(completionUpdate));

    return {
      splitFiles: createdSplitFiles,
      summary: {
        totalSplitFilesGenerated,
        splitErrors,
        totalExpectedPagesFromCsv,
      },
    };
  }
}
