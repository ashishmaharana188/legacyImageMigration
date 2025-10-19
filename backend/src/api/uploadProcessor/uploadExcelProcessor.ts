import ExcelJS from "exceljs";
import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import winston from "winston";

import { buildDestinationFilePath } from "./uploadProcessorUtil";
import {
  ProcessedFile,
  ProcessedRow,
  ProcessExcelRowsResult,
} from "../uploadProcessor/uploadProcessorTypes";

export async function processExcelRows(
  worksheet: ExcelJS.Worksheet,
  headerIndices: { [key: string]: number },
  trxnMap: Record<string, string>,
  logger: winston.Logger,
  getFileExtension: (filePath: string) => string
): Promise<ProcessExcelRowsResult> {
  let totalRows = 0;
  let successfulRows = 0;
  let errors = 0;
  let notFound = 0;
  const files: ProcessedFile[] = [];
  const processedRows: ProcessedRow[] = [];

  const lastRow = worksheet.rowCount;
  logger.info("Total rows to process:", { lastRow });

  for (let rowNumber = 2; rowNumber <= lastRow; rowNumber++) {
    const row = worksheet.getRow(rowNumber);
    if (!row.hasValues || !row.getCell(headerIndices["id_fund"]).value) {
      logger.info(`Row ${rowNumber}: Empty or invalid row, skipping`);
      continue;
    }

    totalRows++;
    logger.info(`Processing row ${rowNumber}`);
    const currentProcessedRows = rowNumber - 1;

    // Update global upload progress


    try {
      const serverId =
        row.getCell(headerIndices["id_serverip"]).text?.trim() || "";
      const drivePath =
        row.getCell(headerIndices["id_drivepath"]).text?.trim() || "";
      const pathVal = row.getCell(headerIndices["id_path"]).text?.trim() || "";
      const folder =
        row.getCell(headerIndices["id_drivepath"]).text?.trim() || "";
      const fund = row.getCell(headerIndices["id_fund"]).text?.trim() || "";
      const ihNo = row.getCell(headerIndices["id_ihno"]).text?.trim() || "";
      const trxnType =
        row.getCell(headerIndices["id_trtype"]).text?.trim() || "";

      logger.info(`Row ${rowNumber} data`, {
        serverId,
        drivePath,
        pathVal,
        folder,
        fund,
        ihNo,
        trxnType,
      });

      logger.info(`Current __dirname: ${__dirname}`);
      const localFilesFolder = path.resolve(
        __dirname,
        "../../../../localFiles"
      ); // Adjusted path
      let sourceFilePath: string = "";
      let isLocalFile = false;
      let isValidSmbPath = true;
      let resolvedPathVal = pathVal; // Use a new variable for pathVal that might get an extension appended

      const possibleExtensions = [
        ".pdf",
        ".tif",
        ".tiff",
        ".jpg",
        ".jpeg",
        ".png",
      ];

      let foundLocalFile = false;
      let currentLocalFilePath = path.join(localFilesFolder, pathVal);

      // First, try with the pathVal as is (it might already have an extension)
      logger.info(
        `Row ${rowNumber}: Checking local file path (as is): ${currentLocalFilePath}`
      );
      if (
        await fs
          .access(currentLocalFilePath)
          .then(() => true)
          .catch(() => false)
      ) {
        sourceFilePath = currentLocalFilePath;
        isLocalFile = true;
        foundLocalFile = true;
        logger.info(
          `Row ${rowNumber}: Local file found (as is): ${sourceFilePath}`
        );
      } else {
        // If not found, try appending common extensions
        for (const ext of possibleExtensions) {
          currentLocalFilePath = path.join(localFilesFolder, pathVal + ext);
          logger.info(
            `Row ${rowNumber}: Checking local file path (with extension ${ext}): ${currentLocalFilePath}`
          );
          if (
            await fs
              .access(currentLocalFilePath)
              .then(() => true)
              .catch(() => false)
          ) {
            sourceFilePath = currentLocalFilePath;
            isLocalFile = true;
            foundLocalFile = true;
            resolvedPathVal = pathVal + ext; // Update resolvedPathVal with the found extension
            logger.info(
              `Row ${rowNumber}: Local file found (with extension ${ext}): ${sourceFilePath}`
            );
            break; // Stop after finding the first matching extension
          }
        }
      }

      if (foundLocalFile) {
        // If a local file was found, proceed with it
        logger.info(`Row ${rowNumber}: Using local file: ${sourceFilePath}`);
      } else {
        // Fallback to SMB logic if no local file was found
        if (!serverId) {
          processedRows.push({
            id_fund: fund,
            id_trtype: trxnType,
            id_ihno: ihNo,
            id_path: pathVal,
            id_acno: row.getCell(headerIndices["id_acno"]).text?.trim() || "",
            page_count: "Missing serverId",
          });
          errors++;

          isValidSmbPath = false;
        }
        if (isValidSmbPath && !drivePath) {
          processedRows.push({
            id_fund: fund,
            id_trtype: trxnType,
            id_ihno: ihNo,
            id_path: pathVal,
            id_acno: row.getCell(headerIndices["id_acno"]).text?.trim() || "",
            page_count: "Missing drivePath",
          });

          isValidSmbPath = false;
        }
        if (isValidSmbPath && !pathVal) {
          processedRows.push({
            id_fund: fund,
            id_trtype: trxnType,
            id_ihno: ihNo,
            id_path: pathVal,
            id_acno: row.getCell(headerIndices["id_acno"]).text?.trim() || "",
            page_count: "Missing pathVal",
          });

          isValidSmbPath = false;
        }

        if (isValidSmbPath) {
          sourceFilePath = path
            .normalize(`${serverId}\\${pathVal}`.replace(/\//g, "\\"))
            .replace(/^(\.\.[\/\\])+/, "");
          if (sourceFilePath.includes("image")) {
            sourceFilePath = sourceFilePath.replace(/image/g, folder);
          } else if (sourceFilePath.includes("common")) {
            sourceFilePath = sourceFilePath.replace(/common/g, folder);
          }
          logger.info(`Row ${rowNumber}: Source file path: ${sourceFilePath}`);
        } else {
          sourceFilePath = ""; // Ensure sourceFilePath is empty if SMB path is invalid
        }
      }

      // If neither local file nor valid SMB path, skip to next row
      if (!isLocalFile && (!isValidSmbPath || sourceFilePath === "")) {
        continue;
      }

      // Use resolvedPathVal for subsequent operations that need the correct extension
      const fileExt = getFileExtension(resolvedPathVal);
      logger.info(`Row ${rowNumber}: File extension: ${fileExt}`);
      const trxn = trxnMap[trxnType] || "Unknown";

      if (
        isLocalFile ||
        (await fs
          .access(sourceFilePath)
          .then(() => true)
          .catch(() => false))
      ) {
        logger.info(`Row ${rowNumber}: Reading file: ${sourceFilePath}`);
        const sourceData = await fs.readFile(sourceFilePath);

        let destinationFilePath: string;
        try {
          destinationFilePath = await buildDestinationFilePath(
            trxn,
            fund,
            ihNo,
            resolvedPathVal, // Use resolvedPathVal here
            rowNumber
          );
        } catch (err) {
          logger.error(`Row ${rowNumber}: Path error`, { error: err });
          processedRows.push({
            id_fund: fund,
            id_trtype: trxn,
            id_ihno: ihNo,
            id_path: resolvedPathVal,
            id_acno: row.getCell(headerIndices["id_acno"]).text?.trim() || "",
            page_count: "Path Error",
          });
        }
        logger.info(`Row ${rowNumber}: Copying to: ${destinationFilePath}`);
        await fs.writeFile(destinationFilePath, sourceData);
        logger.info(`Row ${rowNumber}: Copied to: ${destinationFilePath}`);

        let pageCount: number | string = 0;
        try {
          if (fileExt === ".tif" || fileExt === ".tiff") {
            logger.info(`Row ${rowNumber}: Processing TIFF`);
            const metadata = await sharp(sourceData).metadata();
            pageCount = metadata.pages || 1;
          } else if (fileExt === ".pdf") {
            logger.info(`Row ${rowNumber}: Processing PDF`);
            const pdfDoc = await PDFDocument.load(sourceData);
            pageCount = pdfDoc.getPageCount();
          } else {
            pageCount = "Unsupported";
          }
          processedRows.push({
            id_fund: fund,
            id_trtype: trxn,
            id_ihno: ihNo,

            id_path: resolvedPathVal,
            id_acno: row.getCell(headerIndices["id_acno"]).text?.trim() || "",
            page_count: pageCount,
          });
          if (typeof pageCount === "number") {

            files.push({
              row: rowNumber,
              sourcePath: sourceFilePath,
              destinationPath: destinationFilePath,
              pageCount,
            });
          } else {

          }
        } catch (err) {
          logger.error(`Row ${rowNumber}: Page count error`, {
            error: err,
          });
          processedRows.push({
            id_fund: fund,
            id_trtype: trxn,
            id_ihno: ihNo,
            id_path: resolvedPathVal,
            id_acno: row.getCell(headerIndices["id_acno"]).text?.trim() || "",
            page_count: fileExt === ".pdf" ? "PDF Error" : "Unsupported",
          });

        }
      } else {
        logger.info(`File not found: ${sourceFilePath}`);
        processedRows.push({
          id_fund: fund,
          id_trtype: trxn,
          id_ihno: ihNo,
          id_path: resolvedPathVal,
          id_acno: row.getCell(headerIndices["id_acno"]).text?.trim() || "",
          page_count: "Not Found",
        });

      }
    } catch (err) {
      logger.error(`Error processing row ${rowNumber}`, { error: err });
      processedRows.push({
        id_fund: row.getCell(headerIndices["id_fund"]).text?.trim() || "",
        id_trtype: row.getCell(headerIndices["id_trtype"]).text?.trim() || "",
        id_ihno: row.getCell(headerIndices["id_ihno"]).text?.trim() || "",
        id_path: row.getCell(headerIndices["id_path"]).text?.trim() || "",
        id_acno: row.getCell(headerIndices["id_acno"]).text?.trim() || "",
        page_count: "Error",
      });

  }

  //**Reset upload progress after completion



  }

  return {
    totalRows,
    successfulRows,
    errors,
    notFound,
    files,
    processedRows,
  };
}
