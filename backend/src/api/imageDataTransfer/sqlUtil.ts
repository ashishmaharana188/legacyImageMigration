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
import { SqlLog, AifDocumentDetail } from "./imageDataTransferTypes";
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

  // [FIX] Changed to public so Wrapper can access it for the "Reconnect" button
  public async reconnectPool(): Promise<void> {
    await reconnectPgPool();
  }

  private getFileExtension(filePath: string): string {
    return filePath ? path.extname(filePath).toLowerCase() : "";
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
      logger.error("Error reading processed folio numbers", { error });
      return [];
    }
  }

  async generateSql(): Promise<{
    sql: string;
    transactions: any[];
    logs: SqlLog[];
  }> {
    const logs: SqlLog[] = [];
    try {
      logger.info("Generating SQL transactions from CSV...");
      const csvPath = path.join(__dirname, "../../../../processed");
      const files = await fs.readdir(csvPath);
      const latestCsv = files
        .filter((f) => f.startsWith("processed_"))
        .sort()
        .pop();

      if (!latestCsv) {
        logger.warn("No processed CSV found for SQL generation.");
        return {
          sql: "",
          transactions: [],
          logs: [{ row: 0, status: "error", message: "No CSV found" }],
        };
      }

      logger.info(`Reading CSV: ${latestCsv}`);
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

      logger.info(`Generated ${transactions.length} transactions from CSV.`);
      return { sql: "GENERATED", transactions, logs };
    } catch (e) {
      logger.error("Failed to generate SQL", { error: e });
      return { sql: "", transactions: [], logs: [] };
    }
  }

  async executeSql(): Promise<any> {
    const logs: SqlLog[] = [];
    let client: PoolClient | null = null;
    try {
      logger.info("Starting executeSql process...", { console: true });

      const { transactions, logs: gLogs } = await this.generateSql();
      logs.push(...gLogs);

      if (!transactions.length) {
        logger.warn("No transactions to execute.");
        return { result: "failed", logs, summary: { insertedRows: 0 } };
      }

      client = await (await this.getPool()).connect();
      await pgBegin(client);

      const uniqueFunds = [
        ...new Set(transactions.map((t) => String(t.id_fund))),
      ];

      logger.info("Fetching client master codes...");
      const clientIdMap = new Map();
      const clientRes = (await pgQuery(
        client,
        SQL_SELECT_CLIENT_MASTER_BY_CODES,
        [uniqueFunds]
      )) as any;
      clientRes.rows.forEach((r: any) => clientIdMap.set(r.client_code, r.id));

      let insertedRows = 0;
      const totalBatches = Math.ceil(transactions.length / 500);

      for (let i = 0; i < transactions.length; i += 500) {
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

        const res = (await pgQuery(
          client,
          SQL_INSERT_AIF_DOCUMENT_DETAILS.replace(
            "%VALUES%",
            vStrings.join(", ")
          ),
          vParams
        )) as any;
        insertedRows += res.rowCount || res.rows?.length || 0;

        const currentBatch = Math.ceil(i / 500) + 1;
        if (currentBatch % 5 === 0) {
          logger.info(
            `Running... Batch ${currentBatch}/${totalBatches} inserted`,
            { console: true }
          );
        }
      }

      await pgCommit(client);
      logger.info(`SQL Execution Success. Total Inserted: ${insertedRows}`);

      return {
        result: "success",
        logs,
        summary: { insertedRows, errorRows: 0, badRows: [] },
      };
    } catch (err) {
      if (client) await pgRollback(client);
      logger.error("Execute SQL Failed", { error: err });
      return { result: "failed", logs };
    } finally {
      if (client) client.release();
    }
  }

  async updateFolioAndTransaction(
    updateAll: boolean,
    providedTx?: any[],
    initialLogs: SqlLog[] = []
  ): Promise<any> {
    let logs = [...initialLogs];
    let transactions = providedTx;

    logger.info(
      `Starting Update Folio & Transaction. UpdateAll: ${updateAll}`,
      { console: true }
    );

    if (!transactions || transactions.length === 0) {
      logger.info("No transactions provided, generating from CSV...");
      const generated = await this.generateSql();
      transactions = generated.transactions;
    }

    if (!transactions || transactions.length === 0) {
      logger.warn("No transactions found to update.");
      return { result: "failed", summary: { updatedFolioRows: 0 } };
    }

    const processedFolioNumbers = [
      ...new Set(transactions.map((tx: any) => tx.id_acno)),
    ];
    let client: PoolClient | null = null;
    try {
      client = await (await this.getPool()).connect();
      await pgBegin(client);

      logger.info("Creating temporary transaction data table...");
      await pgQuery(client, SQL_CREATE_TEMP_TRANSACTION_DATA);

      logger.info(`Inserting ${transactions.length} rows into temp table...`);
      for (let i = 0; i < transactions.length; i += 1000) {
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
      }

      logger.info("Updating Temp Images...");
      await pgQuery(client, SQL_DELETE_TEMP_IMAGES_1);
      await pgQuery(
        client,
        SQL_INSERT_TEMP_IMAGES_1.replace(
          "%WHERE_CLAUSE%",
          updateAll ? "TRUE" : "fo.folio_number = ANY($1::text[])"
        ),
        updateAll ? [] : [processedFolioNumbers]
      );

      logger.info("Executing Folio Update Query...");
      const resF = (await pgQuery(
        client,
        SQL_UPDATE_FOLIO_ID.replace(
          "%WHERE_CLAUSE%",
          updateAll ? "" : "AND d.user_attr2 = ANY($1::text[])"
        ),
        updateAll ? [] : [processedFolioNumbers]
      )) as any;

      logger.info("Executing Transaction Reference Update Query...");
      const resT = (await pgQuery(
        client,
        SQL_UPDATE_TRANSACTION_REFERENCE_ID.replace(
          "%WHERE_CLAUSE%",
          updateAll ? "" : "AND d.user_attr2 = ANY($1::text[])"
        ),
        updateAll ? [] : [processedFolioNumbers]
      )) as any;

      await pgCommit(client);

      const summary = {
        updatedFolioRows: resF.rowCount || resF.rows?.length || 0,
        updatedTransactionRows: resT.rowCount || resT.rows?.length || 0,
      };

      logger.info(
        `Update Success. Folios: ${summary.updatedFolioRows}, Transactions: ${summary.updatedTransactionRows}`
      );

      return {
        result: "success",
        logs,
        summary,
      };
    } catch (err) {
      if (client) await pgRollback(client);
      logger.error("Update Folio/Transaction Failed", { error: err });
      return { result: "failed" };
    } finally {
      if (client) client.release();
    }
  }

  public async getClientIdByCode(
    clientCode: string
  ): Promise<{ id: number } | undefined> {
    let client: PoolClient | null = null;
    try {
      client = await (await this.getPool()).connect();
      const res = await pgQuery(client, SQL_SELECT_CLIENT_ID_BY_CODE, [
        clientCode,
      ]);
      return res.rows[0] as { id: number };
    } catch (error) {
      logger.error(`Error fetching client ID for code ${clientCode}`, {
        error,
      });
      throw error;
    } finally {
      if (client) client.release();
    }
  }

  public async getAifDocumentDetails(
    clientId?: number
  ): Promise<AifDocumentDetail[]> {
    let client: PoolClient | null = null;
    try {
      const folioNumbers = await this.getProcessedFolioNumbers();
      if (folioNumbers.length === 0) return [];

      client = await (await this.getPool()).connect();
      const queryParams: unknown[] = [folioNumbers];
      let clientIdClause = "";

      if (clientId) {
        clientIdClause = ` AND add.client_id = $${queryParams.length + 1}`;
        queryParams.push(clientId);
      }

      const query = SQL_SELECT_AIF_DOCUMENT_DETAILS.replace(
        "%CLIENT_ID_CLAUSE%",
        clientIdClause
      );
      const res = await pgQuery(client, query, queryParams);
      return res.rows as AifDocumentDetail[];
    } catch (error) {
      logger.error("Error fetching AIF Document Details", { error });
      throw error;
    } finally {
      if (client) client.release();
    }
  }

  public async streamUpdateDetails(
    batchSize: number,
    processBatch: (batch: AifDocumentDetail[]) => Promise<void>,
    clientId?: number
  ): Promise<void> {
    let client: PoolClient | null = null;
    try {
      logger.info("Starting SQL stream for updates...");
      client = await (await this.getPool()).connect();
      const queryParams: unknown[] = [];
      const query = SQL_STREAM_UPDATE_DETAILS.replace(
        "%CLIENT_ID_CLAUSE%",
        clientId ? ` AND add.client_id = $1` : ""
      );
      if (clientId) queryParams.push(clientId);

      const cursor = client.query(new Cursor(query, queryParams));
      let rows: unknown[];
      let batchCount = 0;

      do {
        rows = await new Promise((res, rej) =>
          cursor.read(batchSize, (err, r) => (err ? rej(err) : res(r)))
        );
        if (rows.length > 0) {
          batchCount++;
          await processBatch(rows as AifDocumentDetail[]);
          if (batchCount % 10 === 0) {
            logger.info(`Streaming... Processed ${batchCount} batches`, {
              console: true,
            });
          }
        }
      } while (rows.length > 0);

      logger.info("SQL Stream completed.");
    } catch (error) {
      logger.error("Error in streamUpdateDetails", { error });
      throw error;
    } finally {
      if (client) client.release();
    }
  }
}
