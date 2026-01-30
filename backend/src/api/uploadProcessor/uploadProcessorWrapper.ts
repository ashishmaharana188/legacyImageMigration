import { processExcelRows } from "./uploadExcelProcessor";
import { createProcessedExcelFile } from "./uploadProcessorUtil";
import {
  ProcessExcelRowsResult,
  ProcessedExcelFileResult,
} from "./uploadProcessorTypes";
import ExcelJS from "exceljs";
import winston from "winston";
import path from "path";
import fs from "fs";

export async function processExcelFile(
  inputFilePath: string,
  onProgress?: (stats: any) => void
): Promise<ProcessedExcelFileResult> {
  // Use current working directory for log paths
  const logDir = path.join(process.cwd(), "logs");
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

  const logger = winston.createLogger({
    level: "info",
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
    transports: [
      new winston.transports.File({
        filename: path.join(logDir, "error.log"),
        level: "error",
      }),
      new winston.transports.File({
        filename: path.join(logDir, "combined.log"),
      }),
      // Console transport removed to satisfy your request for condensed terminal logs
    ],
  });

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(inputFilePath);
  const worksheet = workbook.worksheets[0];

  const headerRow = worksheet.getRow(1);
  const headerIndices: { [key: string]: number } = {};
  headerRow.eachCell((cell, colNumber) => {
    headerIndices[cell.text?.trim().toLowerCase()] = colNumber;
  });

  const result = await processExcelRows(
    worksheet,
    headerIndices,
    { NEW: "IC", NCT: "NCT", RED: "RED", FUL: "RED" }, // trxnMap
    logger,
    (p) => path.extname(p).toLowerCase(),
    onProgress
  );

  const outputFileName = await createProcessedExcelFile(
    result.processedRows,
    inputFilePath
  );

  return {
    outputFileName,
    processedRows: result.processedRows,
    summary: {
      totalRows: result.totalRows,
      successfulRows: result.successfulRows,
      errors: result.errors,
      notFound: result.notFound,
    },
  };
}
