import ExcelJS from "exceljs";
import fs from "fs/promises";
import path from "path";
import { ProcessedRow } from "../uploadProcessor/uploadProcessorTypes";
// [NEW] Imports for Page Counting
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";

const baseFolder = path.join(process.cwd(), "output");

/**
 * [NEW] Calculates page count based on file extension
 */
export async function getPageCount(filePath: string): Promise<string | number> {
  const ext = path.extname(filePath).toLowerCase();

  try {
    const fileBuffer = await fs.readFile(filePath);

    if (ext === ".pdf") {
      const pdfDoc = await PDFDocument.load(fileBuffer, {
        ignoreEncryption: true,
      });
      return pdfDoc.getPageCount();
    } else if ([".tif", ".tiff", ".jpg", ".jpeg", ".png"].includes(ext)) {
      const metadata = await sharp(fileBuffer).metadata();
      // TIFFs can be multi-page; standard images are 1
      return metadata.pages || 1;
    }
    // Default for text or unknown files
    return 1;
  } catch (error: any) {
    return `Error: ${error.message}`;
  }
}

/**
 * Generates the absolute path for file transfers
 */
export async function buildDestinationFilePath(
  trxn: string,
  fund: string,
  ihNo: string,
  pathVal: string,
  rowNumber: number
): Promise<string> {
  if (!fund || !ihNo) {
    throw new Error(
      `Row ${rowNumber}: Missing fund or ihNo for path generation.`
    );
  }

  const clientPath = path.join(baseFolder, `CLIENT_CODE_${fund}`);
  await fs.mkdir(clientPath, { recursive: true });

  const fileFolderPath = path.join(
    clientPath,
    `CLIENT_CODE_${fund}_TRANSACTION_NUMBER_${ihNo}`
  );
  await fs.mkdir(fileFolderPath, { recursive: true });

  const fileExt = path.extname(pathVal).toLowerCase();
  const baseFileName = path.basename(fileFolderPath);

  return path.join(fileFolderPath, `${baseFileName}${fileExt}`);
}

/**
 * Creates the final processed CSV summary
 */
export async function createProcessedExcelFile(
  processedRows: ProcessedRow[],
  inputFilePath: string
): Promise<string> {
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

  processedRows.forEach((row) => csvWorksheet.addRow(row));

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputFileName = `processed_${timestamp}.csv`;
  const processedDir = path.join(process.cwd(), "processed");

  if (
    !(await fs
      .access(processedDir)
      .then(() => true)
      .catch(() => false))
  ) {
    await fs.mkdir(processedDir, { recursive: true });
  }

  const outputPath = path.join(processedDir, outputFileName);
  await csvWorkbook.csv.writeFile(outputPath);

  await fs.unlink(inputFilePath);

  return outputFileName;
}
