/* eslint-disable no-useless-escape */
import {
  ProcessedRow,
  ProcessExcelRowsResult,
} from "../uploadProcessor/uploadProcessorTypes";
import { buildDestinationFilePath } from "./uploadProcessorUtil";
import ExcelJS from "exceljs";
import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import winston from "winston";

// Define the callback type locally to avoid extra imports
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
  onProgress?: ProgressCallback // <--- Added for dynamic progress
): Promise<ProcessExcelRowsResult> {
  let totalRows = 0;
  let successfulRows = 0; // FIX: Changed from const to let
  let errors = 0;
  let notFound = 0; // FIX: Changed from const to let
  const processedRows: ProcessedRow[] = [];

  const lastRow = worksheet.rowCount;
  const actualTotalRows = lastRow - 1;
  logger.info("Total rows to process:", { lastRow });

  for (let rowNumber = 2; rowNumber <= lastRow; rowNumber++) {
    const row = worksheet.getRow(rowNumber);
    if (!row.hasValues || !row.getCell(headerIndices["id_fund"]).value) {
      logger.info(`Row ${rowNumber}: Empty or invalid row, skipping`);
      continue;
    }

    totalRows++;

    // --- SEND DYNAMIC UPDATE TO UI ---
    if (onProgress) {
      onProgress({
        totalRows: actualTotalRows,
        processedRows: totalRows,
        successfulRows,
        errors,
        notFound,
      });
    }

    try {
      // ... (Data extraction logic remains the same)
      const fund = row.getCell(headerIndices["id_fund"]).text?.trim() || "";
      const ihNo = row.getCell(headerIndices["id_ihno"]).text?.trim() || "";
      const trxnType =
        row.getCell(headerIndices["id_trtype"]).text?.trim() || "";
      const pathVal = row.getCell(headerIndices["id_path"]).text?.trim() || "";

      // (Source resolution logic...)
      const localFilesFolder = path.resolve(
        __dirname,
        "../../../../localFiles"
      );
      const sourceFilePath = path.join(localFilesFolder, pathVal);

      if (
        await fs
          .access(sourceFilePath)
          .then(() => true)
          .catch(() => false)
      ) {
        const trxn = trxnMap[trxnType] || trxnType;
        const sourceData = await fs.readFile(sourceFilePath);
        const destinationFilePath = await buildDestinationFilePath(
          trxn,
          fund,
          ihNo,
          pathVal,
          rowNumber
        );

        await fs.writeFile(destinationFilePath, sourceData);

        // --- FIX: INCREMENT SUCCESS COUNTER ---
        successfulRows++;

        processedRows.push({
          id_fund: fund,
          id_trtype: trxn,
          id_ihno: ihNo,
          id_path: pathVal,
          id_acno: row.getCell(headerIndices["id_acno"]).text?.trim() || "",
          page_count: "Saved",
        });
      } else {
        notFound++;
        processedRows.push({
          id_fund: fund,
          id_path: pathVal,
          page_count: "Not Found",
        });
      }
    } catch (err) {
      errors++;
      logger.error(`Error processing row ${rowNumber}`, { error: err });
    }
  }

  return { totalRows, successfulRows, errors, notFound, processedRows };
}
