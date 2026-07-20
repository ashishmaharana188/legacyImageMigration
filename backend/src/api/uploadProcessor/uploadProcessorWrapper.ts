import ExcelJS from "exceljs";
import path from "path";
import fs from "fs/promises";
import { parse as parseCsv } from "csv-parse/sync";
import { processDataRows } from "./uploadExcelProcessor"; // Uses the new data-agnostic processor
import { createProcessedExcelFile, getPageCount } from "./uploadProcessorUtil";
import { createFeatureLogger } from "../../utils/logger";
import { ProcessExcelRowsResult } from "./uploadProcessorTypes";

// Initialize Feature-Specific Logger
const logger = createFeatureLogger("uploadProcessor");

export async function processExcelFile(
  inputFilePath: string,
  onProgress?: (stats: any) => void,
): Promise<ProcessExcelRowsResult & { outputFileName: string }> {
  // [CHECKPOINT] INITIATED
  logger.info(`Initiating Processing: ${path.basename(inputFilePath)}`, {
    console: true,
  });

  const ext = path.extname(inputFilePath).toLowerCase();
  let dataRows: Record<string, any>[] = [];

  // 1. Parse file into uniform JSON rows based on extension
  if (ext === ".csv") {
    // Athena / Standard CSV Support
    const fileContent = await fs.readFile(inputFilePath, "utf-8");
    dataRows = parseCsv(fileContent, {
      columns: (headers) => headers.map((h: string) => h.trim().toLowerCase()),
      skip_empty_lines: true,
    });
  } else if (ext === ".xlsx" || ext === ".xls") {
    // Legacy Excel Support
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(inputFilePath);
    const worksheet = workbook.worksheets[0];

    const headerRow = worksheet.getRow(1);
    const headers = (headerRow.values as string[]).map((h) =>
      h ? String(h).trim().toLowerCase() : "",
    );

    for (let i = 2; i <= worksheet.rowCount; i++) {
      const row = worksheet.getRow(i);
      if (!row.hasValues) continue;

      const rowData: Record<string, any> = {};
      row.eachCell((cell, colNumber) => {
        if (headers[colNumber]) {
          rowData[headers[colNumber]] = cell.text
            ? String(cell.text).trim()
            : "";
        }
      });
      dataRows.push(rowData);
    }
  } else {
    throw new Error("Unsupported file format. Please upload .csv or .xlsx");
  }

  // 2. Define your local variables exactly as they were in your original code
  const trxnMap: Record<string, string> = {
    NEW: "IC",
    NCT: "NCT",
    RED: "RED",
    ADD: "TU",
    FUL: "RED",
    IPO: "IOBI",
    SIN: "IOBIS",
    SWOP: "SWP",
    SWOF: "SWP",
  };

  const getFileExtension = (filePath: string) =>
    path.extname(filePath).toLowerCase();

  // 3. Send uniform JSON data to the new processor
  const result = await processDataRows(
    dataRows,
    trxnMap,
    getFileExtension,
    onProgress,
  );

  // 4. Create the final CSV summary
  const outputFileName = await createProcessedExcelFile(
    result.processedRows,
    inputFilePath,
  );

  // [CHECKPOINT] SUCCESS
  logger.info(`Processing Complete. Output: ${outputFileName}`, {
    console: true,
  });

  return { ...result, outputFileName };
}

export async function runFallbackProcess(
  inputFilePath: string,
  onProgress?: (stats: any) => void,
): Promise<ProcessExcelRowsResult & { outputFileName: string }> {
  logger.info(
    `Initiating Fallback Processing: ${path.basename(inputFilePath)}`,
    {
      console: true,
    },
  );

  const ext = path.extname(inputFilePath).toLowerCase();
  let dataRows: Record<string, any>[] = [];

  // 1. Parse file into uniform JSON rows
  if (ext === ".csv") {
    const fileContent = await fs.readFile(inputFilePath, "utf-8");
    dataRows = parseCsv(fileContent, {
      columns: (headers) => headers.map((h: string) => h.trim().toLowerCase()),
      skip_empty_lines: true,
    });
  } else if (ext === ".xlsx" || ext === ".xls") {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(inputFilePath);
    const worksheet = workbook.worksheets[0];

    const headerRow = worksheet.getRow(1);
    const headers = (headerRow.values as string[]).map((h) =>
      h ? String(h).trim().toLowerCase() : "",
    );

    for (let i = 2; i <= worksheet.rowCount; i++) {
      const row = worksheet.getRow(i);
      if (!row.hasValues) continue;

      const rowData: Record<string, any> = {};
      row.eachCell((cell, colNumber) => {
        if (headers[colNumber]) {
          rowData[headers[colNumber]] = cell.text
            ? String(cell.text).trim()
            : "";
        }
      });
      dataRows.push(rowData);
    }
  } else {
    throw new Error("Unsupported file format. Please upload .csv or .xlsx");
  }

  const trxnMap: Record<string, string> = {
    NEW: "IC",
    NCT: "NCT",
    ADD: "TU",
    RED: "RED",
    FUL: "RED",
    IPO: "IOBI",
    SIN: "IOBIS",
    SWOP: "SWP",
    SWOF: "SWP",
  };

  const processedRows: any[] = [];
  let totalRows = 0,
    successfulRows = 0,
    errors = 0,
    notFound = 0;
  const actualTotalRows = dataRows.length;

  let lastUpdate = 0;
  const BATCH_INTERVAL = 1000;
  const baseFolder = path.join(process.cwd(), "output");

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const rowNumber = i + 2;

    if (!row["id_fund"]) continue;
    totalRows++;

    try {
      const fund = String(row["id_fund"] || "").trim();
      const pathVal = String(row["id_path"] || "").trim();
      const ihNo = String(row["id_ihno"] || "").trim();
      const trxnTypeRaw = String(row["id_trtype"] || "").trim();
      const acNo = String(row["id_acno"] || "").trim();
      const trnMapped = trxnMap[trxnTypeRaw] || trxnTypeRaw;

      // Check the output directory directly for the folder
      const fileFolderPath = path.join(
        baseFolder,
        `CLIENT_CODE_${fund}`,
        `CLIENT_CODE_${fund}_TRANSACTION_NUMBER_${ihNo}`,
      );

      let fileExists = false;
      let foundFilePath = "";
      let pageCountVal: string | number = "Not Found";
      let finalPath = pathVal;

      try {
        const filesInDir = await fs.readdir(fileFolderPath);
        if (filesInDir.length > 0) {
          foundFilePath = path.join(fileFolderPath, filesInDir[0]);
          fileExists = true;

          // Capture the exact extension found in output folder
          const actualExt = path.extname(foundFilePath);
          if (!pathVal.toLowerCase().endsWith(actualExt.toLowerCase())) {
            finalPath = pathVal + actualExt;
          }
        }
      } catch (e) {
        // Directory does not exist, fileExists stays false
      }

      if (fileExists) {
        pageCountVal = await getPageCount(foundFilePath);
        if (
          typeof pageCountVal === "string" &&
          pageCountVal.startsWith("Error:")
        ) {
          errors++;
          pageCountVal = "Corrupt File";
          logger.warn(
            `Fallback Row ${rowNumber}: Corrupt file found at ${foundFilePath}`,
          );
        } else {
          successfulRows++;
        }
      } else {
        notFound++;
      }

      processedRows.push({
        id_fund: fund,
        id_trtype: trnMapped,
        id_ihno: ihNo,
        id_path: finalPath,
        id_acno: acNo,
        page_count: String(pageCountVal),
      });

      const now = Date.now();
      if (onProgress && now - lastUpdate >= BATCH_INTERVAL) {
        onProgress({
          totalRows: actualTotalRows,
          processedRows: totalRows,
          successfulRows,
          errors,
          notFound,
        });
        lastUpdate = now;
      }
    } catch (err) {
      errors++;
      logger.error(`Fallback Row ${rowNumber} Error:`, { error: err });
    }
  }

  if (onProgress) {
    onProgress({
      totalRows: actualTotalRows,
      processedRows: totalRows,
      successfulRows,
      errors,
      notFound,
    });
  }

  // Generate the final CSV using the exact same util
  const outputFileName = await createProcessedExcelFile(
    processedRows,
    inputFilePath,
  );

  logger.info(`Fallback Processing Complete. Output: ${outputFileName}`, {
    console: true,
  });

  return {
    totalRows,
    successfulRows,
    errors,
    notFound,
    processedRows,
    outputFileName,
  };
}
