import ExcelJS from "exceljs";
import fs from "fs/promises";
import path from "path";
import { ProcessedRow } from "./uploadProcessorTypes";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { getPgPool } from "../../utils/dbConnect";

const baseFolder = path.join(process.cwd(), "output");

/**
 * Calculates page count based on file extension
 */
export async function getPageCount(filePath: string): Promise<string | number> {
  const ext = path.extname(filePath).toLowerCase();

  try {
    const fileBuffer = await fs.readFile(filePath);

    if (ext === ".pdf") {
      const pdfDoc = await PDFDocument.load(fileBuffer, {
        ignoreEncryption: true,
      });
      return pdfDoc.getPageCount();
    } else if ([".tif", ".tiff", ".jpg", ".jpeg", ".png"].includes(ext)) {
      const metadata = await sharp(fileBuffer).metadata();
      return metadata.pages || 1;
    }
    return 1;
  } catch (error: any) {
    return `Error: ${error.message}`;
  }
}

/**
 * Generates the absolute path for file transfers
 */
export async function buildDestinationFilePath(
  trxn: string,
  fund: string,
  ihNo: string,
  pathVal: string,
  rowNumber: number
): Promise<string> {
  if (!fund || !ihNo) {
    throw new Error(
      `Row ${rowNumber}: Missing fund or ihNo for path generation.`
    );
  }

  const clientPath = path.join(baseFolder, `CLIENT_CODE_${fund}`);
  await fs.mkdir(clientPath, { recursive: true });

  const fileFolderPath = path.join(
    clientPath,
    `CLIENT_CODE_${fund}_TRANSACTION_NUMBER_${ihNo}`
  );
  await fs.mkdir(fileFolderPath, { recursive: true });

  const fileExt = path.extname(pathVal).toLowerCase();
  const baseFileName = path.basename(fileFolderPath);

  return path.join(fileFolderPath, `${baseFileName}${fileExt}`);
}

/**
 * Creates the final processed CSV summary
 */
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

  processedRows.forEach((row) => csvWorksheet.addRow(row));

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputFileName = `processed_${timestamp}.csv`;
  const processedDir = path.join(process.cwd(), "processed");

  if (
    !(await fs
      .access(processedDir)
      .then(() => true)
      .catch(() => false))
  ) {
    await fs.mkdir(processedDir, { recursive: true });
  }

  const outputPath = path.join(processedDir, outputFileName);
  await csvWorkbook.csv.writeFile(outputPath);

  await fs.unlink(inputFilePath);

  return outputFileName;
}

/**
 * Athena DB Staging & Filtering Pipeline
 */
export async function processAthenaDataThroughPostgres(
  parsedCsvData: Record<string, any>[]
): Promise<Record<string, any>[]> {
  if (!parsedCsvData || parsedCsvData.length === 0) return [];

  const pool = await getPgPool();
  const client = await pool.connect();

  const tableName = "public.temp_athena_csv_imagedump";
  const headers = Object.keys(parsedCsvData[0]).map((h) =>
    h.trim().toLowerCase()
  );

  try {
    await client.query("BEGIN");

    // 1. DYNAMIC SCHEMA: Check if table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'temp_athena_csv_imagedump'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      // AUTO-CREATE
      const createColumns = headers
        .map((header) => `"${header}" TEXT`)
        .join(", ");
      await client.query(`CREATE TABLE ${tableName} (${createColumns});`);
    } else {
      // AUTO-ALTER
      const colCheck = await client.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'temp_athena_csv_imagedump';
      `);
      const existingColumns = colCheck.rows.map((r) =>
        r.column_name.toLowerCase()
      );
      const missingColumns = headers.filter(
        (h) => !existingColumns.includes(h)
      );

      for (const missingCol of missingColumns) {
        await client.query(
          `ALTER TABLE ${tableName} ADD COLUMN "${missingCol}" TEXT;`
        );
      }
    }

    // 2. DATA INGESTION: Truncate old data
    await client.query(`TRUNCATE TABLE ${tableName};`);

    // [FIX] BATCH INSERTION TO PREVENT PARAMETER OVERFLOW
    if (parsedCsvData.length > 0) {
      const insertColumns = headers.map((h) => `"${h}"`).join(", ");
      const BATCH_SIZE = 1000; // Safe chunk size that won't hit Postgres parameter limits

      for (let i = 0; i < parsedCsvData.length; i += BATCH_SIZE) {
        const chunk = parsedCsvData.slice(i, i + BATCH_SIZE);
        const valuePlaceholders = [];
        const flatValues = [];
        let paramIndex = 1;

        for (const row of chunk) {
          const rowPlaceholders = [];
          for (const header of headers) {
            rowPlaceholders.push(`$${paramIndex++}`);
            flatValues.push(row[header] || null);
          }
          valuePlaceholders.push(`(${rowPlaceholders.join(", ")})`);
        }

        const insertQuery = `INSERT INTO ${tableName} (${insertColumns}) VALUES ${valuePlaceholders.join(
          ", "
        )};`;
        await client.query(insertQuery, flatValues);
      }
    }

    // 3. FILTER: Execute Diff Query
    const filterQuery = `
      SELECT tmp.*
      FROM ${tableName} AS tmp
      LEFT JOIN (
          SELECT cli.client_code, doc.user_attr1
          FROM investor.aif_document_details AS doc
          JOIN fund.client_master AS cli ON cli.id = doc.client_id
          WHERE doc.created_by = 'system'
      ) AS docs
      ON tmp.id_fund = docs.client_code AND tmp.id_ihno = docs.user_attr1
      WHERE docs.client_code IS NULL
      AND tmp.id_trtype in (
        'NEW','NCT','RED','ADD','TU','SIN','IOBIS','FUL','SWOF','SWOP','SWP'
      );
    `;

    const result = await client.query(filterQuery);

    await client.query("COMMIT");
    return result.rows;
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("DB Staging Process Failed:", error);
    throw error;
  } finally {
    client.release();
  }
}
