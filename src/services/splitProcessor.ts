// splitting.ts
import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import pLimit from "p-limit";
import winston from "winston";

interface SplitResult {
  splitFiles: { originalPath: string; splitPath: string; page: number }[];
}

export class Splitting {
  private readonly baseFolder = path.join(__dirname, "../../output");
  private readonly splitFolder = path.join(__dirname, "../../split_output");
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

  async splitFiles(): Promise<SplitResult> {
    const splitFiles: {
      originalPath: string;
      splitPath: string;
      page: number;
    }[] = [];
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
                const fileName = path.basename(filePath);
                const fileExt = this.getFileExtension(fileName);
                let fileBuffer: Buffer;
                try {
                  fileBuffer = await fs.readFile(filePath);
                } catch (err) {
                  this.logger.error(`Failed to read file ${filePath}`, {
                    error: err,
                  });
                  return;
                }

                try {
                  if (fileExt === ".pdf") {
                    const pdfDoc = await PDFDocument.load(fileBuffer);
                    for (let i = 0; i < pdfDoc.getPages().length; i++) {
                      const subDoc = await PDFDocument.create();
                      const [copiedPage] = await subDoc.copyPages(pdfDoc, [i]);
                      subDoc.addPage(copiedPage);
                      const pdfBytes = await subDoc.save();
                      const splitFileName = `${path.basename(
                        fileName,
                        ".pdf"
                      )}_${i + 1}.pdf`;
                      const outputFilePath = path.join(
                        outputFolderPath,
                        splitFileName
                      );
                      await fs.writeFile(outputFilePath, pdfBytes);
                      this.logger.info(`Saved: ${outputFilePath}`);
                      splitFiles.push({
                        originalPath: filePath,
                        splitPath: outputFilePath,
                        page: i + 1,
                      });
                    }
                  } else if (fileExt === ".tif" || fileExt === ".tiff") {
                    const metadata = await sharp(fileBuffer).metadata();
                    this.logger.info(`Splitting TIFF ${fileName}`, {
                      metadata,
                    });
                    const totalPages = metadata.pages || 1;
                    for (let i = 0; i < totalPages; i++) {
                      const splitImage = await sharp(fileBuffer, {
                        page: i,
                      }).toBuffer();
                      const splitFileName = `${path.basename(
                        fileName,
                        `.${fileExt}`
                      )}_${i + 1}.${fileExt}`;
                      const outputFilePath = path.join(
                        outputFolderPath,
                        splitFileName
                      );
                      await fs.writeFile(outputFilePath, splitImage);
                      this.logger.info(`Saved: ${outputFilePath}`);
                      splitFiles.push({
                        originalPath: filePath,
                        splitPath: outputFilePath,
                        page: i + 1,
                      });
                    }
                  } else {
                    this.logger.warn(
                      `Skipping unsupported file format: ${fileName}`
                    );
                  }
                } catch (err) {
                  this.logger.error(`Error processing ${fileName}`, {
                    error: err,
                  });
                }
              }
            })
          );
          await Promise.all(fileTasks);
          await scanAndProcessDirectory(inputFolderPath, outputFolderPath);
        }
      }
    };

    await fs.mkdir(this.splitFolder, { recursive: true });
    await scanAndProcessDirectory(this.baseFolder, this.splitFolder);
    this.logger.info("File splitting complete");
    return { splitFiles };
  }
}
