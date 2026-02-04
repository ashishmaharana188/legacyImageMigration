// splitting.ts
import fs from "fs/promises";
import path from "path";
import winston from "winston";
import { parse } from "csv-parse/sync"; // Import csv-parse


export class SplitProcessorUtil { // Renamed class
  private readonly baseFolder = path.join(process.cwd(), "output");
  private readonly splitFolder = path.join(process.cwd(), "split_output");
  private readonly processedFolder = path.join(process.cwd(), "processed");
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

  constructor() {
    // Ensure directories exist on instantiation
    fs.mkdir(this.processedFolder, { recursive: true }).catch((err) => {
      this.logger.error(`Failed to create processed directory: ${this.processedFolder}`, { error: err });
    });
    // Note: baseFolder and splitFolder are handled in SplitProcessorWrapper
  }

  private getFileExtension(filePath: string): string {
    return filePath ? path.extname(filePath).toLowerCase() : "";
  }

  public async getLatestProcessedCsvPath(): Promise<string | null> {
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

  public async getTotalExpectedPagesFromCsv(): Promise<number> {
    const latestCsvPath = await this.getLatestProcessedCsvPath();
    if (!latestCsvPath) {
      this.logger.warn(
        "No processed CSV file found to calculate total expected pages."
      );
      return 0;
    }

    try {
      const csvContent = await fs.readFile(latestCsvPath, { encoding: "utf8" });
      const records: { page_count: string }[] = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
      });

      let totalExpectedPages = 0;
      records.forEach((record) => {
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
}
