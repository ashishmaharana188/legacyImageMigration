// backend/src/api/imageDataTransfer/sqlUtil.ts

import { parse } from "csv-parse";
import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import ExcelJS from "exceljs";
import { Pool, PoolClient } from "pg";
import logger from "../../utils/logger";
import {
  getPgPool,
  reconnectPgPool,
  warmupPgPool,
} from "../../utils/dbConnect";
import Cursor from "pg-cursor";
import {
  SqlLog,
  AifDocumentDetail,
  IPgQueryResult,
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
  SQL_SELECT_UPDATE_DETAILS,
  SQL_STREAM_UPDATE_DETAILS,
} from "./imageDataTransferCore";

export class SqlUtil {
  private readonly logger = logger;
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

  private async reconnectPool(): Promise<void> {
    await reconnectPgPool();
  }

  private getFileExtension(filePath: string): string {
    return filePath ? path.extname(filePath).toLowerCase() : "";
  }

  private formatQuery(query: string, params: unknown[]): string {
    let formattedQuery = query;
    params.forEach((param, index) => {
      const replacement =
        typeof param === "string" ? `"${param}"` : String(param);
      formattedQuery = formattedQuery.replace(`$${index + 1}`, replacement);
    });
    return formattedQuery;
  }

  /**
   * Helper to get processed folio numbers from the latest CSV
   */
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
      return [];
    }
  }

  /**
   * Generates SQL transactions based on the CSV source of truth
   */
  async generateSql(): Promise<{
    sql: string;
    transactions: any[];
    logs: SqlLog[];
  }> {
    const logs: SqlLog[] = [];
    try {
      const csvPath = path.join(__dirname, "../../../../processed");
      const files = await fs.readdir(csvPath);
      const latestCsv = files
        .filter((f) => f.startsWith("processed_"))
        .sort()
        .pop();
      if (!latestCsv)
        return {
          sql: "",
          transactions: [],
          logs: [{ row: 0, status: "error", message: "No CSV found" }],
        };

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
      return { sql: "GENERATED", transactions, logs };
    } catch (e) {
      return { sql: "", transactions: [], logs: [] };
    }
  }

  /**
   * Executes the SQL insertions into PostgreSQL
   */
  async executeSql(): Promise<any> {
    const logs: SqlLog[] = [];
    let client: PoolClient | null = null;
    try {
      const { transactions, logs: gLogs } = await this.generateSql();
      logs.push(...gLogs);
      if (!transactions.length)
        return { result: "failed", logs, summary: { insertedRows: 0 } };

      client = await (await this.getPool()).connect();
      await pgBegin(client);

      const uniqueFunds = [
        ...new Set(transactions.map((t) => String(t.id_fund))),
      ];
      const clientIdMap = new Map();
      const clientRes = (await pgQuery(
        client,
        SQL_SELECT_CLIENT_MASTER_BY_CODES,
        [uniqueFunds]
      )) as any;
      clientRes.rows.forEach((r: any) => clientIdMap.set(r.client_code, r.id));

      let insertedRows = 0;
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
      }
      await pgCommit(client);
      return {
        result: "success",
        logs,
        summary: { insertedRows, errorRows: 0, badRows: [] },
      };
    } catch (err) {
      if (client) await pgRollback(client);
      return { result: "failed", logs };
    } finally {
      if (client) client.release();
    }
  }

  /**
   * Updates folio and transaction IDs based on the CSV source
   */
  async updateFolioAndTransaction(
    updateAll: boolean,
    providedTx?: any[],
    initialLogs: SqlLog[] = []
  ): Promise<any> {
    let logs = [...initialLogs];
    let transactions = providedTx;

    if (!transactions || transactions.length === 0) {
      const generated = await this.generateSql();
      transactions = generated.transactions;
    }

    if (!transactions || transactions.length === 0)
      return { result: "failed", summary: { updatedFolioRows: 0 } };

    const processedFolioNumbers = [
      ...new Set(transactions.map((tx: any) => tx.id_acno)),
    ];
    let client: PoolClient | null = null;
    try {
      client = await (await this.getPool()).connect();
      await pgBegin(client);
      await pgQuery(client, SQL_CREATE_TEMP_TRANSACTION_DATA);

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

      await pgQuery(client, SQL_DELETE_TEMP_IMAGES_1);
      await pgQuery(
        client,
        SQL_INSERT_TEMP_IMAGES_1.replace(
          "%WHERE_CLAUSE%",
          updateAll ? "TRUE" : "fo.folio_number = ANY($1::text[])"
        ),
        updateAll ? [] : [processedFolioNumbers]
      );

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
      return {
        result: "success",
        logs,
        summary: {
          updatedFolioRows: resF.rowCount || resF.rows?.length || 0,
          updatedTransactionRows: resT.rowCount || resT.rows?.length || 0,
        },
      };
    } catch (err) {
      if (client) await pgRollback(client);
      return { result: "failed" };
    } finally {
      if (client) client.release();
    }
  }

  // --- MISSING METHODS FOR MONGO UTIL BRIDGE ---

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
      client = await (await this.getPool()).connect();
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
    } catch (error) {
      throw error;
    } finally {
      if (client) client.release();
    }
  }
}
