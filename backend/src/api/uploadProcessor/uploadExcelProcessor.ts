import { ProcessedRow, ProcessExcelRowsResult } from "../uploadProcessor/uploadProcessorTypes";
import { buildDestinationFilePath, getPageCount } from "./uploadProcessorUtil";
import fs from "fs/promises";
import path from "path";
import { createFeatureLogger } from "../../utils/logger";

const logger = createFeatureLogger("uploadProcessor");

// 1. Accepts a generic array of JSON objects (works for both CSV and Excel)
export async function processDataRows(
  dataRows: Record<string, any>[],
  trxnMap: Record<string, string>,
  getFileExtension: (filePath: string) => string,
  onProgress?: (stats: any) => void
): Promise<ProcessExcelRowsResult> {
  let totalRows = 0, successfulRows = 0, errors = 0, notFound = 0;
  const processedRows: ProcessedRow[] = [];
  const actualTotalRows = dataRows.length;
  const extensions = [".pdf", ".tif", ".tiff", ".jpg", ".jpeg", ".png"];

  let lastUpdate = 0;
  const BATCH_INTERVAL = 1000;

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const rowNumber = i + 2;

    // Skip if 'id_fund' is missing
    if (!row["id_fund"]) continue;

    totalRows++;

    try {
      // 2. Map strictly by string name!
      const fund = String(row["id_fund"] || "").trim();
      const pathVal = String(row["id_path"] || "").trim();
      const serverId = String(row["id_serverip"] || "").trim();
      const drivePath = String(row["id_drivepath"] || "").trim();
      const ihNo = String(row["id_ihno"] || "").trim();
      const trxnTypeRaw = String(row["id_trtype"] || "").trim();
      const acNo = String(row["id_acno"] || "").trim();
      const trnMapped = trxnMap[trxnTypeRaw] || trxnTypeRaw;

      let srcPath = "", found = false, finalPath = pathVal;

      const localBase = path.join(process.cwd(), "localFiles", pathVal);
      if (await fs.access(localBase).then(() => true).catch(() => false)) {
        srcPath = localBase; found = true;
      } else {
        for (const ext of extensions) {
          if (await fs.access(localBase + ext).then(() => true).catch(() => false)) {
            srcPath = localBase + ext; finalPath = pathVal + ext; found = true; break;
          }
        }
      }

      if (!found && serverId && pathVal) {
        let smb = path.normalize(`${serverId}\\${pathVal}`.replace(/\//g, "\\")).replace(/^(\.\.[\/\\])+/, "");
        if (smb.includes("image")) smb = smb.replace(/image/g, drivePath);
        else if (smb.includes("common")) smb = smb.replace(/common/g, drivePath);
        if (await fs.access(smb).then(() => true).catch(() => false)) {
          srcPath = smb; found = true;
        }
      }

      if (found) {
        const dest = await buildDestinationFilePath(trnMapped, fund, ihNo, finalPath, rowNumber);
        await fs.writeFile(dest, await fs.readFile(srcPath));
        const pageCountVal = await getPageCount(dest);
        successfulRows++;
        processedRows.push({ id_fund: fund, id_trtype: trnMapped, id_ihno: ihNo, id_path: finalPath, id_acno: acNo, page_count: String(pageCountVal) });
      } else {
        notFound++;
        processedRows.push({ id_fund: fund, id_trtype: trnMapped, id_ihno: ihNo, id_path: pathVal, id_acno: acNo, page_count: "Not Found" });
      }

      const now = Date.now();
      if (onProgress && now - lastUpdate >= BATCH_INTERVAL) {
        onProgress({ totalRows: actualTotalRows, processedRows: totalRows, successfulRows, errors, notFound });
        lastUpdate = now;
      }
    } catch (err) {
      errors++;
      logger.error(`Row ${rowNumber} Error:`, { error: err });
    }
  }

  if (onProgress) onProgress({ totalRows: actualTotalRows, processedRows: totalRows, successfulRows, errors, notFound });
  return { totalRows, successfulRows, errors, notFound, processedRows };
}
