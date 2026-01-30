import ExcelJS from "exceljs";
import path from "path";
import { processExcelRows } from "./uploadExcelProcessor";
import { createProcessedExcelFile } from "./uploadProcessorUtil";
import logger from "../../utils/logger";

export async function processExcelFile(
  inputFilePath: string,
  onProgress?: (stats: any) => void
) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(inputFilePath);
  const worksheet = workbook.worksheets[0];

  const headerRow = worksheet.getRow(1);
  const headerIndices: { [key: string]: number } = {};
  headerRow.eachCell((cell, colNumber) => {
    const header = cell.text?.trim().toLowerCase();
    if (header) headerIndices[header] = colNumber;
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

  const getFileExtension = (filePath: string) =>
    path.extname(filePath).toLowerCase();

  // PASSING ONPROGRESS TO THE PROCESSOR
  const result = await processExcelRows(
    worksheet,
    headerIndices,
    trxnMap,
    logger as any,
    getFileExtension,
    onProgress
  );

  const outputFileName = await createProcessedExcelFile(
    result.processedRows,
    inputFilePath
  );

  return { ...result, outputFileName };
}
