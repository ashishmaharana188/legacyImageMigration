// pdfProcessing.ts
import ExcelJS from "exceljs";
import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import winston from "winston";
import { uploadDirectoryRecursive } from "./s3Uploader";
import { S3_BUCKET_NAME, getS3Prefix } from "../utils/s3Config";
/*import { exec } from "child_process";
import { promisify } from "util";*/

interface ProcessingResult {
  outputFileName: string;
  summary: {
    totalRows: number;
    successfulRows: number;
    errors: number;
    notFound: number;
  };
  files: {
    row: number;
    sourcePath: string;
    destinationPath: string;
    pageCount: number;
  }[];
}

export class PdfProcessing {
  private readonly trxnMap: Record<string, string> = {
    NEW: "IC",
    NCT: "NCT",
    RED: "RED",
    FUL: "RED",
    IPO: "IOBI",
    SIN: "IOBIS",
    SWOP: "SWP",
    SWOF: "SWP",
  };

  private readonly baseFolder = path.join(__dirname, "../../output");
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

  private async buildDestinationFilePath(
    trxn: string,
    fund: string,
    ihNo: string,
    fileExt: string,
    rowNumber: number
  ): Promise<string> {
    if (!fund || !ihNo || /[<>:"|?*]/.test(fund) || /[<>:"|?*]/.test(ihNo)) {
      throw new Error(`Invalid fund (${fund}) or ihNo (${ihNo}) for file path`);
    }
    const clientPath =
      trxn === "DD"
        ? path.join(this.baseFolder, trxn, `CLIENT_CODE_${fund}`)
        : path.join(this.baseFolder, `CLIENT_CODE_${fund}`);
    this.logger.info(`Row ${rowNumber}: Creating clientPath: ${clientPath}`);
    await fs.mkdir(clientPath, { recursive: true });

    const fileFolderPath =
      trxn === "DD"
        ? path.join(clientPath, `CLIENT_CODE_${fund}_BATCH_NUMBER_${ihNo}`)
        : path.join(
            clientPath,
            `CLIENT_CODE_${fund}_TRANSACTION_NUMBER_${ihNo}`
          );
    this.logger.info(
      `Row ${rowNumber}: Creating fileFolderPath: ${fileFolderPath}`
    );
    await fs.mkdir(fileFolderPath, { recursive: true });

    return path.join(
      fileFolderPath,
      `CLIENT_CODE_${fund}_${
        trxn === "DD" ? "BATCH" : "TRANSACTION"
      }_NUMBER_${ihNo}${fileExt}`
    );
  }

  async processExcelFile(inputFilePath: string): Promise<ProcessingResult> {
    const workbook = new ExcelJS.Workbook();
    this.logger.info("Reading Excel file:", { inputFilePath });
    await workbook.xlsx.readFile(inputFilePath);

    if (workbook.worksheets.length === 0) {
      throw new Error("No worksheets found in Excel file");
    }
    if (workbook.worksheets.length > 1) {
      throw new Error(
        "Excel file contains multiple worksheets; only one is allowed"
      );
    }

    const worksheet = workbook.worksheets[0];
    this.logger.info("Worksheet loaded:", { name: worksheet.name });

    const headerRow = worksheet.getRow(1);
    const requiredHeaders = [
      "id_fund",
      "id_trtype",
      "id_ihno",
      "id_path",
      "id_acno",
      "id_serverip",
      "id_drivepath",
    ];
    const headerIndices: { [key: string]: number } = {};
    headerRow.eachCell((cell, colNumber) => {
      const header = cell.text?.trim().toLowerCase();
      if (header && requiredHeaders.includes(header)) {
        headerIndices[header] = colNumber;
      }
    });

    const missingHeaders = requiredHeaders.filter((h) => !(h in headerIndices));
    if (missingHeaders.length > 0) {
      throw new Error(`Missing required headers: ${missingHeaders.join(", ")}`);
    }

    let totalRows = 0;
    let successfulRows = 0;
    let errors = 0;
    let notFound = 0;
    const files: {
      row: number;
      sourcePath: string;
      destinationPath: string;
      pageCount: number;
    }[] = [];
    const processedRows: {
      id_fund: string;
      id_trtype: string;
      id_ihno: string;
      id_path: string;
      id_acno: string;
      page_count: string | number;
    }[] = [];

    const lastRow = worksheet.rowCount;
    this.logger.info("Total rows to process:", { lastRow });

    for (let rowNumber = 2; rowNumber <= lastRow; rowNumber++) {
      const row = worksheet.getRow(rowNumber);
      if (!row.hasValues || !row.getCell(headerIndices["id_fund"]).value) {
        this.logger.info(`Row ${rowNumber}: Empty or invalid row, skipping`);
        continue;
      }

      totalRows++;
      this.logger.info(`Processing row ${rowNumber}`);

      try {
        const serverId =
          row.getCell(headerIndices["id_serverip"]).text?.trim() || "";
        const drivePath =
          row.getCell(headerIndices["id_drivepath"]).text?.trim() || "";
        const pathVal =
          row.getCell(headerIndices["id_path"]).text?.trim() || "";
        const folder =
          row.getCell(headerIndices["id_drivepath"]).text?.trim() || "";
        const fund = row.getCell(headerIndices["id_fund"]).text?.trim() || "";
        const ihNo = row.getCell(headerIndices["id_ihno"]).text?.trim() || "";
        const trxnType =
          row.getCell(headerIndices["id_trtype"]).text?.trim() || "";

        this.logger.info(`Row ${rowNumber} data`, {
          serverId,
          drivePath,
          pathVal,
          folder,
          fund,
          ihNo,
          trxnType,
        });

        if (!serverId) {
          processedRows.push({
            id_fund: fund,
            id_trtype: trxnType,
            id_ihno: ihNo,
            id_path: pathVal,
            id_acno: row.getCell(headerIndices["id_acno"]).text?.trim() || "",
            page_count: "Missing serverId",
          });
          errors++;
          this.logger.info(`Row ${rowNumber}: Missing serverId`);
          continue;
        }
        if (!drivePath) {
          processedRows.push({
            id_fund: fund,
            id_trtype: trxnType,
            id_ihno: ihNo,
            id_path: pathVal,
            id_acno: row.getCell(headerIndices["id_acno"]).text?.trim() || "",
            page_count: "Missing drivePath",
          });
          errors++;
          this.logger.info(`Row ${rowNumber}: Missing drivePath`);
          continue;
        }
        if (!pathVal) {
          processedRows.push({
            id_fund: fund,
            id_trtype: trxnType,
            id_ihno: ihNo,
            id_path: pathVal,
            id_acno: row.getCell(headerIndices["id_acno"]).text?.trim() || "",
            page_count: "Missing pathVal",
          });
          errors++;
          this.logger.info(`Row ${rowNumber}: Missing pathVal`);
          continue;
        }

        let sourceFilePath = path
          .normalize(`${serverId}\\${pathVal}`.replace(/\//g, "\\"))
          .replace(/^(\.\.[\/\\])+/, "");
        if (sourceFilePath.includes("image")) {
          sourceFilePath = sourceFilePath.replace(/image/g, folder);
        } else if (sourceFilePath.includes("common")) {
          sourceFilePath = sourceFilePath.replace(/common/g, folder);
        }
        this.logger.info(
          `Row ${rowNumber}: Source file path: ${sourceFilePath}`
        );

        const fileExt = this.getFileExtension(pathVal);
        this.logger.info(`Row ${rowNumber}: File extension: ${fileExt}`);
        const trxn = this.trxnMap[trxnType] || "Unknown";

        if (
          await fs
            .access(sourceFilePath)
            .then(() => true)
            .catch(() => false)
        ) {
          this.logger.info(`Row ${rowNumber}: Reading file: ${sourceFilePath}`);
          const sourceData = await fs.readFile(sourceFilePath);

          let destinationFilePath: string;
          try {
            destinationFilePath = await this.buildDestinationFilePath(
              trxn,
              fund,
              ihNo,
              fileExt,
              rowNumber
            );
          } catch (err) {
            this.logger.error(`Row ${rowNumber}: Path error`, { error: err });
            processedRows.push({
              id_fund: fund,
              id_trtype: trxn,
              id_ihno: ihNo,
              id_path: pathVal,
              id_acno: row.getCell(headerIndices["id_acno"]).text?.trim() || "",
              page_count: "Path Error",
            });
            errors++;
            continue;
          }
          this.logger.info(
            `Row ${rowNumber}: Copying to: ${destinationFilePath}`
          );
          await fs.writeFile(destinationFilePath, sourceData);
          this.logger.info(
            `Row ${rowNumber}: Copied to: ${destinationFilePath}`
          );

          let pageCount: number | string = 0;
          try {
            if (fileExt === ".tif" || fileExt === ".tiff") {
              this.logger.info(`Row ${rowNumber}: Processing TIFF`);
              const metadata = await sharp(sourceData).metadata();
              pageCount = metadata.pages || 1;
            } else if (fileExt === ".pdf") {
              this.logger.info(`Row ${rowNumber}: Processing PDF`);
              const pdfDoc = await PDFDocument.load(sourceData);
              pageCount = pdfDoc.getPageCount();
            } else {
              pageCount = "Unsupported";
            }
            processedRows.push({
              id_fund: fund,
              id_trtype: trxn,
              id_ihno: ihNo,

              id_path: pathVal,
              id_acno: row.getCell(headerIndices["id_acno"]).text?.trim() || "",
              page_count: pageCount,
            });
            if (typeof pageCount === "number") {
              successfulRows++;
              this.logger.info(`Row ${rowNumber}: ${pageCount} pages`);
              files.push({
                row: rowNumber,
                sourcePath: sourceFilePath,
                destinationPath: destinationFilePath,
                pageCount,
              });
            } else {
              errors++;
              this.logger.info(`Row ${rowNumber}: Unsupported file type`);
            }
          } catch (err) {
            this.logger.error(`Row ${rowNumber}: Page count error`, {
              error: err,
            });
            processedRows.push({
              id_fund: fund,
              id_trtype: trxn,
              id_ihno: ihNo,
              id_path: pathVal,
              id_acno: row.getCell(headerIndices["id_acno"]).text?.trim() || "",
              page_count: fileExt === ".pdf" ? "PDF Error" : "Unsupported",
            });
            errors++;
            continue;
          }
        } else {
          this.logger.info(`File not found: ${sourceFilePath}`);
          processedRows.push({
            id_fund: fund,
            id_trtype: trxn,
            id_ihno: ihNo,
            id_path: pathVal,
            id_acno: row.getCell(headerIndices["id_acno"]).text?.trim() || "",
            page_count: "Not Found",
          });
          notFound++;
        }
      } catch (err) {
        this.logger.error(`Error processing row ${rowNumber}`, { error: err });
        processedRows.push({
          id_fund: row.getCell(headerIndices["id_fund"]).text?.trim() || "",
          id_trtype: row.getCell(headerIndices["id_trtype"]).text?.trim() || "",
          id_ihno: row.getCell(headerIndices["id_ihno"]).text?.trim() || "",
          id_path: row.getCell(headerIndices["id_path"]).text?.trim() || "",
          id_acno: row.getCell(headerIndices["id_acno"]).text?.trim() || "",
          page_count: "Error",
        });
        errors++;
      }
    }

    const csvWorkbook = new ExcelJS.Workbook();
    const csvWorksheet = csvWorkbook.addWorksheet("Processed");
    csvWorksheet.columns = [
      { header: "id_fund", key: "id_fund" },
      { header: "id_trtype", key: "id_trtype" },
      { header: "id_ihno", key: "id_ihno" },
      { header: "id_path", key: "id_path" },
      { header: "id_acno", key: "id_acno" },
      { header: "page_count", key: "page_count" },
    ];

    processedRows.forEach((row) => {
      csvWorksheet.addRow(row);
    });

    this.logger.info("Finished processing rows");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const outputFileName = `processed_${timestamp}.csv`;
    const outputPath = path.join("processed", outputFileName);
    this.logger.info(`Saving processed file to: ${outputPath}`);
    await csvWorkbook.csv.writeFile(outputPath);
    this.logger.info("Processed file saved");

    // Trigger upload script

    // Path to the batch file
    /*    const batPath = path.resolve(
      __dirname,
      "..",
      "..",
      "..",
      "backend",
      "upload-s3.bat"
    );

    this.logger.info(`Triggering upload script...`);

    exec(
      `"${batPath}"`,
      {
        shell: "cmd.exe",
        env: {
          ...process.env, // keep all existing env vars
          AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
          AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
          AWS_SESSION_TOKEN: process.env.AWS_SESSION_TOKEN,
          AWS_DEFAULT_REGION: process.env.AWS_DEFAULT_REGION,
        },
      },
      (error, stdout, stderr) => {
        if (error) {
          this.logger.error(`Upload error: ${error.message}`);
          return;
        }
        if (stderr) {
          this.logger.error(`Upload stderr: ${stderr}`);
        }
        this.logger.info(`Upload stdout: ${stdout}`);
      }
    );*/

    this.logger.info("Deleting input file:", { inputFilePath });
    await fs.unlink(inputFilePath);
    this.logger.info("Input file deleted");

    return {
      outputFileName,
      summary: { totalRows, successfulRows, errors, notFound },
      files,
    };
  }
}

