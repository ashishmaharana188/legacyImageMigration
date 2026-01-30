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
  const actualTotalRows = lastRow - 1;

  const possibleExtensions = [".pdf", ".tif", ".tiff", ".jpg", ".jpeg", ".png"];
  let lastUpdateTime = Date.now();
  const BROADCAST_INTERVAL = 10000; // 10 seconds

  for (let rowNumber = 2; rowNumber <= lastRow; rowNumber++) {
    const row = worksheet.getRow(rowNumber);
    if (!row.hasValues || !row.getCell(headerIndices["id_fund"]).value)
      continue;

    totalRows++;
    const fund = row.getCell(headerIndices["id_fund"]).text?.trim() || "";
    const ihNo = row.getCell(headerIndices["id_ihno"]).text?.trim() || "";
    const trxnTypeRaw =
      row.getCell(headerIndices["id_trtype"]).text?.trim() || "";
    const pathVal = row.getCell(headerIndices["id_path"]).text?.trim() || "";
    const serverId =
      row.getCell(headerIndices["id_serverip"]).text?.trim() || "";
    const drivePath =
      row.getCell(headerIndices["id_drivepath"]).text?.trim() || "";
    const acNo = row.getCell(headerIndices["id_acno"]).text?.trim() || "";
    const trnMapped = trxnMap[trxnTypeRaw] || trxnTypeRaw;

    try {
      let sourceFilePath = "";
      let foundFile = false;
      let finalPathVal = pathVal;

      // TIER 1: Local File Check
      const localFilesFolder = path.join(process.cwd(), "localFiles");
      const localTrialPath = path.join(localFilesFolder, pathVal);

      if (
        await fs
          .access(localTrialPath)
          .then(() => true)
          .catch(() => false)
      ) {
        sourceFilePath = localTrialPath;
        foundFile = true;
      } else {
        for (const ext of possibleExtensions) {
          const trial = localTrialPath + ext;
          if (
            await fs
              .access(trial)
              .then(() => true)
              .catch(() => false)
          ) {
            sourceFilePath = trial;
            finalPathVal = pathVal + ext;
            foundFile = true;
            break;
          }
        }
      }

      // TIER 2: Network / SMB Path Check (Restored Logic)
      if (!foundFile && serverId && pathVal) {
        // Construct SMB path exactly as old code did
        let smbPath = path
          .normalize(`${serverId}\\${pathVal}`.replace(/\//g, "\\"))
          .replace(/^(\.\.[\/\\])+/, "");

        // Handle image/common folder replacement
        if (smbPath.includes("image"))
          smbPath = smbPath.replace(/image/g, drivePath);
        else if (smbPath.includes("common"))
          smbPath = smbPath.replace(/common/g, drivePath);

        if (
          await fs
            .access(smbPath)
            .then(() => true)
            .catch(() => false)
        ) {
          sourceFilePath = smbPath;
          foundFile = true;
          logger.info(`Row ${rowNumber}: Found on Network at ${smbPath}`);
        }
      }

      if (foundFile) {
        const destinationFilePath = await buildDestinationFilePath(
          trnMapped,
          fund,
          ihNo,
          finalPathVal,
          rowNumber
        );

        // Detailed log to Winston (File Only)
        logger.info(
          `Row ${rowNumber}: Copying ${sourceFilePath} to ${destinationFilePath}`
        );

        const sourceData = await fs.readFile(sourceFilePath);
        await fs.writeFile(destinationFilePath, sourceData);

        successfulRows++;
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
          `Row ${rowNumber}: File not found locally or on network: ${pathVal}`
        );
        processedRows.push({
          id_fund: fund,
          id_trtype: trnMapped,
          id_ihno: ihNo,
          id_path: pathVal,
          id_acno: acNo,
          page_count: "Not Found",
        });
      }

      // THROTTLED WEBSOCKET BROADCAST
      const currentTime = Date.now();
      if (onProgress && currentTime - lastUpdateTime >= BROADCAST_INTERVAL) {
        onProgress({
          totalRows: actualTotalRows,
          processedRows: totalRows,
          successfulRows,
          errors,
          notFound,
        });
        lastUpdateTime = currentTime;
      }
    } catch (err) {
      errors++;
      logger.error(`Row ${rowNumber} Critical Failure:`, { error: err });
    }
  }

  // Final Broadcast to ensure 100% completion
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
