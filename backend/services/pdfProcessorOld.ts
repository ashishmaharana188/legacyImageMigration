import ExcelJS from "exceljs";
import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import pLimit from "p-limit";
import { Pool, PoolClient } from "pg";
import winston from "winston";

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

interface SplitResult {
  splitFiles: { originalPath: string; splitPath: string; page: number }[];
}

interface SqlLog {
  row: number;
  status: "success" | "error" | "executed" | "updated";
  message: string;
  sql?: string;
}

export class PdfProcessor {
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
  private readonly splitFolder = path.join(__dirname, "../../split_output");
  private readonly limit = pLimit(100);
  private readonly pool = new Pool({
    user: process.env.DB_USER || "postgres",
    host: process.env.DB_HOST || "localhost",
    database: process.env.DB_NAME || "investor",
    password: process.env.DB_PASSWORD || "your_password",
    port: parseInt(process.env.DB_PORT || "5432", 10),
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

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
      image: string;
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
        const image = pathVal.includes("image")
          ? "image"
          : pathVal.includes("common")
          ? "common"
          : "";
        this.logger.info(`Row ${rowNumber} data`, {
          serverId,
          drivePath,
          pathVal,
          folder,
          fund,
          ihNo,
          trxnType,
          image,
        });

        if (!serverId) {
          processedRows.push({
            id_fund: fund,
            id_trtype: trxnType,
            id_ihno: ihNo,
            image: image,
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
            image: image,
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
            image: image,
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

        if (
          await fs
            .access(sourceFilePath)
            .then(() => true)
            .catch(() => false)
        ) {
          this.logger.info(`Row ${rowNumber}: Reading file: ${sourceFilePath}`);
          const sourceData = await fs.readFile(sourceFilePath);

          const trxn = this.trxnMap[trxnType] || "Unknown";
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
              id_trtype: trxnType,
              id_ihno: ihNo,
              image: image,
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
              id_trtype: trxnType,
              id_ihno: ihNo,
              image: image,
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
              id_trtype: trxnType,
              id_ihno: ihNo,
              image: image,
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
            id_trtype: trxnType,
            id_ihno: ihNo,
            image: image,
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
          image: "",
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
      { header: "image", key: "image" },
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

    this.logger.info("Deleting input file:", { inputFilePath });
    await fs.unlink(inputFilePath);
    this.logger.info("Input file deleted");

    return {
      outputFileName,
      summary: { totalRows, successfulRows, errors, notFound },
      files,
    };
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

  async generateSql(): Promise<{
    sql: string;
    transactions: {
      id_fund: number;
      id_trtype: string;
      id_ihno: number;
      image: string;
      id_path: string;
      id_acno: string;
      page_count: number | string;
    }[];
    logs: SqlLog[];
  }> {
    const logs: SqlLog[] = [];
    const csvPath = path.join(__dirname, "../../processed");
    const files = await fs.readdir(csvPath);
    const latestCsv = files
      .filter((f) => f.startsWith("processed_") && f.endsWith(".csv"))
      .sort()
      .pop();
    if (!latestCsv) {
      logs.push({
        row: 0,
        status: "error",
        message: "No processed CSV found",
      });
      return { sql: "", transactions: [], logs };
    }

    const csvFullPath = path.join(csvPath, latestCsv);
    const workbook = new ExcelJS.Workbook();
    await workbook.csv.readFile(csvFullPath);
    const worksheet = workbook.worksheets[0];
    const transactions: {
      id_fund: number;
      id_trtype: string;
      id_ihno: number;
      image: string;
      id_path: string;
      id_acno: string;
      page_count: number | string;
    }[] = [];

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      try {
        transactions.push({
          id_fund: parseInt(row.getCell(1).text, 10),
          id_trtype: row.getCell(2).text.trim(),
          id_ihno: parseInt(row.getCell(3).text, 10),
          image: row.getCell(4).text.trim(),
          id_path: row.getCell(5).text.trim(),
          id_acno: row.getCell(6).text.trim(),
          page_count: isNaN(parseInt(row.getCell(7).text, 10))
            ? row.getCell(7).text.trim()
            : parseInt(row.getCell(7).text, 10),
        });
      } catch (err) {
        logs.push({
          row: rowNumber,
          status: "error",
          message: `Failed to parse row: ${
            err instanceof Error ? err.message : "Unknown error"
          }`,
        });
      }
    });

    const trxnNameMap: Record<string, string> = {
      NEW: "New Application Form",
      NCT: "NCT Form",
      RED: "Redemption Form",
      FUL: "Redemption Form",
      IPO: "IPO Form",
      SIN: "SIP Form",
      SWOP: "SWP Form",
      SWOF: "SWP Form",
    };

    const mimeType: Record<string, string> = {
      tif: "image/tiff",
      pdf: "application/pdf",
    };

    const values = transactions
      .map((data, index) => {
        try {
          const path = data.id_path;
          const ext = this.getFileExtension(path);
          if (!ext) throw new Error("Invalid file extension");
          const format = ext.toUpperCase();
          const clientId = String(data.id_fund)
            .split("")
            .map((char) => (/\d/.test(char) ? char.charCodeAt(0) : ""))
            .join("");
          const basePath = `aif-in-a-box-assets-prod: Data/APPLICATION_FORMS/CLIENT_CODE_${data.id_fund}/`;
          const docPath = `${basePath}CLIENT_CODE_${data.id_fund}_TRANSACTION_NUMBER_${data.id_ihno}/CLIENT_CODE_${data.id_fund}_TRANSACTION_NUMBER_${data.id_ihno}.${ext}`;
          const sql = `(
          '${this.trxnMap[data.id_trtype] || "Unknown"}', 'Image Upload', '${
            trxnNameMap[data.id_trtype] || "Unknown"
          }', '${format}', '${docPath}',
          null, '${data.id_ihno}', 'A', '${
            mimeType[ext] || "application/octet-stream"
          }',
          null, '${data.id_ihno}', '${data.id_acno}', null, null,
          null, null, null, null, null,
          null, null, null, null, null,
          false, now(), 'system', now(), 'system',
          ${data.page_count}, ${clientId}
         )`;
          logs.push({
            row: index + 2,
            status: "success",
            message: "SQL generated for row",
            sql,
          });
          return sql;
        } catch (err) {
          logs.push({
            row: index + 2,
            status: "error",
            message: `Failed to generate SQL: ${
              err instanceof Error ? err.message : "Unknown error"
            }`,
          });
          return null;
        }
      })
      .filter((val): val is string => val !== null);

    if (values.length === 0) {
      logs.push({
        row: 0,
        status: "error",
        message: "No valid rows to generate SQL",
      });
      return { sql: "", transactions: [], logs };
    }

    const sql = `INSERT INTO investor.aif_document_details(
      document_process, document_activity, document_type, document_format, document_path,
      folio_id, transaction_reference_id, document_status, mime_type,
      user_attr0, user_attr1, user_attr2, user_attr3, user_attr4,
      user_attr5, user_attr6, user_attr7, user_attr8, user_attr9,
      approval_status, approved_by, approved_on, comments, audit_code,
      del_flag, last_update_tms, last_updated_by, creation_date, created_by,
      page_count, client_id
     ) VALUES ${values.join(", ")};`;

    this.logger.info("Generated multi-row SQL", { sql });
    return { sql, transactions, logs };
  }

  async executeSql(): Promise<{ result: string; logs: SqlLog[] }> {
    const logs: SqlLog[] = [];
    let client: PoolClient | null = null;

    try {
      const { transactions, logs: generateLogs } = await this.generateSql();
      logs.push(...generateLogs);

      if (!transactions.length) {
        logs.push({
          row: 0,
          status: "error",
          message: "No transactions to execute",
        });
        return { result: "failed", logs };
      }

      client = await this.pool.connect();
      this.logger.info("Connected to database");

      await client.query("BEGIN");

      const queryText = `
        INSERT INTO investor.aif_document_details(
          document_process, document_activity, document_type, document_format, document_path,
          folio_id, transaction_reference_id, document_status, mime_type,
          user_attr0, user_attr1, user_attr2, user_attr3, user_attr4,
          user_attr5, user_attr6, user_attr7, user_attr8, user_attr9,
          approval_status, approved_by, approved_on, comments, audit_code,
          del_flag, last_update_tms, last_updated_by, creation_date, created_by,
          page_count, client_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31)
      `;
      for (const [index, data] of transactions.entries()) {
        const ext = this.getFileExtension(data.id_path);
        if (!ext) {
          logs.push({
            row: index + 2,
            status: "error",
            message: "Invalid file extension",
          });
          continue;
        }
        const format = ext.toUpperCase();
        const clientId = String(data.id_fund)
          .split("")
          .map((char) => (/\d/.test(char) ? char.charCodeAt(0) : ""))
          .join("");
        const basePath = `aif-in-a-box-assets-prod: Data/APPLICATION_FORMS/CLIENT_CODE_${data.id_fund}/`;
        const docPath = `${basePath}CLIENT_CODE_${data.id_fund}_TRANSACTION_NUMBER_${data.id_ihno}/CLIENT_CODE_${data.id_fund}_TRANSACTION_NUMBER_${data.id_ihno}.${ext}`;
        const values = [
          this.trxnMap[data.id_trtype] || "Unknown",
          "Image Upload",
          trxnNameMap[data.id_trtype] || "Unknown",
          format,
          docPath,
          null,
          data.id_ihno.toString(),
          "A",
          mimeType[ext] || "application/octet-stream",
          null,
          data.id_ihno.toString(),
          data.id_acno,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          false,
          new Date(),
          "system",
          new Date(),
          "system",
          data.page_count,
          clientId,
        ];
        await client.query(queryText, values);
        logs.push({
          row: index + 2,
          status: "executed",
          message: `Row ${index + 2} inserted successfully`,
        });
      }

      await client.query("COMMIT");
      this.logger.info("SQL executed successfully");
      return { result: "success", logs };
    } catch (err) {
      if (client) {
        await client.query("ROLLBACK");
        this.logger.info("Transaction rolled back");
      }
      logs.push({
        row: 0,
        status: "error",
        message: `SQL execution failed: ${
          err instanceof Error ? err.message : "Unknown error"
        }`,
      });
      return { result: "failed", logs };
    } finally {
      if (client) {
        client.release();
        this.logger.info("Database connection released");
      }
    }
  }

  async updateFolioAndTransaction(): Promise<{
    result: string;
    logs: SqlLog[];
  }> {
    this.logger.info("Starting updateFolioAndTransaction");
    const logs: SqlLog[] = [];
    let client: PoolClient | null = null;
    try {
      client = await this.pool.connect();
      this.logger.info("Connected to database for folio update");
      await client.query("BEGIN");

      // Query 1: Delete from temp_images_1
      const deleteQuery = `
        DELETE FROM public.temp_images_1;
      `;
      await client.query(deleteQuery);
      logs.push({
        row: 0,
        status: "executed",
        message: "Deleted from temp_images_1",
        sql: deleteQuery,
      });
      this.logger.info("Deleted from temp_images_1");

      // Query 2: Insert into temp_images_1
      const insertTempQuery = `
        INSERT INTO public.temp_images_1 (client_code, folio_number, IHNO)
        SELECT client_code, folio_number, IHNO
        FROM (
          SELECT DISTINCT
            cm.client_code,
            fo.folio_number,
            ts.user_attr5 AS ihno
          FROM trxn.aif_transaction_summary ts
          JOIN investor.aif_folio fo ON ts.client_id = fo.client_id AND ts.folio_id = fo.id
          JOIN fund.client_master cm ON cm.id = fo.client_id
          WHERE cm.client_code = $1
            AND ts.created_by = 'aifappendersvc'
            AND (ts.trxn_status != 'R' OR ts.trxn_status IS NULL)
        ) AS cte;
      `;
      const insertResult = await client.query(insertTempQuery, ["150"]);
      logs.push({
        row: 0,
        status: "executed",
        message: `Inserted ${insertResult.rowCount} rows into temp_images_1`,
        sql: insertTempQuery,
      });
      this.logger.info(
        `Inserted ${insertResult.rowCount} rows into temp_images_1`
      );

      // Query 3: Update folio_id using id_acno
      const updateFolioQuery = `
        UPDATE investor.aif_document_details AS d
        SET folio_id = f.id
        FROM investor.aif_folio AS f
        JOIN fund.client_master cm ON f.client_id = cm.id
        LEFT JOIN public.temp_images_1 AS t ON f.folio_number = t.folio_number AND t.client_code = cm.client_code
        WHERE d.user_attr2 = f.folio_number
          AND cm.client_code = d.id_fund
          AND d.transaction_reference_id = t.ihno
          AND d.created_by = 'system';
      `;
      const updateFolioResult = await client.query(updateFolioQuery);
      logs.push({
        row: 0,
        status: "updated",
        message: `Updated ${updateFolioResult.rowCount} folio_id rows in aif_document_details`,
        sql: updateFolioQuery,
      });
      this.logger.info(`Updated ${updateFolioResult.rowCount} folio_id rows`);

      // Query 4: Update transaction_reference_id
      const updateTransactionQuery = `
        UPDATE investor.aif_document_details AS d
        SET transaction_reference_id = ts.transaction_number
        FROM trxn.aif_transaction_summary AS ts
        WHERE ts.client_id = d.client_id
          AND ts.folio_id = d.folio_id
          AND ts.user_attr5 = d.user_attr1
          AND d.created_by = 'system'
          AND ts.client_id IN (SELECT id FROM fund.client_master WHERE client_code = d.id_fund)
          AND (ts.trxn_status != 'R' OR ts.trxn_status IS NULL)
          AND ts.created_by = 'aifappendersvc';
      `;
      const updateTransactionResult = await client.query(
        updateTransactionQuery
      );
      logs.push({
        row: 0,
        status: "updated",
        message: `Updated ${updateTransactionResult.rowCount} transaction_reference_id rows in aif_document_details`,
        sql: updateTransactionQuery,
      });
      this.logger.info(
        `Updated ${updateTransactionResult.rowCount} transaction_reference_id rows`
      );

      await client.query("COMMIT");
      this.logger.info("Folio and transaction updates completed");
      return { result: "success", logs };
    } catch (err) {
      if (client) {
        await client.query("ROLLBACK");
        this.logger.info("Transaction rolled back for folio update");
      }
      logs.push({
        row: 0,
        status: "error",
        message: `Folio update failed: ${
          err instanceof Error ? err.message : "Unknown error"
        }`,
      });
      return { result: "failed", logs };
    } finally {
      if (client) {
        client.release();
        this.logger.info("Database connection released");
      }
    }
  }
}

const trxnNameMap: Record<string, string> = {
  NEW: "New Application Form",
  NCT: "NCT Form",
  RED: "Redemption Form",
  FUL: "Redemption Form",
  IPO: "IPO Form",
  SIN: "SIP Form",
  SWOP: "SWP Form",
  SWOF: "SWP Form",
};

const mimeType: Record<string, string> = {
  tif: "image/tiff",
  pdf: "application/pdf",
};
