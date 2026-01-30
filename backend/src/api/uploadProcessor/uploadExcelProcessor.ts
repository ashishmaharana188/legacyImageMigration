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
  const actualTotalRows = worksheet.rowCount - 1;

  const extensions = [".pdf", ".tif", ".tiff", ".jpg", ".jpeg", ".png"];

  // --- BATCHING SETUP ---
  let lastUpdate = 0;
  const BATCH_INTERVAL = 1000; // 1 Second Interval

  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
    const row = worksheet.getRow(rowNumber);
    // Skip empty rows or rows missing the Fund ID
    if (!row.hasValues || !row.getCell(headerIndices["id_fund"]).value)
      continue;

    totalRows++;

    try {
      // 1. Extract Data
      const fund = row.getCell(headerIndices["id_fund"]).text?.trim() || "";
      const pathVal = row.getCell(headerIndices["id_path"]).text?.trim() || "";
      const serverId =
        row.getCell(headerIndices["id_serverip"]).text?.trim() || "";
      const drivePath =
        row.getCell(headerIndices["id_drivepath"]).text?.trim() || "";
      const ihNo = row.getCell(headerIndices["id_ihno"]).text?.trim() || "";
      const trxnTypeRaw =
        row.getCell(headerIndices["id_trtype"]).text?.trim() || "";
      const acNo = row.getCell(headerIndices["id_acno"]).text?.trim() || "";
      const trnMapped = trxnMap[trxnTypeRaw] || trxnTypeRaw;

      let srcPath = "";
      let found = false;
      let finalPath = pathVal;

      // 2. Search Logic - Tier 1: Local Files
      const localBase = path.join(process.cwd(), "localFiles", pathVal);
      if (
        await fs
          .access(localBase)
          .then(() => true)
          .catch(() => false)
      ) {
        srcPath = localBase;
        found = true;
      } else {
        // Check extensions if exact match fails
        for (const ext of extensions) {
          if (
            await fs
              .access(localBase + ext)
              .then(() => true)
              .catch(() => false)
          ) {
            srcPath = localBase + ext;
            finalPath = pathVal + ext;
            found = true;
            break;
          }
        }
      }

      // 3. Search Logic - Tier 2: SMB/Network Paths
      if (!found && serverId && pathVal) {
        let smb = path
          .normalize(`${serverId}\\${pathVal}`.replace(/\//g, "\\"))
          .replace(/^(\.\.[\/\\])+/, "");

        // Handle path substitutions
        if (smb.includes("image")) smb = smb.replace(/image/g, drivePath);
        else if (smb.includes("common"))
          smb = smb.replace(/common/g, drivePath);

        if (
          await fs
            .access(smb)
            .then(() => true)
            .catch(() => false)
        ) {
          srcPath = smb;
          found = true;
        }
      }

      // 4. File Operation
      if (found) {
        const dest = await buildDestinationFilePath(
          trnMapped,
          fund,
          ihNo,
          finalPath,
          rowNumber
        );
        await fs.writeFile(dest, await fs.readFile(srcPath));
        successfulRows++;
        processedRows.push({
          id_fund: fund,
          id_trtype: trnMapped,
          id_ihno: ihNo,
          id_path: finalPath,
          id_acno: acNo,
          page_count: "Saved",
        });
      } else {
        notFound++;
        processedRows.push({
          id_fund: fund,
          id_trtype: trnMapped,
          id_ihno: ihNo,
          id_path: pathVal,
          id_acno: acNo,
          page_count: "Not Found",
        });
      }

      // 5. [FIX] Batched Progress Update
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
      logger.error(`Row ${rowNumber} Error:`, err);
    }
  }

  // 6. Final Completion Update (Always runs)
  if (onProgress) {
    onProgress({
      totalRows: actualTotalRows,
      processedRows: totalRows,
      successfulRows,
      errors,
      notFound,
    });
  }

  return { totalRows, successfulRows, errors, notFound, processedRows };
}
