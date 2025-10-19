import ExcelJS from "exceljs";
import fs from "fs/promises";
import path from "path";
import winston from "winston";
import { ProcessedRow } from "../uploadProcessor/uploadProcessorTypes"; // <-- NEW IMPORT

const baseFolder = path.join(__dirname, "../../../../output"); // Adjusted path
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

export async function buildDestinationFilePath(
  trxn: string,
  fund: string,
  ihNo: string,
  pathVal: string,
  rowNumber: number
): Promise<string> {
  if (!fund || !ihNo || /[<>:"|?*]/.test(fund) || /[<>:"|?*]/.test(ihNo)) {
    throw new Error(`Invalid fund (${fund}) or ihNo (${ihNo}) for file path`);
  }
  const clientPath =
    trxn === "DD"
      ? path.join(baseFolder, trxn, `CLIENT_CODE_${fund}`)
      : path.join(baseFolder, `CLIENT_CODE_${fund}`);
  logger.info(`Row ${rowNumber}: Creating clientPath: ${clientPath}`);
  await fs.mkdir(clientPath, { recursive: true });

  const fileFolderPath =
    trxn === "DD"
      ? path.join(clientPath, `CLIENT_CODE_${fund}_BATCH_NUMBER_${ihNo}`)
      : path.join(clientPath, `CLIENT_CODE_${fund}_TRANSACTION_NUMBER_${ihNo}`);
  logger.info(`Row ${rowNumber}: Creating fileFolderPath: ${fileFolderPath}`);
  await fs.mkdir(fileFolderPath, { recursive: true });

  const parsedPath = path.parse(pathVal);
  const baseFileName = path.basename(fileFolderPath);
  const fileExt = parsedPath.ext.toLowerCase();

  return path.join(fileFolderPath, `${baseFileName}${fileExt}`);
}

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

  processedRows.forEach((row) => {
    csvWorksheet.addRow(row);
  });

  logger.info("Finished processing rows");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputFileName = `processed_${timestamp}.csv`;
  const outputPath = path.join("processed", outputFileName);
  logger.info(`Saving processed file to: ${outputPath}`);
  await csvWorkbook.csv.writeFile(outputPath);
  logger.info("Processed file saved");

  logger.info("Deleting input file:", { inputFilePath });
  await fs.unlink(inputFilePath);
  logger.info("Input file deleted");

  return outputFileName;
}
