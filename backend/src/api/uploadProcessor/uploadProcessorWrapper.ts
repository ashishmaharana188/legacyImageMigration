import { processExcelRows } from "./uploadExcelProcessor";
import { createProcessedExcelFile } from "./uploadProcessorUtil";
import {
  ProcessExcelRowsResult,
  ProcessedExcelFileResult,
  ProcessedSummary,
} from "./uploadProcessorTypes";
import ExcelJS from "exceljs";
import winston from "winston";
import path from "path";

//  processExcelFile
export async function processExcelFile(
  inputFilePath: string
): Promise<ProcessedExcelFileResult> {
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

  const getFileExtension = (filePath: string): string => {
    return filePath ? path.extname(filePath).toLowerCase() : "";
  };

  const workbook = new ExcelJS.Workbook();
  logger.info("Reading Excel file:", { inputFilePath });
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
  logger.info("Worksheet loaded:", { name: worksheet.name });

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

  const result: ProcessExcelRowsResult = await processExcelRows(
    worksheet,
    headerIndices,
    trxnMap,
    logger,
    getFileExtension
  );

  // createProcessedExcelFile handles file creation and returns the output filename
  const outputFileName: string = await createProcessedExcelFile(
    result.processedRows,
    inputFilePath // Input file path to be deleted
  );

  const summary: ProcessedSummary = {
    totalRows: result.totalRows,
    successfulRows: result.successfulRows,
    errors: result.errors,
    notFound: result.notFound,
  };

  return {
    outputFileName,
    files: result.files,
    processedRows: result.processedRows,
    summary: summary, // Not [summary]
  };
}
