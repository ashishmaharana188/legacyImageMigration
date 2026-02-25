import path from "path";
import fs from "fs/promises";
import ExcelJS from "exceljs";
import { parse as parseCsv } from "csv-parse/sync";
import { processDataRows } from "./uploadExcelProcessor";
import { getFileExtension, getTrxnMap } from "./uploadProcessorUtil";
import { ProcessExcelRowsResult } from "./uploadProcessorTypes";

export async function processExcelFile(
  filePath: string,
  onProgress?: (stats: any) => void
): Promise<ProcessExcelRowsResult & { outputFileName: string }> {
  try {
    const ext = path.extname(filePath).toLowerCase();
    let dataRows: Record<string, any>[] = [];

    if (ext === ".csv") {
      const fileContent = await fs.readFile(filePath, "utf-8");
      // 1. Parse CSV and normalize headers to lowercase
      dataRows = parseCsv(fileContent, {
        columns: (headers) => headers.map((h: string) => h.trim().toLowerCase()),
        skip_empty_lines: true,
      });
    } else if (ext === ".xlsx" || ext === ".xls") {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filePath);
      const worksheet = workbook.worksheets[0];

      const headerRow = worksheet.getRow(1);
      const headers = (headerRow.values as string[]).map(h => h ? String(h).trim().toLowerCase() : "");

      // 2. Parse Excel and map values to lowercase header keys
      for (let i = 2; i <= worksheet.rowCount; i++) {
        const row = worksheet.getRow(i);
        if (!row.hasValues) continue;

        const rowData: Record<string, any> = {};
        row.eachCell((cell, colNumber) => {
          if (headers[colNumber]) {
            rowData[headers[colNumber]] = cell.text ? String(cell.text).trim() : "";
          }
        });
        dataRows.push(rowData);
      }
    } else {
      throw new Error("Unsupported format. Use .csv or .xlsx");
    }

    const trxnMap = await getTrxnMap();

    // 3. Send uniform JSON data to the processor
    const result = await processDataRows(dataRows, trxnMap, getFileExtension, onProgress);

    return { ...result, outputFileName: `processed_${path.basename(filePath)}` };
  } catch (error) {
    console.error("Error formatting file:", error);
    throw error;
  }
}
