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
  const BROADCAST_INTERVAL = 10000;

  // Simple terminal start message
  console.log(`Processing Excel: Reading ${actualTotalRows} rows...`);

  for (let rowNumber = 2; rowNumber <= lastRow; rowNumber++) {
    const row = worksheet.getRow(rowNumber);
    if (!row.hasValues || !row.getCell(headerIndices["id_fund"]).value)
      continue;

    totalRows++;

    try {
      const fund = row.getCell(headerIndices["id_fund"]).text?.trim() || "";
      const pathVal = row.getCell(headerIndices["id_path"]).text?.trim() || "";
      const serverId =
        row.getCell(headerIndices["id_serverip"]).text?.trim() || "";
      const drivePath =
        row.getCell(headerIndices["id_drivepath"]).text?.trim() || "";
      const ihNo = row.getCell(headerIndices["id_ihno"]).text?.trim() || "";
      const trxnTypeRaw =
        row.getCell(headerIndices["id_trtype"]).text?.trim() || "";
      const trnMapped = trxnMap[trxnTypeRaw] || trxnTypeRaw;

      let sourceFilePath = "";
      let foundFile = false;
      let finalPathVal = pathVal;

      // Tier 1: Local Check
      const localTrialPath = path.join(process.cwd(), "localFiles", pathVal);
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

      // Tier 2: Network Check (SMB)
      if (!foundFile && serverId && pathVal) {
        let smbPath = path
          .normalize(`${serverId}\\${pathVal}`.replace(/\//g, "\\"))
          .replace(/^(\.\.[\/\\])+/, "");
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
        await fs.writeFile(
          destinationFilePath,
          await fs.readFile(sourceFilePath)
        );
        successfulRows++; // Iterative increment

        processedRows.push({
          id_fund: fund,
          id_trtype: trnMapped,
          id_ihno: ihNo,
          id_path: finalPathVal,
          id_acno: row.getCell(headerIndices["id_acno"]).text?.trim() || "",
          page_count: "Saved",
        });
      } else {
        notFound++; // Iterative increment
        processedRows.push({
          id_fund: fund,
          id_path: pathVal,
          id_ihno: ihNo,
          id_trtype: trnMapped,
          id_acno: "",
          page_count: "Not Found",
        });
      }

      // BROADCAST: Every 10 seconds for UI bar movement
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
      logger.error(`Row ${rowNumber} Error:`, err);
    }
  }

  // Final terminal completion message
  console.log(`Processing Complete.`);

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
