// splitting.ts
import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import pLimit from "p-limit";
import winston from "winston";
import { exec } from "child_process";
import util from "util";
import { S3_BUCKET_NAME } from "../utils/s3Config";
import { parse } from "csv-parse/sync"; // Import csv-parse

interface SplitResult {
  splitFiles: any[];
  summary: {
    totalOriginalFilesProcessed: number;
    totalExpectedSplits: number; // Re-added: Internal count of expected splits
    totalSplitFilesGenerated: number;
    splitErrors: number;
    totalExpectedPagesFromCsv: number; // New field for total expected pages from CSV
  };
}

const execPromise = util.promisify(exec);

async function runPythonFallback(
  filePath: string,
  outputFolderPath: string,
  fileName: string,
  logger: winston.Logger
): Promise<number> {
  // Modified to return a number
  // Construct the path to the Python script relative to the project root
  const projectRoot = path.resolve(__dirname, "../../.."); // Go up from backend/services to project root
  const pythonScript = path.join(
    projectRoot,
    "backend",
    "services",
    "fallBackSplit.py"
  );
  const pythonExecutable = process.env.PYTHON_EXECUTABLE_PATH || "python"; // Configurable Python path
  try {
    logger.info(
      `Attempting Python fallback for ${fileName} using script: ${pythonScript} and executable: ${pythonExecutable}`
    );
    const { stdout, stderr } = await execPromise(
      `${pythonExecutable} "${pythonScript}" "${filePath}" "${outputFolderPath}"`
    );
    logger.info(`Python fallback succeeded for ${fileName}`, { stdout });
    if (stderr)
      logger.warn(`Python fallback stderr for ${fileName}`, { stderr });

    // Extract split count from stdout
    const match = stdout.match(/Split (\d+) pages successfully/);
    if (match && match[1]) {
      const splitCount = parseInt(match[1], 10);
      logger.info(`Extracted split count from Python fallback: ${splitCount}`);
      return splitCount;
    } else {
      logger.warn(
        "Could not extract split count from Python fallback stdout.",
        { stdout }
      );
      return 1;
    }
  } catch (error) {
    logger.error(`Python fallback failed for ${fileName}`, {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

export class Splitting {
  private readonly baseFolder = path.join(__dirname, "../../output");
  private readonly splitFolder = path.join(__dirname, "../../split_output");
  private readonly processedFolder = path.join(__dirname, "../../processed");
  private readonly limit = pLimit(100);
  private readonly logger = winston.createLogger({
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

  private getFileExtension(filePath: string): string {
    return filePath ? path.extname(filePath).toLowerCase() : "";
  }

  private async getLatestProcessedCsvPath(): Promise<string | null> {
    try {
      const files = await fs.readdir(this.processedFolder);
      const csvFiles = files.filter(
        (file) => file.startsWith("processed_") && file.endsWith(".csv")
      );

      if (csvFiles.length === 0) {
        return null;
      }

      // Sort files by modification time (newest first)
      const sortedFiles = await Promise.all(
        csvFiles.map(async (file) => {
          const filePath = path.join(this.processedFolder, file);
          const stats = await fs.stat(filePath);
          return { filePath, mtime: stats.mtime.getTime() };
        })
      );

      sortedFiles.sort((a, b) => b.mtime - a.mtime);
      return sortedFiles[0].filePath;
    } catch (error) {
      this.logger.error("Error getting latest processed CSV path", { error });
      return null;
    }
  }

  private async getTotalExpectedPagesFromCsv(): Promise<number> {
    const latestCsvPath = await this.getLatestProcessedCsvPath();
    if (!latestCsvPath) {
      this.logger.warn(
        "No processed CSV file found to calculate total expected pages."
      );
      return 0;
    }

    try {
      const csvContent = await fs.readFile(latestCsvPath, { encoding: "utf8" });
      const records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
      });

      let totalExpectedPages = 0;
      records.forEach((record: any) => {
        const pageCount = Number(record.page_count);
        if (!isNaN(pageCount)) {
          totalExpectedPages += pageCount;
        } else {
          this.logger.warn(
            `Non-numeric page_count found in CSV: ${record.page_count} for record:`,
            record
          );
        }
      });
      return totalExpectedPages;
    } catch (error) {
      this.logger.error(`Error reading or parsing CSV file: ${latestCsvPath}`, {
        error,
      });
      return 0;
    }
  }

  async splitFiles(): Promise<SplitResult> {
    const createdSplitFiles: { originalPath: string; splitPath: string; page: number }[] = [];
    let totalOriginalFilesProcessed = 0;
    let totalExpectedSplits = 0;
    let totalSplitFilesGenerated = 0;
    let splitErrors = 0;

    this.logger.info("Starting file splitting");

    const scanAndProcessDirectory = async (
      inputDir: string,
      outputDir: string
    ) => {
      let folders: string[];
      try {
        folders = await fs.readdir(inputDir);
      } catch (err) {
        this.logger.error(`Failed to read directory ${inputDir}`, {
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
            this.limit(async () => {
              const filePath = path.join(inputFolderPath, file);
              const fileStats = await fs.stat(filePath);
              if (fileStats.isFile()) {
                totalOriginalFilesProcessed++;
                const fileName = path.basename(filePath);
                const fileExt = this.getFileExtension(fileName);
                let fileBuffer: Buffer;
                try {
                  fileBuffer = await fs.readFile(filePath);
                } catch (err) {
                  this.logger.error(`Failed to read file ${filePath}`, { error: err });
                  splitErrors++;
                  return;
                }

                try {
                  if (fileExt === ".pdf") {
                    const pdfDoc = await PDFDocument.load(fileBuffer);
                    const numPages = pdfDoc.getPages().length;
                    totalExpectedSplits += numPages;
                    for (let i = 0; i < numPages; i++) {
                      const subDoc = await PDFDocument.create();
                      const [copiedPage] = await subDoc.copyPages(pdfDoc, [i]);
                      subDoc.addPage(copiedPage);
                      const pdfBytes = await subDoc.save();
                      const splitFileName = `${path.basename(fileName, fileExt)}_${i + 1}${fileExt}`;
                      const outputFilePath = path.join(outputFolderPath, splitFileName);
                      await fs.writeFile(outputFilePath, pdfBytes);
                      createdSplitFiles.push({ originalPath: filePath, splitPath: outputFilePath, page: i + 1 });
                      totalSplitFilesGenerated++;
                    }
                  } else if (fileExt === ".tif" || fileExt === ".tiff") {
                    const metadata = await sharp(fileBuffer).metadata();
                    const totalPages = metadata.pages || 1;
                    totalExpectedSplits += totalPages;
                    for (let i = 0; i < totalPages; i++) {
                      const splitImage = await sharp(fileBuffer, { page: i }).toBuffer();
                      const splitFileName = `${path.basename(fileName, fileExt)}_${i + 1}${fileExt}`;
                      const outputFilePath = path.join(outputFolderPath, splitFileName);
                      await fs.writeFile(outputFilePath, splitImage);
                      createdSplitFiles.push({ originalPath: filePath, splitPath: outputFilePath, page: i + 1 });
                      totalSplitFilesGenerated++;
                    }
                  } else {
                    this.logger.warn(`Skipping unsupported file format: ${fileName}`);
                    splitErrors++;
                  }
                } catch (err) {
                  this.logger.error(`Error processing ${fileName}`, { error: err });
                  splitErrors++;
                  try {
                    const fallbackSplitCount = await runPythonFallback(filePath, outputFolderPath, fileName, this.logger);
                    totalSplitFilesGenerated += fallbackSplitCount;
                  } catch (fallbackErr) {
                    this.logger.error(`Fallback also failed for ${fileName}`, { error: fallbackErr });
                    splitErrors++;
                  }
                }
              }
            })
          );
          await Promise.all(fileTasks);
        }
      }
    };

    await fs.mkdir(this.splitFolder, { recursive: true });
    await scanAndProcessDirectory(this.baseFolder, this.splitFolder);
    this.logger.info("File splitting complete");

    const latestCsvPath = await this.getLatestProcessedCsvPath();
    let csvRecords: any[] = [];
    if (latestCsvPath) {
      try {
        const csvContent = await fs.readFile(latestCsvPath, { encoding: "utf8" });
        csvRecords = parse(csvContent, {
          columns: true,
          skip_empty_lines: true,
        });
      } catch (error) {
        this.logger.error(`Error reading or parsing CSV file: ${latestCsvPath}`, { error });
      }
    }

    const verificationLog: any[] = [];
    for (const record of csvRecords) {
      const fund = record.id_fund;
      const ihNo = record.id_ihno;

      const matchingSplits = createdSplitFiles.filter(f => {
          const match = f.originalPath.match(/CLIENT_CODE_(\d+)[\\\/]CLIENT_CODE_\1_TRANSACTION_NUMBER_(\d+)/);
          return match && match[1] === fund && match[2] === ihNo;
      });

      if (matchingSplits.length > 0) {
        verificationLog.push({
            id_ihno: ihNo,
            id_acno: record.id_acno,
            id_fund: fund,
            status: `Split into ${matchingSplits.length} pages`,
            page_count: record.page_count,
        });
      } else {
        verificationLog.push({
            id_ihno: ihNo,
            id_acno: record.id_acno,
            id_fund: fund,
            status: 'Not split',
            page_count: null,
        });
      }
    }

    const totalExpectedPagesFromCsv = await this.getTotalExpectedPagesFromCsv();

    return {
      splitFiles: verificationLog,
      summary: {
        totalOriginalFilesProcessed,
        totalExpectedSplits,
        totalSplitFilesGenerated,
        splitErrors,
        totalExpectedPagesFromCsv,
      },
    };
  }
}