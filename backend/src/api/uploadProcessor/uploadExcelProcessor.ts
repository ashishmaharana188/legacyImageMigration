/* eslint-disable no-useless-escape */
import {
  ProcessedRow,
  ProcessExcelRowsResult,
} from "../uploadProcessor/uploadProcessorTypes";
import { buildDestinationFilePath } from "./uploadProcessorUtil";
import ExcelJS from "exceljs";
import fs from "fs/promises";
import path from "path";
import winston from "winston";

type ProgressCallback = (stats: {
  totalRows: number;
  processedRows: number;
  successfulRows: number;
  errors: number;
  notFound: number;
}) => void;

export async function processExcelRows(
  worksheet: ExcelJS.Worksheet,
  headerIndices: { [key: string]: number },
  trxnMap: Record<string, string>,
  logger: winston.Logger,
  getFileExtension: (filePath: string) => string,
  onProgress?: ProgressCallback
): Promise<ProcessExcelRowsResult> {
  let totalRows = 0;
  let successfulRows = 0;
  let errors = 0;
  let notFound = 0;
  const processedRows: ProcessedRow[] = [];
  const lastRow = worksheet.rowCount;

  // Common extensions to check if the Excel path is missing one
  const possibleExtensions = [".pdf", ".tif", ".tiff", ".jpg", ".jpeg", ".png"];

  for (let rowNumber = 2; rowNumber <= lastRow; rowNumber++) {
    const row = worksheet.getRow(rowNumber);
    if (!row.hasValues || !row.getCell(headerIndices["id_fund"]).value)
      continue;

    totalRows++;
    const fund = row.getCell(headerIndices["id_fund"]).text?.trim() || "";
    const pathVal = row.getCell(headerIndices["id_path"]).text?.trim() || "";

    try {
      const projectRoot = process.cwd();
      const localFilesFolder = path.join(projectRoot, "localFiles");
      let sourceFilePath = path.join(localFilesFolder, pathVal);
      let finalPathVal = pathVal;

      // 1. Try exact match
      let fileExists = await fs
        .access(sourceFilePath)
        .then(() => true)
        .catch(() => false);

      // 2. If not found, try common extensions
      if (!fileExists) {
        for (const ext of possibleExtensions) {
          const trialPath = sourceFilePath + ext;
          const found = await fs
            .access(trialPath)
            .then(() => true)
            .catch(() => false);
          if (found) {
            sourceFilePath = trialPath;
            finalPathVal = pathVal + ext;
            fileExists = true;
            logger.info(
              `Row ${rowNumber}: Found file with appended extension: ${ext}`
            );
            break;
          }
        }
      }

      if (fileExists) {
        const trxnTypeRaw =
          row.getCell(headerIndices["id_trtype"]).text?.trim() || "";
        const ihNo = row.getCell(headerIndices["id_ihno"]).text?.trim() || "";
        const acNo = row.getCell(headerIndices["id_acno"]).text?.trim() || "";
        const trnMapped = trxnMap[trxnTypeRaw] || trxnTypeRaw;

        const destinationFilePath = await buildDestinationFilePath(
          trnMapped,
          fund,
          ihNo,
          finalPathVal,
          rowNumber
        );

        await fs.writeFile(
          destinationFilePath,
          await fs.readFile(sourceFilePath)
        );
        successfulRows++;

        logger.info(`Row ${rowNumber}: Success. Path: ${sourceFilePath}`);

        processedRows.push({
          id_fund: fund,
          id_trtype: trnMapped,
          id_ihno: ihNo,
          id_path: finalPathVal,
          id_acno: acNo,
          page_count: "Saved",
        });
      } else {
        notFound++;
        logger.warn(
          `Row ${rowNumber}: NOT FOUND. Checked base and extensions for: ${pathVal}`
        );
        processedRows.push({
          id_fund: fund,
          id_trtype: "",
          id_ihno: "",
          id_path: pathVal,
          id_acno: "",
          page_count: "Not Found",
        });
      }
    } catch (err) {
      errors++;
      logger.error(`Row ${rowNumber} Failure:`, {
        error: err instanceof Error ? err.message : err,
      });
    }
  }
  return { totalRows, successfulRows, errors, notFound, processedRows };
}
