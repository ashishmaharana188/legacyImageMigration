import ExcelJS from "exceljs";
import path from "path";
import fs from "fs/promises";
import { parse as parseCsv } from "csv-parse/sync";
import { processDataRows } from "./uploadExcelProcessor"; // Uses the new data-agnostic processor
import { createProcessedExcelFile } from "./uploadProcessorUtil";
import { createFeatureLogger } from "../../utils/logger";
import { ProcessExcelRowsResult } from "./uploadProcessorTypes";

// Initialize Feature-Specific Logger
const logger = createFeatureLogger("uploadProcessor");

export async function processExcelFile(
  inputFilePath: string,
  onProgress?: (stats: any) => void
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
      h ? String(h).trim().toLowerCase() : ""
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
    onProgress
  );

  // 4. Create the final CSV summary
  const outputFileName = await createProcessedExcelFile(
    result.processedRows,
    inputFilePath
  );

  // [CHECKPOINT] SUCCESS
  logger.info(`Processing Complete. Output: ${outputFileName}`, {
    console: true,
  });

  return { ...result, outputFileName };
}
