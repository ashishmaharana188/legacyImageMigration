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
  // 1. THE STORE (Memory is cheap)
  let totalRows = 0;
  let successfulRows = 0;
  let errors = 0;
  let notFound = 0;
  const processedRows: ProcessedRow[] = [];
  const actualTotalRows = worksheet.rowCount - 1;

  const extensions = [".pdf", ".tif", ".tiff", ".jpg", ".jpeg", ".png"];

  // 2. THE TIMER
  let lastUpdate = Date.now();
  const BATCH_INTERVAL_MS = 1000; // 1 Second (Best balance of speed vs efficiency)

  console.log(
    `[Batcher] Starting. Strategy: Update every ${BATCH_INTERVAL_MS}ms.`
  );

  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
    const row = worksheet.getRow(rowNumber);
    if (!row.hasValues || !row.getCell(headerIndices["id_fund"]).value)
      continue;

    totalRows++;

    try {
      // ... (Data Extraction Logic kept identical) ...
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

      // ... (File System Logic Tier 1 & 2 kept identical) ...
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

      if (!found && serverId && pathVal) {
        let smb = path
          .normalize(`${serverId}\\${pathVal}`.replace(/\//g, "\\"))
          .replace(/^(\.\.[\/\\])+/, "");
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

      if (found) {
        const dest = await buildDestinationFilePath(
          trnMapped,
          fund,
          ihNo,
          finalPath,
          rowNumber
        );
        await fs.writeFile(dest, await fs.readFile(srcPath));

        // [STORE] Increment counters (Cheap)
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
        // [STORE] Increment counters (Cheap)
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

      // 3. THE RELEASE (The Gatekeeper)
      const now = Date.now();
      if (onProgress && now - lastUpdate >= BATCH_INTERVAL_MS) {
        // Only sends 1 message per second, regardless of how fast rows are processed
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

  // Final Release (Always ensure 100% is sent at the end)
  if (onProgress)
    onProgress({
      totalRows: actualTotalRows,
      processedRows: totalRows,
      successfulRows,
      errors,
      notFound,
    });

  return { totalRows, successfulRows, errors, notFound, processedRows };
}
