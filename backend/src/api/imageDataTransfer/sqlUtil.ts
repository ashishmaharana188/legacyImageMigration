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
  SQL_CREATE_TEMP_TRANSACTION_DATA,
  SQL_INSERT_TEMP_TRANSACTION_DATA,
  SQL_DELETE_TEMP_IMAGES_1,
  SQL_INSERT_TEMP_IMAGES_1,
  SQL_UPDATE_FOLIO_ID,
  SQL_UPDATE_TRANSACTION_REFERENCE_ID,
  SQL_SELECT_CLIENT_ID_BY_CODE,
  SQL_SELECT_AIF_DOCUMENT_DETAILS,
  SQL_STREAM_UPDATE_DETAILS,
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

  async generateSql(): Promise<{ transactions: any[]; logs: SqlLog[] }> {
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
      logger.info(`Connecting to DB to insert ${total} rows...`, {
        console: true,
      });

      client = await (await this.getPool()).connect();
      await pgBegin(client);

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
      for (let i = 0; i < total; i += 500) {
        const chunk = transactions.slice(i, i + 500);
        const vParams: any[] = [];
        const vStrings: string[] = [];
        let pIdx = 1;

        for (const data of chunk) {
          const actualId = clientIdMap.get(String(data.id_fund));
          if (actualId === undefined) continue;
          const ext = this.getFileExtension(data.id_path);
          const rowValues = [
            this.trxnMap[data.id_trtype] || "Unknown",
            "Image Upload",
            "Form",
            ext.replace(".", "").toUpperCase(),
            "path",
            null,
            data.id_ihno.toString(),
            "A",
            "mime",
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

        if (currentCount % 5000 === 0) {
          logger.info(`Inserted ${currentCount}/${total} rows...`, {
            console: true,
          });
        }
      }

      logger.info("Committing Transaction...", { console: true });
      await pgCommit(client);

      onProgress({
        type: "sqlProgressUpdate",
        subTask: "executeSql",
        total,
        processed: total,
        status: "Completed",
        metrics: { inserted: insertedRows },
      });
      logger.info("SQL Execution Completed Successfully.", { console: true });
    } catch (err: any) {
      if (client) await pgRollback(client);
      logger.error("Execute SQL Failed", { error: err, console: true });
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

  async updateFolioAndTransaction(
    updateAll: boolean,
    onProgress: (p: ImageDataProgress) => void
  ): Promise<void> {
    // [FIX] Initial Log
    onProgress({
      type: "sqlProgressUpdate",
      subTask: "updateFolio",
      total: 0,
      processed: 0,
      status: "Running",
      message: "Reading CSV Data...",
    });

    let transactions: any[] = [];
    const generated = await this.generateSql();
    transactions = generated.transactions;
    // [FIX] Total is strictly CSV rows
    const total = transactions.length;

    if (total === 0) {
      onProgress({
        type: "sqlProgressUpdate",
        subTask: "updateFolio",
        total: 0,
        processed: 0,
        status: "Error",
        message: "No data found in processed CSV",
      });
      return;
    }

    const processedFolioNumbers = [
      ...new Set(transactions.map((tx: any) => tx.id_acno)),
    ];
    let client: PoolClient | null = null;

    try {
      logger.info(`Starting Update Process for ${total} CSV rows...`, {
        console: true,
      });
      client = await (await this.getPool()).connect();
      await pgBegin(client);

      await pgQuery(client, SQL_CREATE_TEMP_TRANSACTION_DATA);

      logger.info(`Phase 1/2: Staging ${total} rows into temp table...`, {
        console: true,
      });

      // [FIX] Batch Temp Inserts
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

        // [FIX] Progress tracks Staging phase (0 to Total)
        onProgress({
          type: "sqlProgressUpdate",
          subTask: "updateFolio",
          total: total,
          processed: i + chunk.length,
          status: "Running",
          message: `Staging Data: ${i + chunk.length} / ${total}`,
        });
      }

      await pgQuery(client, SQL_DELETE_TEMP_IMAGES_1);
      await pgQuery(
        client,
        SQL_INSERT_TEMP_IMAGES_1.replace(
          "%WHERE_CLAUSE%",
          updateAll ? "TRUE" : "fo.folio_number = ANY($1::text[])"
        ),
        updateAll ? [] : [processedFolioNumbers]
      );

      // [FIX] Phase 2: Update (Progress stays at Total, Status changes)
      onProgress({
        type: "sqlProgressUpdate",
        subTask: "updateFolio",
        total: total,
        processed: total,
        status: "Running",
        message: "Phase 2/2: Executing Database Updates...",
      });
      logger.info("Executing Update Query...", { console: true });

      const resF = (await pgQuery(
        client,
        SQL_UPDATE_FOLIO_ID.replace(
          "%WHERE_CLAUSE%",
          updateAll ? "" : "AND d.user_attr2 = ANY($1::text[])"
        ),
        updateAll ? [] : [processedFolioNumbers]
      )) as any;

      const resT = (await pgQuery(
        client,
        SQL_UPDATE_TRANSACTION_REFERENCE_ID.replace(
          "%WHERE_CLAUSE%",
          updateAll ? "" : "AND d.user_attr2 = ANY($1::text[])"
        ),
        updateAll ? [] : [processedFolioNumbers]
      )) as any;

      await pgCommit(client);

      const folioCount = resF.rowCount || 0;
      const txnCount = resT.rowCount || 0;
      const totalUpdated = folioCount + txnCount;

      // [FIX] Return Granular Metrics
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
      logger.info(
        `Update Completed. Folios: ${folioCount}, Txns: ${txnCount}`,
        { console: true }
      );
    } catch (err: any) {
      if (client) await pgRollback(client);
      logger.error("Update Folio/Transaction Failed", {
        error: err,
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

  // --- Helpers for Mongo ---
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
    clientId?: number
  ): Promise<AifDocumentDetail[]> {
    const folioNumbers = await this.getProcessedFolioNumbers();
    if (folioNumbers.length === 0) return [];
    let client = await (await this.getPool()).connect();
    try {
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
