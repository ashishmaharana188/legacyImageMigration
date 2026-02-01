import ExcelJS from "exceljs";
import path from "path";
import { processExcelRows } from "./uploadExcelProcessor";
import { createProcessedExcelFile } from "./uploadProcessorUtil";
import { createFeatureLogger } from "../../utils/logger";

// Initialize Feature-Specific Logger
const logger = createFeatureLogger("uploadProcessor");

export async function processExcelFile(
  inputFilePath: string,
  onProgress?: (stats: any) => void
) {
  // [CHECKPOINT] INITIATED
  logger.info(`Initiating Excel Processing: ${path.basename(inputFilePath)}`, {
    console: true,
  });

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

  // Call Processor (Logger is instantiated inside the processor to ensure consistency)
  const result = await processExcelRows(
    worksheet,
    headerIndices,
    trxnMap,
    getFileExtension,
    onProgress
  );

  const outputFileName = await createProcessedExcelFile(
    result.processedRows,
    inputFilePath
  );

  // [CHECKPOINT] SUCCESS
  logger.info(`Excel Processing Complete. Output: ${outputFileName}`, {
    console: true,
  });

  return { ...result, outputFileName };
}
