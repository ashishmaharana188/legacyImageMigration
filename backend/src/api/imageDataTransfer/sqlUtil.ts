import { parse } from "csv-parse";
import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import ExcelJS from "exceljs";
import { Pool, PoolClient } from "pg";
import { createFeatureLogger } from "../../utils/logger";
import {
  getPgPool,
  reconnectPgPool,
  warmupPgPool,
} from "../../utils/dbConnect";
import Cursor from "pg-cursor";
import {
  SqlLog,
  AifDocumentDetail,
  ImageDataProgress,
} from "./imageDataTransferTypes";
import {
  pgQuery,
  pgBegin,
  pgCommit,
  pgRollback,
  SQL_SELECT_CLIENT_MASTER_BY_CODES,
  SQL_INSERT_AIF_DOCUMENT_DETAILS,
  SQL_DELETE_TEMP_IMAGES_1,
  SQL_CREATE_TEMP_TRANSACTION_DATA,
  SQL_INSERT_TEMP_TRANSACTION_DATA,
  SQL_INSERT_TEMP_IMAGES_FROM_CSV_KEYS, // [NEW IMPORT]
  SQL_UPDATE_FOLIO_ID,
  SQL_UPDATE_TRANSACTION_REFERENCE_ID,
  SQL_SELECT_CLIENT_ID_BY_CODE,
  SQL_SELECT_AIF_DOCUMENT_DETAILS,
  SQL_SELECT_AIF_DOCUMENT_DETAILS_BY_CLIENT,
  SQL_STREAM_UPDATE_DETAILS,
  SQL_INSERT_ALL_TEMP_IMAGES,
  SQL_UPDATE_ALL_TRXN_REF,
  SQL_UPDATE_ALL_FOLIO_ID,
} from "./imageDataTransferCore";

const logger = createFeatureLogger("imageDataTransfer");

export class SqlUtil {
  private readonly trxnMap: Record<string, string> = {
    IC: "IC",
    NCT: "NCT",
    RED: "RED",
    FUL: "RED",
    IOBI: "IOBI",
    IOBIS: "IOBIS",
    SWOP: "SWP",
    SWOF: "SWP",
  };

  public async getPool(): Promise<Pool> {
    return await getPgPool();
  }
  public async warmup() {
    await warmupPgPool();
  }
  public async reconnectPool(): Promise<void> {
    await reconnectPgPool();
  }

  private getFileExtension(filePath: string): string {
    return filePath ? path.extname(filePath).toLowerCase() : "";
  }

  private async countCsvRows(filePath: string): Promise<number> {
    let lines = 0;
    try {
      const stream = fsSync.createReadStream(filePath);
      return new Promise((resolve) => {
        stream.on("data", (chunk) => {
          for (let i = 0; i < chunk.length; ++i) if (chunk[i] === 10) lines++;
        });
        stream.on("end", () => resolve(lines - 1));
      });
    } catch {
      return 0;
    }
  }

  private async getProcessedFolioNumbers(): Promise<string[]> {
    const csvPath = path.join(__dirname, "../../../../processed");
    try {
      const files = await fs.readdir(csvPath);
      const latestCsv = files
        .filter((f) => f.startsWith("processed_") && f.endsWith(".csv"))
        .sort()
        .pop();
      if (!latestCsv) return [];

      const csvFullPath = path.join(csvPath, latestCsv);
      const workbook = new ExcelJS.Workbook();
      const worksheet = await workbook.csv.readFile(csvFullPath);
      const idAcnos: string[] = [];
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const idAcno = row.getCell(5).text?.trim();
        if (idAcno) idAcnos.push(idAcno);
      });
      return [...new Set(idAcnos)];
    } catch (error) {
      logger.error("Error reading processed folio numbers", {
        error,
        console: true,
      });
      return [];
    }
  }

  private async generateSql(): Promise<{
    transactions: any[];
    logs: SqlLog[];
  }> {
    try {
      logger.info("Generating SQL transactions from CSV...", { console: true });
      const csvPath = path.join(__dirname, "../../../../processed");
      const files = await fs.readdir(csvPath);
      const latestCsv = files
        .filter((f) => f.startsWith("processed_"))
        .sort()
        .pop();

      if (!latestCsv) {
        logger.warn("No processed CSV found.");
        return { transactions: [], logs: [] };
      }

      logger.info(`Reading CSV: ${latestCsv}`, { console: true });
      const transactions: any[] = [];
      await new Promise<void>((resolve, reject) => {
        fsSync
          .createReadStream(path.join(csvPath, latestCsv))
          .pipe(parse({ delimiter: ",", from_line: 2 }))
          .on("data", (row) => {
            transactions.push({
              id_fund: parseInt(row[0], 10),
              id_trtype: row[1].trim(),
              id_ihno: parseInt(row[2], 10),
              id_path: row[3].trim(),
              id_acno: row[4].trim(),
              page_count: isNaN(parseInt(row[5], 10))
                ? row[5].trim()
                : parseInt(row[5], 10),
            });
          })
          .on("end", resolve)
          .on("error", reject);
      });
      return { transactions, logs: [] };
    } catch (e) {
      logger.error("Failed to generate SQL", { error: e, console: true });
      return { transactions: [], logs: [] };
    }
  }

  async executeSql(onProgress: (p: ImageDataProgress) => void): Promise<void> {
    let client: PoolClient | null = null;
    try {
      onProgress({
        type: "sqlProgressUpdate",
        subTask: "executeSql",
        total: 0,
        processed: 0,
        status: "Running",
        message: "Preparing Data...",
      });

      const { transactions } = await this.generateSql();
      const total = transactions.length;

      if (total === 0) {
        onProgress({
          type: "sqlProgressUpdate",
          subTask: "executeSql",
          total: 0,
          processed: 0,
          status: "Error",
          message: "No data found",
        });
        return;
      }

      onProgress({
        type: "sqlProgressUpdate",
        subTask: "executeSql",
        total,
        processed: 0,
        status: "Running",
        message: "Connecting to Database...",
      });

      client = await (await this.getPool()).connect();
      await pgBegin(client);

      const trxnNameMap: Record<string, string> = {
        NEW: "Initial Contribution Form",
        IC: "Initial Contribution Form",
        NCT: "Non Commercial Transactions Form",
        RED: "Redemption Form",
        FUL: "Redemption Form",
        IPO: "IPO Form",
        SIN: "SIP Form",
        SWOP: "SWP Form",
        SWOF: "SWP Form",
      };

      const mimeType: Record<string, string> = {
        tif: "image/tiff",
        pdf: "application/pdf",
        tiff: "image/tiff",
      };

      const uniqueFunds = [
        ...new Set(transactions.map((t) => String(t.id_fund))),
      ];
      const clientRes = (await pgQuery(
        client,
        SQL_SELECT_CLIENT_MASTER_BY_CODES,
        [uniqueFunds]
      )) as any;
      const clientIdMap = new Map();
      clientRes.rows.forEach((r: any) => clientIdMap.set(r.client_code, r.id));

      let insertedRows = 0;
      let skippedRows = 0;

      for (let i = 0; i < total; i += 500) {
        const chunk = transactions.slice(i, i + 500);
        const vParams: any[] = [];
        const vStrings: string[] = [];
        let pIdx = 1;

        for (const data of chunk) {
          if (typeof data.page_count !== "number") {
            skippedRows++;
            continue;
          }

          const actualId = clientIdMap.get(String(data.id_fund));
          if (actualId === undefined) continue;

          const ext = this.getFileExtension(data.id_path);
          const cleanExt = ext.replace(".", "");

          const process = this.trxnMap[data.id_trtype] || "Unknown";
          const activity = "Image Upload";
          const docType = trxnNameMap[data.id_trtype] || "Unknown";
          const format = cleanExt.toUpperCase();
          const mime =
            mimeType[cleanExt.toLowerCase()] || "application/octet-stream";

          const basePath = `aif-in-a-box-assets-prod: Data/APPLICATION_FORMS/CLIENT_CODE_${data.id_fund}/`;
          const docPath = `${basePath}CLIENT_CODE_${data.id_fund}_TRANSACTION_NUMBER_${data.id_ihno}/CLIENT_CODE_${data.id_fund}_TRANSACTION_NUMBER_${data.id_ihno}${ext}`;

          const rowValues = [
            process,
            activity,
            docType,
            format,
            docPath,
            null,
            data.id_ihno.toString(),
            "A",
            mime,
            null,
            data.id_ihno.toString(),
            data.id_acno,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            false,
            new Date(),
            "system",
            new Date(),
            "system",
            data.page_count,
            actualId,
          ];
          vStrings.push(`(${rowValues.map(() => `$${pIdx++}`).join(", ")})`);
          vParams.push(...rowValues);
        }

        if (vStrings.length > 0) {
          const res = (await pgQuery(
            client,
            SQL_INSERT_AIF_DOCUMENT_DETAILS.replace(
              "%VALUES%",
              vStrings.join(", ")
            ),
            vParams
          )) as any;
          insertedRows += res.rowCount || 0;
        }

        const currentCount = i + chunk.length;
        onProgress({
          type: "sqlProgressUpdate",
          subTask: "executeSql",
          total,
          processed: currentCount,
          status: "Running",
          metrics: { inserted: insertedRows },
        });
      }

      await pgCommit(client);

      if (skippedRows > 0) {
        logger.warn(
          `Skipped ${skippedRows} rows due to non-numeric page counts.`,
          { console: true }
        );
      }

      onProgress({
        type: "sqlProgressUpdate",
        subTask: "executeSql",
        total,
        processed: total,
        status: "Completed",
        metrics: { inserted: insertedRows },
      });
    } catch (err: any) {
      if (client) await pgRollback(client);
      logger.error("Execute SQL Failed", { error: err.message, console: true });
      onProgress({
        type: "sqlProgressUpdate",
        subTask: "executeSql",
        total: 0,
        processed: 0,
        status: "Error",
        message: err.message,
      });
    } finally {
      if (client) client.release();
    }
  }

  // 1. SPECIFIC Update (CSV Based) - [CORRECT FLOW]
  // ... (Imports - ensure new queries are imported)

    // 1. SPECIFIC Update (CSV Based) - [ROBUST LOGGING]
    async updateFolioAndTransaction(
      onProgress: (p: ImageDataProgress) => void
    ): Promise<void> {
      onProgress({
        type: "sqlProgressUpdate",
        subTask: "updateFolio",
        total: 0,
        processed: 0,
        status: "Running",
        message: "Step 1: Reading CSV...",
      });

      let transactions: any[] = [];
      const generated = await this.generateSql();
      transactions = generated.transactions.filter(
        (t: any) => typeof t.page_count === "number"
      );
      const total = transactions.length;

      if (total === 0) {
        const msg = "FAILED: No valid numeric data found in processed CSV";
        logger.error(msg, { console: true });
        onProgress({
          type: "sqlProgressUpdate",
          subTask: "updateFolio",
          total: 0,
          processed: 0,
          status: "Error",
          message: msg,
        });
        return;
      }

      let client: PoolClient | null = null;

      try {
        logger.info(`Starting Update Process. CSV contains ${total} rows.`, {
          console: true,
        });
        client = await (await this.getPool()).connect();
        await pgBegin(client);

        // --- STEP 1: STAGE CSV KEYS ---
        logger.info("Creating temporary staging table...", { console: true });
        await pgQuery(client, SQL_CREATE_TEMP_TRANSACTION_DATA);

        logger.info(`Staging ${total} keys into temp_transaction_data...`, { console: true });
        for (let i = 0; i < total; i += 1000) {
          const chunk = transactions.slice(i, i + 1000);
          const vStrs = chunk.map(
            (_, idx) => `($${idx * 2 + 1}, $${idx * 2 + 2})`
          );
          const vParams = chunk.flatMap((tx: any) => [
            tx.id_ihno.toString(),
            tx.id_acno,
          ]);

          await pgQuery(
            client,
            SQL_INSERT_TEMP_TRANSACTION_DATA.replace(
              "%VALUES%",
              vStrs.join(", ")
            ),
            vParams
          );

          onProgress({
            type: "sqlProgressUpdate",
            subTask: "updateFolio",
            total: total,
            processed: i + chunk.length,
            status: "Running",
            message: `Staging Keys: ${i + chunk.length} / ${total}`,
          });
        }

        // --- STEP 2: RESOLVE DATA (The Critical Check) ---
        logger.info("Clearing previous temp_images_1 data...", { console: true });
        await pgQuery(client, SQL_DELETE_TEMP_IMAGES_1);

        logger.info("Resolving: Matching CSV Keys against Database Tables...", { console: true });
        const insertRes = await pgQuery(client, SQL_INSERT_TEMP_IMAGES_FROM_CSV_KEYS);
        const validRowsCount = insertRes.rowCount || 0;

        // [CRITICAL LOGGING]
        if (validRowsCount === 0) {
          const warnMsg = "CRITICAL WARNING: 0 CSV rows matched the Database! Update will do nothing. Check Folio/IHNO formats.";
          logger.warn(warnMsg, { console: true });

          // We don't throw error, we let it complete (updating 0 rows) but warn the user
          onProgress({
            type: "sqlProgressUpdate",
            subTask: "updateFolio",
            total: total,
            processed: total,
            status: "Warning",
            message: "0 Matches Found in DB. Check Logs.",
          });
        } else {
          logger.info(`SUCCESS: Resolved ${validRowsCount} valid rows ready for update.`, { console: true });
        }

        logger.info("Analyzing temp_images_1 for query optimization...", { console: true });
        await pgQuery(client, "ANALYZE temp_images_1;");

        onProgress({
          type: "sqlProgressUpdate",
          subTask: "updateFolio",
          total: total,
          processed: total,
          status: "Running",
          message: `Executing Updates on ${validRowsCount} matched rows...`,
        });

        // --- STEP 3: EXECUTE UPDATES ---
        const resF = (await pgQuery(client, SQL_UPDATE_FOLIO_ID)) as any;
        logger.info(`Folio Update Query Executed. Affected: ${resF.rowCount}`, { console: true });

        const resT = (await pgQuery(client, SQL_UPDATE_TRANSACTION_REFERENCE_ID)) as any;
        logger.info(`Transaction Update Query Executed. Affected: ${resT.rowCount}`, { console: true });

        await pgCommit(client);

        const folioCount = resF.rowCount || 0;
        const txnCount = resT.rowCount || 0;
        const totalUpdated = folioCount + txnCount;

        logger.info(`Update Complete. Total Affected Rows: ${totalUpdated}`, { console: true });

        onProgress({
          type: "sqlProgressUpdate",
          subTask: "updateFolio",
          total: total,
          processed: total,
          status: "Completed",
          metrics: {
            updated: totalUpdated,
            folioUpdated: folioCount,
            txnUpdated: txnCount,
          },
        });
      } catch (err: any) {
        if (client) await pgRollback(client);
        logger.error("Update Folio/Transaction Failed", {
          error: err.message,
          console: true,
        });
        onProgress({
          type: "sqlProgressUpdate",
          subTask: "updateFolio",
          total: total,
          processed: 0,
          status: "Error",
          message: err.message,
        });
      } finally {
        if (client) client.release();
      }
    }

  // 2. GLOBAL Update (Update All)
  async updateAllFolioAndTransaction(
    onProgress: (p: ImageDataProgress) => void
  ): Promise<void> {
    onProgress({
      type: "sqlProgressUpdate",
      subTask: "updateFolio",
      total: 0,
      processed: 0,
      status: "Running",
      message: "Starting Global Update...",
    });

    let client: PoolClient | null = null;
    try {
      client = await (await this.getPool()).connect();
      await pgBegin(client);

      logger.info("Executing Global Update Step 1: Cleanup Temp Images", {
        console: true,
      });
      await pgQuery(client, SQL_DELETE_TEMP_IMAGES_1);

      onProgress({
        type: "sqlProgressUpdate",
        subTask: "updateFolio",
        total: 3,
        processed: 1,
        status: "Running",
        message: "Step 1: Populating Temp Images...",
      });

      logger.info("Executing Global Update Step 2: Insert All Temp Images", {
        console: true,
      });
      await pgQuery(client, SQL_INSERT_ALL_TEMP_IMAGES);

      // Optimize for massive global updates
      await pgQuery(client, "ANALYZE temp_images_1;");

      onProgress({
        type: "sqlProgressUpdate",
        subTask: "updateFolio",
        total: 3,
        processed: 2,
        status: "Running",
        message: "Step 2: Updating Transaction References...",
      });

      logger.info(
        "Executing Global Update Step 3: Update Transaction Refs (Global)",
        { console: true }
      );
      const resT = (await pgQuery(client, SQL_UPDATE_ALL_TRXN_REF)) as any;

      onProgress({
        type: "sqlProgressUpdate",
        subTask: "updateFolio",
        total: 3,
        processed: 3,
        status: "Running",
        message: "Step 3: Updating Folio IDs...",
      });

      logger.info("Executing Global Update Step 4: Update Folio IDs (Global)", {
        console: true,
      });
      const resF = (await pgQuery(client, SQL_UPDATE_ALL_FOLIO_ID)) as any;

      await pgCommit(client);

      const txnCount = resT.rowCount || 0;
      const folioCount = resF.rowCount || 0;

      onProgress({
        type: "sqlProgressUpdate",
        subTask: "updateFolio",
        total: 3,
        processed: 3,
        status: "Completed",
        metrics: {
          updated: txnCount + folioCount,
          txnUpdated: txnCount,
          folioUpdated: folioCount,
        },
      });
      logger.info(
        `Global Update Completed. Txns: ${txnCount}, Folios: ${folioCount}`,
        { console: true }
      );
    } catch (err: any) {
      if (client) await pgRollback(client);
      logger.error("Global Update Failed", { error: err, console: true });
      onProgress({
        type: "sqlProgressUpdate",
        subTask: "updateFolio",
        total: 0,
        processed: 0,
        status: "Error",
        message: err.message,
      });
    } finally {
      if (client) client.release();
    }
  }

  public async getClientIdByCode(
    clientCode: string
  ): Promise<{ id: number } | undefined> {
    let client = await (await this.getPool()).connect();
    try {
      const res = await pgQuery(client, SQL_SELECT_CLIENT_ID_BY_CODE, [
        clientCode,
      ]);
      return res.rows[0] as { id: number };
    } finally {
      client.release();
    }
  }

  public async getAifDocumentDetails(
    clientId?: number,
    requireCsv: boolean = true
  ): Promise<AifDocumentDetail[]> {
    let client = await (await this.getPool()).connect();
    try {
      // MODE 1: DIRECT INSERT (By Client ID)
      if (!requireCsv) {
        if (!clientId) {
          throw new Error("Safety Error: Client Code is MANDATORY for Direct Insert mode.");
        }
        logger.info(`Executing Direct Query for Client ID: ${clientId}`, { console: true });
        const res = await pgQuery(client, SQL_SELECT_AIF_DOCUMENT_DETAILS_BY_CLIENT, [clientId]);
        return res.rows as AifDocumentDetail[];
      }

      // MODE 2: CSV FILTERED INSERT (Default)
      const folioNumbers = await this.getProcessedFolioNumbers();
      if (folioNumbers.length === 0) return [];

      const queryParams: unknown[] = [folioNumbers];
      let clientIdClause = clientId
        ? ` AND add.client_id = $${queryParams.length + 1}`
        : "";
      if (clientId) queryParams.push(clientId);

      const res = await pgQuery(
        client,
        SQL_SELECT_AIF_DOCUMENT_DETAILS.replace(
          "%CLIENT_ID_CLAUSE%",
          clientIdClause
        ),
        queryParams
      );
      return res.rows as AifDocumentDetail[];
    } finally {
      client.release();
    }
  }

  public async streamUpdateDetails(
    batchSize: number,
    processBatch: (batch: AifDocumentDetail[]) => Promise<void>,
    clientId?: number
  ): Promise<void> {
    let client = await (await this.getPool()).connect();
    try {
      const queryParams: unknown[] = [];
      const query = SQL_STREAM_UPDATE_DETAILS.replace(
        "%CLIENT_ID_CLAUSE%",
        clientId ? ` AND add.client_id = $1` : ""
      );
      if (clientId) queryParams.push(clientId);

      const cursor = client.query(new Cursor(query, queryParams));
      let rows: unknown[];
      do {
        rows = await new Promise((res, rej) =>
          cursor.read(batchSize, (err, r) => (err ? rej(err) : res(r)))
        );
        if (rows.length > 0) await processBatch(rows as AifDocumentDetail[]);
      } while (rows.length > 0);
    } finally {
      client.release();
    }
  }
}
