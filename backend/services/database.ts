// database.ts

import ExcelJS from "exceljs";
import fs from "fs/promises";
import path from "path";
import { Pool, PoolClient } from "pg";
import logger from "../utils/logger";
import { getPgPool, reconnectPgPool, warmupPgPool } from "../controllers/dbConnect";
import { SqlLog, SanityCheckRow, DryRunResultRow, ImperfectDuplicateRow } from "../types/database";

export class Database {
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

  constructor() {
    // Pool is now managed externally
  }

  private async reconnectPool(): Promise<void> {
    await reconnectPgPool();
  }

  public getPool(): Pool {
    return getPgPool();
  }

  public async warmup() {
    await warmupPgPool();
  }

  private readonly logger = logger;

  private getFileExtension(filePath: string): string {
    return filePath ? path.extname(filePath).toLowerCase() : "";
  }

  private async getProcessedFolioNumbers(): Promise<string[]> {
    const csvPath = path.join(__dirname, "../../processed");
    this.logger.info({
      function: "getProcessedFolioNumbers",
      message: "Reading processed directory",
    });
    try {
      const files = await fs.readdir(csvPath);
      this.logger.info({
        function: "getProcessedFolioNumbers",
        message: `Found ${files.length} files in processed directory`,
      });

      const latestCsv = files
        .filter((f) => f.startsWith("processed_") && f.endsWith(".csv"))
        .sort()
        .pop();

      if (!latestCsv) {
        this.logger.warn({
          function: "getProcessedFolioNumbers",
          message: "No processed_*.csv found",
        });
        return [];
      }

      const csvFullPath = path.join(csvPath, latestCsv);
      this.logger.info({
        function: "getProcessedFolioNumbers",
        message: `Reading CSV file: ${csvFullPath}`,
      });

      const workbook = new ExcelJS.Workbook();
      const worksheet = await workbook.csv.readFile(csvFullPath);
      this.logger.info({
        function: "getProcessedFolioNumbers",
        message: "CSV loaded into workbook",
      });

      const idAcnos: string[] = [];
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Skip header
        try {
          const idAcnoCell = row.getCell(5);
          if (idAcnoCell && idAcnoCell.text) {
            const idAcno = (idAcnoCell.text as string).trim();
            if (idAcno) {
              idAcnos.push(idAcno);
            }
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Unknown error";
          this.logger.warn({
            function: "getProcessedFolioNumbers",
            message: `Parse error at row ${rowNumber}`,
            error: msg,
          });
        }
      });

      const uniqueIdAcnos = [...new Set(idAcnos)];
      this.logger.info({
        function: "getProcessedFolioNumbers",
        message: `Found ${uniqueIdAcnos.length} unique id_acno values`,
      });
      return uniqueIdAcnos;
    } catch (error) {
      this.logger.error({
        function: "getProcessedFolioNumbers",
        message: "Error reading processed folder or CSV file",
        error: error instanceof Error ? error.message : String(error),
        originalError: error,
      });
      return []; // Return empty array on error to avoid breaking the main query
    }
  }

  async generateSql(): Promise<{
    sql: string;
    transactions: {
      id_fund: number;
      id_trtype: string;
      id_ihno: number;
      id_path: string;
      id_acno: string;
      page_count: number | string;
    }[];
    logs: SqlLog[];
  }> {
    const logs: SqlLog[] = [];

    try {
      const csvPath = path.join(__dirname, "../../processed");
      this.logger.info({
        function: "generateSql",
        message: "Reading processed directory",
      });
      const files = await fs.readdir(csvPath);
      this.logger.info({
        function: "generateSql",
        message: `Found ${files.length} files in processed directory`,
      });

      const latestCsv = files
        .filter((f) => f.startsWith("processed_") && f.endsWith(".csv"))
        .sort()
        .pop();

      if (!latestCsv) {
        this.logger.warn({
          function: "generateSql",
          message: "No processed_*.csv found",
        });
        logs.push({
          row: 0,
          status: "error",
          message: "No processed CSV found",
        });
        return { sql: "", transactions: [], logs };
      }

      const csvFullPath = path.join(csvPath, latestCsv);
      this.logger.info({
        function: "generateSql",
        message: "Reading CSV file",
      });

      const workbook = new ExcelJS.Workbook();
      const worksheet = await workbook.csv.readFile(csvFullPath);
      this.logger.info({
        function: "generateSql",
        message: "CSV loaded into workbook",
      });

      const transactions: {
        id_fund: number;
        id_trtype: string;
        id_ihno: number;
        id_path: string;
        id_acno: string;
        page_count: number | string;
      }[] = [];

      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        try {
          transactions.push({
            id_fund: parseInt(row.getCell(1).text, 10),
            id_trtype: row.getCell(2).text.trim(),
            id_ihno: parseInt(row.getCell(3).text, 10),
            id_path: row.getCell(4).text.trim(),
            id_acno: row.getCell(5).text.trim(),
            page_count: isNaN(parseInt(row.getCell(6).text, 10))
              ? row.getCell(6).text.trim()
              : parseInt(row.getCell(6).text, 10),
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Unknown error";
          this.logger.warn({
            function: "generateSql",
            message: `Parse error at row ${rowNumber}`,
            error: msg,
          });
          logs.push({
            row: rowNumber,
            status: "error",
            message: `Failed to parse row: ${msg}`,
          });
        }
      });

      this.logger.info({
        function: "generateSql",
        message: `Parsed ${transactions.length} transaction rows`,
      });

      const trxnNameMap: Record<string, string> = {
        NEW: "Initial Contribution Form",
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

      const values = transactions
        .map((data, index) => {
          try {
            const p = data.id_path;
            const ext = this.getFileExtension(p).replace(".", "");
            if (!ext) throw new Error("Invalid file extension");

            const format = ext.replace(".", "").toUpperCase();
            const clientId = data.id_fund;

            const basePath = `aif-in-a-box-assets-prod: Data/APPLICATION_FORMS/CLIENT_CODE_${data.id_fund}/`;
            const docPath = `${basePath}CLIENT_CODE_${data.id_fund}_TRANSACTION_NUMBER_${data.id_ihno}/CLIENT_CODE_${data.id_fund}_TRANSACTION_NUMBER_${data.id_ihno}${ext}`;

            const sql = `(
'${this.trxnMap[data.id_trtype] || "Unknown"}', 'Image Upload', '${
              trxnNameMap[data.id_trtype] || "Unknown"
            }', '${format}', '${docPath}',
null, '${data.id_ihno}', 'A', '${mimeType[ext] || "application/octet-stream"}',
null, '${data.id_ihno}', '${data.id_acno}', null, null,
null, null, null, null, null,
null, null, null, null, null,
false, now(), 'system', now(), 'system',
${data.page_count}, ${clientId}
)`;

            logs.push({
              row: index + 2,
              status: "success",
              message: "SQL generated for row",
              sql,
            });
            return sql;
          } catch (err) {
            const msg = err instanceof Error ? err.message : "Unknown error";
            this.logger.warn({
              function: "generateSql",
              message: `Failed generating SQL for row ${index + 2}`,
              error: msg,
            });
            logs.push({
              row: index + 2,
              status: "error",
              message: `Failed to generate SQL: ${msg}`,
            });
            return null;
          }
        })
        .filter((val): val is string => val !== null);

      if (values.length === 0) {
        this.logger.warn({
          function: "generateSql",
          message: "No valid rows to generate SQL",
        });
        logs.push({
          row: 0,
          status: "error",
          message: "No valid rows to generate SQL",
        });
        return { sql: "", transactions: [], logs };
      }

      const sql = `INSERT INTO investor.aif_document_details(
document_process, document_activity, document_type, document_format, document_path,
folio_id, transaction_reference_id, document_status, mime_type,
user_attr0, user_attr1, user_attr2, user_attr3, user_attr4,
user_attr5, user_attr6, user_attr7, user_attr8, user_attr9,
approval_status, approved_by, approved_on, comments, audit_code,
del_flag, last_update_tms, last_updated_by, creation_date, created_by,
page_count, client_id
) VALUES ${values.join(", ")};
`;

      this.logger.info({
        function: "generateSql",
        message: "Generated multi-row SQL",
      });
      return { sql, transactions, logs };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      this.logger.error({
        function: "generateSql",
        message: "Failed to generate SQL",
        error: msg,
        originalError: e,
      });
      logs.push({
        row: 0,
        status: "error",
        message: `generateSql failed: ${msg}`,
      });
      return { sql: "", transactions: [], logs };
    }
  }

  async executeSql(): Promise<{
    result: string;
    logs: SqlLog[];
    summary: {
      insertedRows: number;
      errorRows: number;
      badRows: any[];
      badRowsFilePath: string | null;
    };
  }> {
    const logs: SqlLog[] = [];
    let client: PoolClient | null = null;

    try {
      this.logger.info({
        function: "executeSql",
        message: "Generating SQL from CSV",
      });
      const { transactions, logs: generateLogs } = await this.generateSql();
      logs.push(...generateLogs);

      if (!transactions.length) {
        this.logger.error("executeSql: no transactions to execute");
        logs.push({
          row: 0,
          status: "error",
          message: "No transactions to execute",
        });
        return {
          result: "failed",
          logs,
          summary: {
            insertedRows: 0,
            errorRows: 0,
            badRows: [],
            badRowsFilePath: null,
          },
        };
      }

      this.logger.info("executeSql: attempting pool.connect()");
      client = await this.getPool().connect();
      this.logger.info("executeSql: pool.connect() successful");

      client.on("error", (err) => {
        this.logger.error(`executeSql: client error: ${err.message}`);
      });

      await client.query("BEGIN");
      this.logger.info("executeSql: BEGIN started");

      // --- Start of new logic for client_id lookup ---
      const uniqueIdFunds = [
        ...new Set(transactions.map((t) => String(t.id_fund))),
      ];
      this.logger.info(
        `executeSql: found ${uniqueIdFunds.length} unique id_fund values`
      );

      const clientIdMap: Map<string, number> = new Map();
      if (uniqueIdFunds.length > 0) {
        const clientMasterQuery = `SELECT id, client_code FROM fund.client_master WHERE client_code = ANY($1::text[])`;
        const clientMasterRes = await client.query(clientMasterQuery, [
          uniqueIdFunds,
        ]);
        clientMasterRes.rows.forEach((row) => {
          clientIdMap.set(row.client_code, row.id);
        });
        this.logger.info(
          `executeSql: fetched ${clientIdMap.size} client_id mappings`
        );
      }
      // --- End of new logic for client_id lookup ---

      const trxnNameMap: Record<string, string> = {
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

      let insertedRows = 0;
      const badRows: any[] = [];
      const chunkSize = 500; // Process 500 rows at a time

      for (let i = 0; i < transactions.length; i += chunkSize) {
        const chunk = transactions.slice(i, i + chunkSize);
        const valueParams: any[] = [];
        const valueStrings: string[] = [];
        let paramIndex = 1;

        for (const [indexInChunk, data] of chunk.entries()) {
          const originalIndex = i + indexInChunk;
          const ext = this.getFileExtension(data.id_path);
          if (!ext) {
            this.logger.warn(
              `executeSql: row ${originalIndex + 2} has invalid file extension`
            );
            logs.push({
              row: originalIndex + 2,
              status: "error",
              message: "Invalid file extension",
            });
            badRows.push({
              id_ihno: data.id_ihno,
              reason: "Invalid file extension",
            });
            continue;
          }

          const format = ext.replace(".", "").toUpperCase();
          const actualClientId = clientIdMap.get(String(data.id_fund));
          if (actualClientId === undefined) {
            this.logger.warn(
              `executeSql: client_id not found for id_fund: ${
                data.id_fund
              } at row ${originalIndex + 2}`
            );
            logs.push({
              row: originalIndex + 2,
              status: "error",
              message: `Client ID not found for id_fund: ${data.id_fund}`,
            });
            badRows.push({
              id_ihno: data.id_ihno,
              reason: `Client ID not found for id_fund: ${data.id_fund}`,
            });
            continue;
          }

          const basePath = `aif-in-a-box-assets-prod: Data/APPLICATION_FORMS/CLIENT_CODE_${data.id_fund}/`;
          const docPath = `${basePath}CLIENT_CODE_${data.id_fund}_TRANSACTION_NUMBER_${data.id_ihno}/CLIENT_CODE_${data.id_fund}_TRANSACTION_NUMBER_${data.id_ihno}${ext}`;
          const mime = mimeType[ext.replace(".", "")] || "Unknown";

          const rowValues = [
            this.trxnMap[data.id_trtype] || "Unknown",
            "Image Upload",
            trxnNameMap[data.id_trtype] || "Unknown",
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
            actualClientId,
          ];

          const paramsForQuery = rowValues.map(() => `$${paramIndex++}`);
          valueStrings.push(`(${paramsForQuery.join(", ")})`);
          valueParams.push(...rowValues);
        }

        if (valueStrings.length > 0) {
          const queryText = `
            INSERT INTO investor.aif_document_details(
              document_process, document_activity, document_type, document_format, document_path,
              folio_id, transaction_reference_id, document_status, mime_type,
              user_attr0, user_attr1, user_attr2, user_attr3, user_attr4,
              user_attr5, user_attr6, user_attr7, user_attr8, user_attr9,
              approval_status, approved_by, approved_on, comments, audit_code,
              del_flag, last_update_tms, last_updated_by, creation_date, created_by,
              page_count, client_id
            ) VALUES ${valueStrings.join(", ")}
          `;
          this.logger.info(
            `executeSql: executing batch of ${valueStrings.length} rows.`
          );
          const result = await client.query(queryText, valueParams);
          insertedRows += result.rowCount || 0;
        }
      }
      this.logger.info(`executeSql: inserted a total of ${insertedRows} rows`);

      await client.query("COMMIT");
      this.logger.info("executeSql: COMMIT successful");
      this.logger.info("SQL executed successfully");
      const badRowsFilePath = await this.writeBadRowsToFile(
        badRows,
        "sql_bad_rows.txt"
      );
      return {
        result: "success",
        logs,
        summary: {
          insertedRows,
          errorRows: badRows.length,
          badRows,
          badRowsFilePath,
        },
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (
        msg.includes("ECONNREFUSED") ||
        msg.includes("ETIMEDOUT") ||
        msg.includes("ENOTFOUND") ||
        msg.includes("EHOSTUNREACH")
      ) {
        this.logger.error(
          `executeSql: Critical connection error detected. Attempting to reconnect pool: ${msg}`
        );
        await this.reconnectPool().catch((reconnectErr) => {
          this.logger.error(
            `executeSql: Failed to re-establish PostgreSQL pool after critical error: ${reconnectErr.message}`
          );
        });
      }

      if (client) {
        this.logger.warn("executeSql: error occurred, attempting ROLLBACK");
        try {
          await client.query("ROLLBACK");
          this.logger.info("executeSql: transaction rolled back");
        } catch (e) {
          const m = e instanceof Error ? e.message : "Unknown error";
          this.logger.error({
            function: "executeSql",
            message: `ROLLBACK failed: ${m}`,
            error: e,
          });
        }
      }

      this.logger.error({
        function: "executeSql",
        message: `SQL execution failed: ${msg}`,
        error: err,
      });
      logs.push({
        row: 0,
        status: "error",
        message: `SQL execution failed: ${msg}`,
      });
      return {
        result: "failed",
        logs,
        summary: {
          insertedRows: 0,
          errorRows: 0,
          badRows: [],
          badRowsFilePath: null,
        },
      };
    } finally {
      if (client) {
        client.release();
        this.logger.info("executeSql: client released back to pool");
      }
    }
  }

  async updateFolioAndTransaction(updateAll: boolean): Promise<{
    result: string;
    logs: SqlLog[];
    summary: {
      updatedFolioRows: number;
      updatedTransactionRows: number;
      badRows: { user_attr1: string; user_attr2: string; reason: string }[];
      badRowsFilePath: string | null;
    };
  }> {
    this.logger.info(
      `Starting updateFolioAndTransaction with updateAll: ${updateAll}`
    );
    const { transactions } = await this.generateSql();

    let processedFolioNumbers: string[] = [];
    if (!updateAll) {
      processedFolioNumbers = await this.getProcessedFolioNumbers();
      if (processedFolioNumbers.length === 0) {
        this.logger.warn(
          "updateFolioAndTransaction: No processed folio numbers found from processed CSV. Skipping updates."
        );
        return {
          result: "failed",
          logs: [
            {
              row: 0,
              status: "error",
              message: "No processed folio numbers found to update.",
            },
          ],
          summary: {
            updatedFolioRows: 0,
            updatedTransactionRows: 0,
            badRows: [],
            badRowsFilePath: null,
          },
        };
      }
    }

    // Get unique id_fund values
    const uniqueClientCodes = [
      ...new Set(transactions.map((tx) => tx.id_fund)),
    ];
    this.logger.info(
      `updateFolioAndTransaction: unique client codes = ${uniqueClientCodes.length}`
    );

    const initialTransactionIdentifiers = new Set<string>();
    transactions.forEach((tx) => {
      initialTransactionIdentifiers.add(`${tx.id_ihno}-${tx.id_acno}`);
    });

    const logs: SqlLog[] = [];
    let client: PoolClient | null = null;
    const updatedTransactionIdentifiers = new Set<string>();

    try {
      this.logger.info("updateFolioAndTransaction: attempting pool.connect()");
      client = await this.getPool().connect();
      this.logger.info("updateFolioAndTransaction: pool.connect() successful");
      client.on("error", (err) =>
        this.logger.error(
          `updateFolioAndTransaction: client error: ${err.message}`
        )
      );

      await client.query("BEGIN");
      this.logger.info("updateFolioAndTransaction: BEGIN started");

      // Query 1: Delete from temp_images_1
      const deleteQuery = `
DELETE FROM public.temp_images_1;
`;
      this.logger.info("updateFolioAndTransaction: deleting temp_images_1");
      await client.query(deleteQuery);
      logs.push({
        row: 0,
        status: "executed",
        message: "Deleted from temp_images_1",
        sql: deleteQuery,
      });
      this.logger.info("updateFolioAndTransaction: deleted temp_images_1");

      // Query 2: Insert into temp_images_1
      const insertTempQuery = `
INSERT INTO public.temp_images_1 (client_code, folio_number, IHNO)
SELECT DISTINCT
    cm.client_code,
    fo.folio_number,
    ts.user_attr5 AS ihno
  FROM trxn.aif_transaction_summary ts
  JOIN investor.aif_folio fo ON ts.client_id = fo.client_id AND ts.folio_id = fo.id
  JOIN fund.client_master cm ON cm.id = fo.client_id
  WHERE ${updateAll ? "TRUE" : "fo.folio_number = ANY($1::text[])"}
    AND ts.created_by = 'aifappendersvc'
    AND (ts.trxn_status != 'R' OR ts.trxn_status IS NULL);
`;
      this.logger.info(
        `updateFolioAndTransaction: inserting temp for ${
          updateAll ? "all" : processedFolioNumbers.length
        } folios`
      );
      const insertResult = await client.query(
        insertTempQuery,
        updateAll ? [] : [processedFolioNumbers]
      );
      logs.push({
        row: 0,
        status: "executed",
        message: `Inserted ${insertResult.rowCount} rows into temp_images_1`,
        sql: insertTempQuery,
      });
      this.logger.info(
        `updateFolioAndTransaction: inserted ${insertResult.rowCount} temp rows`
      );

      // Query 3: Update folio_id using id_acno
      const updateFolioQuery = `
      WITH client_folio AS (
        SELECT folio_number,id,client_id,
        (select cm.client_code from fund.client_master cm where cm.id=client_id) from investor.aif_folio
    )
    UPDATE investor.aif_document_details AS d
      SET folio_id = f.id
    FROM client_folio AS f
    JOIN fund.client_master cm on f.client_id=cm.id
      LEFT JOIN public.temp_images_1 AS t ON f.folio_number = t.folio_number AND t.client_code = cm.client_code
    WHERE (d.user_attr2 = f.folio_number
        OR d.transaction_reference_id = t.ihno)
      ${updateAll ? "" : "AND d.user_attr2 = ANY($1::text[])"}
    RETURNING d.user_attr1, d.user_attr2;
`;
      this.logger.info("updateFolioAndTransaction: updating folio_id");
      const updateFolioResult = await client.query(
        updateFolioQuery,
        updateAll ? [] : [processedFolioNumbers]
      );
      updateFolioResult.rows.forEach((row) => {
        updatedTransactionIdentifiers.add(
          `${row.user_attr1}-${row.user_attr2}`
        );
      });
      logs.push({
        row: 0,
        status: "updated",
        message: `Updated ${updateFolioResult.rowCount} folio_id rows in aif_document_details`,
        sql: updateFolioQuery,
      });
      this.logger.info(
        `updateFolioAndTransaction: updated folio_id rows=${updateFolioResult.rowCount}`
      );

      // Query 4: Update transaction_reference_id
      const updateTransactionQuery = `
UPDATE investor.aif_document_details AS d
SET transaction_reference_id = ts.transaction_number
FROM trxn.aif_transaction_summary AS ts
WHERE ts.client_id = d.client_id
  AND ts.folio_id = d.folio_id
  AND ts.user_attr5 = d.user_attr1
  AND d.created_by = 'system'
  ${
    updateAll
      ? ""
      : "AND ts.client_id IN (SELECT id FROM fund.client_master WHERE client_code = ANY($1))"
  }
  ${updateAll ? "" : "AND d.user_attr2 = ANY($2::text[])"}
  AND (ts.trxn_status != 'R' OR ts.trxn_status IS NULL)
  AND ts.created_by = 'aifappendersvc'
RETURNING d.user_attr1, d.user_attr2;
`;
      this.logger.info(
        "updateFolioAndTransaction: updating transaction_reference_id"
      );
      const updateTransactionResult = await client.query(
        updateTransactionQuery,
        updateAll ? [] : [uniqueClientCodes, processedFolioNumbers]
      );
      updateTransactionResult.rows.forEach((row) => {
        updatedTransactionIdentifiers.add(
          `${row.user_attr1}-${row.user_attr2}`
        );
      });
      logs.push({
        row: 0,
        status: "updated",
        message: `Updated ${updateTransactionResult.rowCount} transaction_reference_id rows in aif_document_details`,
        sql: updateTransactionQuery,
      });
      this.logger.info(
        `updateFolioAndTransaction: updated transaction_reference_id rows=${updateTransactionResult.rowCount}`
      );

      await client.query("COMMIT");
      this.logger.info("updateFolioAndTransaction: COMMIT successful");
      this.logger.info("Folio and transaction updates completed");

      const badRows: {
        user_attr1: string;
        user_attr2: string;
        reason: string;
      }[] = [];
      transactions.forEach((tx) => {
        const identifier = `${tx.id_ihno}-${tx.id_acno}`;
        if (!updatedTransactionIdentifiers.has(identifier)) {
          badRows.push({
            user_attr1: tx.id_ihno.toString(),
            user_attr2: tx.id_acno,
            reason: "Folio or Transaction not updated",
          });
        }
      });

      const badRowsFilePath = await this.writeBadRowsToFile(
        badRows,
        "folio_update_bad_rows.txt"
      );

      const summary = {
        updatedFolioRows: updateFolioResult.rowCount || 0,
        updatedTransactionRows: updateTransactionResult.rowCount || 0,
        badRows: badRows,
        badRowsFilePath: badRowsFilePath,
      };
      return { result: "success", logs, summary };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (
        msg.includes("ECONNREFUSED") ||
        msg.includes("ETIMEDOUT") ||
        msg.includes("ENOTFOUND") ||
        msg.includes("EHOSTUNREACH")
      ) {
        this.logger.error(
          `updateFolioAndTransaction: Critical connection error detected. Attempting to reconnect pool: ${msg}`
        );
        await this.reconnectPool().catch((reconnectErr) => {
          this.logger.error(
            `updateFolioAndTransaction: Failed to re-establish PostgreSQL pool after critical error: ${reconnectErr.message}`
          );
        });
      }

      if (client) {
        this.logger.warn(
          "updateFolioAndTransaction: error occurred, attempting ROLLBACK"
        );
        try {
          await client.query("ROLLBACK");
          this.logger.info(
            "updateFolioAndTransaction: transaction rolled back"
          );
        } catch (e) {
          const m = e instanceof Error ? e.message : "Unknown error";
          this.logger.error(`updateFolioAndTransaction: ROLLBACK failed: ${m}`);
        }
      }

      this.logger.error(`updateFolioAndTransaction: failed: ${msg}`);
      logs.push({
        row: 0,
        status: "error",
        message: `Folio update failed: ${msg}`,
      });
      return {
        result: "failed",
        logs,
        summary: {
          updatedFolioRows: 0,
          updatedTransactionRows: 0,
          badRows: [],
          badRowsFilePath: null,
        },
      };
    } finally {
      if (client) {
        client.release();
        this.logger.info(
          "updateFolioAndTransaction: client released back to pool"
        );
      }
    }
  }

  private async writeBadRowsToFile(
    badRows: {
      id_ihno?: string | number;
      user_attr1?: string;
      user_attr2?: string;
      reason: string;
    }[],
    baseFilename: string // Changed from filename to baseFilename
  ): Promise<string | null> {
    if (badRows.length === 0) {
      return null;
    }

    const timestamp = new Date().toISOString().replace(/[:.-]/g, "_"); // YYYY-MM-DDTHH_mm_ss_sssZ
    const filenameWithTimestamp = `${timestamp}_${baseFilename}`;
    const filePath = path.join(__dirname, "../../logs", filenameWithTimestamp);
    let content = "";

    if (badRows[0].id_ihno !== undefined) {
      content = "id_ihno,reason\n";
      badRows.forEach((row) => {
        content += `${row.id_ihno},\"${row.reason}\"\n`;
      });
    } else if (
      badRows[0].user_attr1 !== undefined ||
      badRows[0].user_attr2 !== undefined
    ) {
      content = "user_attr1,user_attr2,reason\n";
      badRows.forEach((row) => {
        content += `${row.user_attr1 || ""},${row.user_attr2 || ""},"${
          row.reason
        }"\n`;
      });
    } else {
      // Fallback if structure is unexpected
      content = "reason\n";
      badRows.forEach((row) => {
        content += `\"${row.reason}\"\n`;
      });
    }

    try {
      await fs.writeFile(filePath, content);
      this.logger.info(`Bad rows written to ${filePath}`);
      return filenameWithTimestamp; // Return only the filename with timestamp, not the full path
    } catch (error) {
      this.logger.error(`Error writing bad rows to file ${filePath}: ${error}`);
      return null;
    }
  }

  public async sanityCheckDuplicates(params: {
    dryRun?: boolean;
    normalize?: boolean;
    cutoffTms?: string;
    clientCode?: string;
  }): Promise<{
    result: "success" | "failed";
    dryRun: boolean;
    cutoffTms: string;
    deletedCount?: number;
    rows?: any[]; // In dry-run, this will be an array of rows to be deleted
    logs: SqlLog[];
    imperfectDuplicates?: string[];
    imperfectDuplicatesFilePath?: string | null;
    totalDuplicatesFound?: number; // Added for dry-run output
  }> {
    const logs: SqlLog[] = [];
    const {
      dryRun = true,
      normalize = false,
      cutoffTms = "2025-09-09T00:00:00.0000",
      clientCode,
    } = params;
    this.logger.info(
      `sanityCheckDuplicates: Received cutoffTms: ${cutoffTms}, dryRun: ${dryRun}, normalize: ${normalize}, clientCode: ${clientCode}`
    );
    let client: PoolClient | null = null;

    try {
      client = await this.getPool().connect();
      await client.query("BEGIN");

      let clientId: number | null = null;
      if (clientCode) {
        const clientRes = await client.query(
          "SELECT id FROM fund.client_master WHERE client_code = $1",
          [clientCode]
        );
        if (clientRes.rows.length > 0) {
          clientId = clientRes.rows[0].id;
          this.logger.info(
            `sanityCheckDuplicates: Found client_id: ${clientId} for client_code: ${clientCode}`
          );
        } else {
          await client.query("ROLLBACK");
          this.logger.warn(
            `sanityCheckDuplicates: Client code '${clientCode}' not found.`
          );
          return {
            result: "failed",
            dryRun,
            cutoffTms,
            logs: [
              {
                row: 0,
                status: "error",
                message: `Client code '${clientCode}' not found.`,
              },
            ],
          };
        }
      }

      const keyExpr = (alias?: string) => {
        const prefix = alias ? `${alias}.` : "";
        return normalize
          ? `TRIM(LOWER(${prefix}user_attr1))`
          : `${prefix}user_attr1`;
      };
      const clientFilter = (alias?: string) => {
        const prefix = alias ? `${alias}.` : "";
        return clientId ? `AND ${prefix}client_id = ${clientId}` : "";
      };

      // Dry Run Query: Gathers all necessary info to simulate the logic in the backend.
      const dryRunSql = `
        WITH keys_after_cutoff AS (
            SELECT DISTINCT
                client_id,
                ${keyExpr()} AS k
            FROM investor.aif_document_details
            WHERE creation_date > $1::timestamptz
              AND user_attr1 IS NOT NULL
              AND client_id IS NOT NULL
              AND created_by = 'system'
              ${clientFilter()}
        ),
        all_matching_rows AS (
            SELECT d.*
            FROM investor.aif_document_details d
            JOIN keys_after_cutoff kac ON d.client_id = kac.client_id AND ${keyExpr(
              "d"
            )} = kac.k
            WHERE d.user_attr1 IS NOT NULL
              AND d.client_id IS NOT NULL
              AND d.created_by = 'system'
              ${clientFilter("d")}
        ),
        ranked_rows AS (
            SELECT
                id,
                client_id,
                ${keyExpr()} AS user_attr1_normalized,
                user_attr1,
                user_attr2,
                creation_date,
                folio_id,
                transaction_reference_id,
                (folio_id IS NOT NULL AND transaction_reference_id IS NOT NULL AND user_attr1 IS NOT NULL AND user_attr2 IS NOT NULL AND client_id IS NOT NULL) as is_perfect,
                COUNT(CASE WHEN folio_id IS NOT NULL AND transaction_reference_id IS NOT NULL THEN 1 END) OVER (PARTITION BY client_id, ${keyExpr()}) as perfect_rows_in_group,
                ROW_NUMBER() OVER (PARTITION BY client_id, ${keyExpr()} ORDER BY creation_date DESC, id DESC) as rn_desc,
                COUNT(*) OVER (PARTITION BY client_id, ${keyExpr()}) as total_rows_in_group
            FROM all_matching_rows
        )
        SELECT *
        FROM ranked_rows
        WHERE total_rows_in_group > 1
        ORDER BY client_id, user_attr1_normalized, creation_date;
      `;

      // Deletion Rule 1: Delete imperfect rows if a perfect row exists in the group.
      const deleteImperfectSql = `
        WITH keys_after_cutoff AS (
            SELECT DISTINCT client_id, ${keyExpr()} AS k
            FROM investor.aif_document_details
            WHERE creation_date > $1::timestamptz
              AND user_attr1 IS NOT NULL AND client_id IS NOT NULL AND created_by = 'system'
              ${clientFilter()}
        ),
        groups_with_perfect_row AS (
            SELECT DISTINCT d.client_id, ${keyExpr("d")} AS k
            FROM investor.aif_document_details d
            JOIN keys_after_cutoff kac ON d.client_id = kac.client_id AND ${keyExpr(
              "d"
            )} = kac.k
            WHERE d.folio_id IS NOT NULL AND d.transaction_reference_id IS NOT NULL AND d.user_attr1 IS NOT NULL AND d.user_attr2 IS NOT NULL AND d.client_id IS NOT NULL
              AND d.created_by = 'system'
              ${clientFilter("d")}
        ),
        ids_to_delete AS (
            SELECT d.id
            FROM investor.aif_document_details d
            JOIN groups_with_perfect_row gwpr ON d.client_id = gwpr.client_id AND ${keyExpr(
              "d"
            )} = gwpr.k
            WHERE (d.folio_id IS NULL OR d.transaction_reference_id IS NULL)
              AND d.created_by = 'system'
              ${clientFilter("d")}
        )
        DELETE FROM investor.aif_document_details
        WHERE id IN (SELECT id FROM ids_to_delete)
        RETURNING id;
      `;

      // Deletion Rule 2: If all rows in a group are perfect, keep only the latest one.
      const deleteOlderPerfectSql = `
        WITH keys_after_cutoff AS (
            SELECT DISTINCT client_id, ${keyExpr()} AS k
            FROM investor.aif_document_details
            WHERE creation_date > $1::timestamptz
              AND user_attr1 IS NOT NULL AND client_id IS NOT NULL AND created_by = 'system'
              ${clientFilter()}
        ),
        groups_where_all_are_perfect AS (
            SELECT d.client_id, ${keyExpr("d")} AS k
            FROM investor.aif_document_details d
            JOIN keys_after_cutoff kac ON d.client_id = kac.client_id AND ${keyExpr(
              "d"
            )} = kac.k
            WHERE d.created_by = 'system' ${clientFilter("d")}
            GROUP BY d.client_id, ${keyExpr("d")}
            HAVING COUNT(*) > 1 AND COUNT(CASE WHEN d.folio_id IS NULL OR d.transaction_reference_id IS NULL OR d.user_attr1 IS NULL OR d.user_attr2 IS NULL OR d.client_id IS NULL THEN 1 END) = 0
        ),
        ids_to_delete AS (
            SELECT id
            FROM (
                SELECT
                    d.id,
                    ROW_NUMBER() OVER (PARTITION BY d.client_id, ${keyExpr(
                      "d"
                    )} ORDER BY d.creation_date DESC, d.id DESC) as rn
                FROM investor.aif_document_details d
                JOIN groups_where_all_are_perfect gwaap ON d.client_id = gwaap.client_id AND ${keyExpr(
                  "d"
                )} = gwaap.k
                WHERE d.created_by = 'system' ${clientFilter("d")}
            ) ranked
            WHERE rn > 1
        )
        DELETE FROM investor.aif_document_details
        WHERE id IN (SELECT id FROM ids_to_delete)
        RETURNING id;
      `;

      // Deletion Rule 3: If all rows in a group are imperfect and there are duplicates, keep only the latest one.
      const deleteImperfectDuplicatesSql = `
        WITH keys_after_cutoff AS (
            SELECT DISTINCT client_id, ${keyExpr()} AS k
            FROM investor.aif_document_details
            WHERE creation_date > $1::timestamptz
              AND user_attr1 IS NOT NULL AND client_id IS NOT NULL AND created_by = 'system'
              ${clientFilter()}
        ),
        groups_with_only_imperfect_duplicates AS (
            SELECT d.client_id, ${keyExpr("d")} AS k
            FROM investor.aif_document_details d
            JOIN keys_after_cutoff kac ON d.client_id = kac.client_id AND ${keyExpr("d")} = kac.k
            WHERE d.created_by = 'system' ${clientFilter("d")}
            GROUP BY d.client_id, ${keyExpr("d")}
            HAVING COUNT(*) > 1
               AND COUNT(CASE WHEN (d.folio_id IS NOT NULL AND d.transaction_reference_id IS NOT NULL AND d.user_attr1 IS NOT NULL AND d.user_attr2 IS NOT NULL AND d.client_id IS NOT NULL) THEN 1 END) = 0
        ),
        ids_to_delete AS (
            SELECT id
            FROM (
                SELECT
                    d.id,
                    ROW_NUMBER() OVER (PARTITION BY d.client_id, ${keyExpr("d")} ORDER BY d.creation_date DESC, d.id DESC) as rn
                FROM investor.aif_document_details d
                JOIN groups_with_only_imperfect_duplicates gwoid ON d.client_id = gwoid.client_id AND ${keyExpr("d")} = gwoid.k
                WHERE d.created_by = 'system' ${clientFilter("d")}
            ) ranked
            WHERE rn > 1
        )
        DELETE FROM investor.aif_document_details
        WHERE id IN (SELECT id FROM ids_to_delete)
        RETURNING id;
      `;

      // Query to find groups of duplicates where no perfect row exists.
      const imperfectDuplicatesSql = `
        WITH keys_after_cutoff AS (
            SELECT DISTINCT client_id, ${keyExpr()} AS k
            FROM investor.aif_document_details
            WHERE creation_date > $1::timestamptz
              AND user_attr1 IS NOT NULL AND client_id IS NOT NULL AND created_by = 'system'
              ${clientFilter()}
        ),
        duplicate_groups AS (
            SELECT d.client_id, ${keyExpr("d")} AS k, COUNT(*) as total_rows
            FROM investor.aif_document_details d
            JOIN keys_after_cutoff kac ON d.client_id = kac.client_id AND ${keyExpr(
              "d"
            )} = kac.k
            WHERE d.created_by = 'system' ${clientFilter("d")}
            GROUP BY d.client_id, ${keyExpr("d")}
            HAVING COUNT(*) > 1
        ),
        groups_with_no_perfect_row AS (
            SELECT dg.client_id, dg.k
            FROM duplicate_groups dg
            WHERE NOT EXISTS (
                SELECT 1
                FROM investor.aif_document_details p
                WHERE p.client_id = dg.client_id
                  AND ${keyExpr("p")} = dg.k
                  AND p.folio_id IS NOT NULL
                  AND p.transaction_reference_id IS NOT NULL
                  AND p.user_attr1 IS NOT NULL
                  AND p.user_attr2 IS NOT NULL
                  AND p.client_id IS NOT NULL
            )
        )
        SELECT DISTINCT d.user_attr1, 'Imperfect Duplicate Group (No Action Taken)' as reason
        FROM investor.aif_document_details d
        JOIN groups_with_no_perfect_row gwnpr ON d.client_id = gwnpr.client_id AND ${keyExpr(
          "d"
        )} = gwnpr.k
        WHERE d.created_by = 'system' ${clientFilter("d")};
      `;

      if (dryRun) {
        const dryRunRes = await client.query(dryRunSql, [cutoffTms]);
        await client.query("ROLLBACK");

        const processedRows: DryRunResultRow[] = dryRunRes.rows.map((row) => {
          let wouldBeDeleted = false;
          let reason = "";

          const isPerfectRow = (row.folio_id !== null && row.transaction_reference_id !== null && row.user_attr1 !== null && row.user_attr2 !== null && row.client_id !== null);

          if (row.perfect_rows_in_group > 0) {
            if (!isPerfectRow) {
              wouldBeDeleted = true;
              reason =
                "Would be deleted: Imperfect row in a group with a perfect row.";
            } else {
              reason = "Perfect row, kept.";
            }
          } else if (row.total_rows_in_group > 1) { // New condition for imperfect duplicates
            if (row.rn_desc > 1) {
              wouldBeDeleted = true;
              reason =
                "Would be deleted: Older imperfect row in an all-imperfect duplicate group.";
            } else {
              reason = "Kept: Newest imperfect row in an all-imperfect duplicate group.";
            }
          } else {
            reason = "No action: Group contains no perfect rows and no duplicates.";
          }

          // This covers the case where a group might have perfect rows, but also multiple perfect rows.
          if (
            row.perfect_rows_in_group === row.total_rows_in_group &&
            row.total_rows_in_group > 1
          ) {
            if (row.rn_desc > 1) {
              wouldBeDeleted = true;
              reason =
                "Would be deleted: Older perfect row in an all-perfect group.";
            } else {
              reason = "Kept: Newest perfect row in an all-perfect group.";
            }
          }

          return {
            id: row.id,
            client_id: row.client_id,
            user_attr1_normalized: row.user_attr1_normalized,
            user_attr1: row.user_attr1,
            user_attr2: row.user_attr2,
            creation_date: row.creation_date,
            folio_id: row.folio_id,
            transaction_reference_id: row.transaction_reference_id,
            isPerfect: isPerfectRow,
            wouldBeDeleted,
            reason,
          };
        });

        const imperfectRes = await client.query<ImperfectDuplicateRow>(
          imperfectDuplicatesSql,
          [cutoffTms]
        );
        const imperfectDuplicates = imperfectRes.rows.map((r) => r.user_attr1);

        const totalDuplicatesFound = processedRows.filter(
          (p) => p.wouldBeDeleted
        ).length;

        this.logger.info(
          `sanityCheckDuplicates: dry-run complete. Found ${totalDuplicatesFound} rows that would be deleted.`
        );

        return {
          result: "success",
          dryRun: true,
          cutoffTms,
          rows: processedRows,
          imperfectDuplicates,
          totalDuplicatesFound,
          logs,
        };
      }

      // Live Deletion
      const delImperfectRes = await client.query(deleteImperfectSql, [
        cutoffTms,
      ]);
      logs.push({
        row: 0,
        status: "updated",
        message: `Rule 1 (Imperfects with Perfect) deleted ${delImperfectRes.rowCount} rows.`,
      });

      const delOlderPerfectRes = await client.query(deleteOlderPerfectSql, [
        cutoffTms,
      ]);
      logs.push({
        row: 0,
        status: "updated",
        message: `Rule 2 (Older Perfects) deleted ${delOlderPerfectRes.rowCount} rows.`,
      });

      const delImperfectDuplicatesRes = await client.query(deleteImperfectDuplicatesSql, [
        cutoffTms,
      ]);
      logs.push({
        row: 0,
        status: "updated",
        message: `Rule 3 (Older Imperfect Duplicates) deleted ${delImperfectDuplicatesRes.rowCount} rows.`,
      });

      await client.query("COMMIT");

      const totalDeleted =
        (delImperfectRes.rowCount ?? 0) +
        (delOlderPerfectRes.rowCount ?? 0) +
        (delImperfectDuplicatesRes.rowCount ?? 0);
      this.logger.info(
        `sanityCheckDuplicates: committed. Total deleted: ${totalDeleted} rows.`
      );

      // Identify and log groups with only imperfect duplicates for reporting
      const imperfectRes = await client.query<ImperfectDuplicateRow>(
        imperfectDuplicatesSql,
        [cutoffTms]
      );
      const imperfectDuplicates = imperfectRes.rows
        .map((row) => row.user_attr1)
        .filter((value) => value !== null) as string[];
      const imperfectDuplicatesFilePath = await this.writeBadRowsToFile(
        imperfectDuplicates.map((ua1) => ({
          user_attr1: ua1,
          reason: "Imperfect Duplicate Group (No Action Taken)",
        })),
        "imperfect_duplicates.csv"
      );

      return {
        result: "success",
        dryRun: false,
        cutoffTms,
        deletedCount: totalDeleted,
        imperfectDuplicatesFilePath,
        logs,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (
        msg.includes("ECONNREFUSED") ||
        msg.includes("ETIMEDOUT") ||
        msg.includes("ENOTFOUND") ||
        msg.includes("EHOSTUNREACH")
      ) {
        this.logger.error(
          `sanityCheckDuplicates: Critical connection error detected. Attempting to reconnect pool: ${msg}`
        );
        await this.reconnectPool().catch((reconnectErr) => {
          this.logger.error(
            `sanityCheckDuplicates: Failed to re-establish PostgreSQL pool after critical error: ${reconnectErr.message}`
          );
        });
      }

      if (client) {
        try {
          await client.query("ROLLBACK");
        } catch (e) {
          this.logger.error({
            function: "sanityCheckDuplicates",
            message: `ROLLBACK failed: ${
              e instanceof Error ? e.message : String(e)
            }`,
            error: e,
          });
        }
      }
      this.logger.error({
        function: "sanityCheckDuplicates",
        message: `Sanity check duplicates failed: ${msg}`,
        error: err,
      });
      logs.push({
        row: 0,
        status: "error",
        message: `sanityCheckDuplicates failed: ${msg}`,
      });
      return { result: "failed", dryRun, cutoffTms, logs };
    } finally {
      if (client) client.release();
    }
  }

  public async reconnect(): Promise<void> {
    this.logger.info("Manual reconnection triggered.");
    await reconnectPgPool();
    await warmupPgPool();
    this.logger.info("New PostgreSQL pool created and warmed up manually.");
  }

  public async getAifDocumentDetails(): Promise<any[]> {
    let client: PoolClient | null = null;
    try {
      const processedFolioNumbers = await this.getProcessedFolioNumbers();
      if (processedFolioNumbers.length === 0) {
        this.logger.warn(
          "getAifDocumentDetails: No processed folio numbers found by query from processed CSV for transferToMongo"
        );
        return [];
      }

      client = await this.getPool().connect();
      const query = `
        SELECT
          add.document_process,
          add.document_activity,
          add.document_type,
          add.document_format,
          add.document_path,
          add.folio_id,
          add.transaction_reference_id,
          add.document_status,
          add.mime_type,
          add.user_attr0,
          add.user_attr1,
          add.user_attr2,
          add.user_attr3,
          add.user_attr4,
          add.user_attr5,
          add.user_attr6,
          add.user_attr7,
          add.user_attr8,
          add.user_attr9,
          add.approval_status,
          add.approved_by,
          add.approved_on,
          add.comments,
          add.audit_code,
          add.del_flag,
          add.last_update_tms,
          add.last_updated_by,
          add.creation_date,
          add.created_by,
          add.page_count,
          add.client_id,
          cm.client_code
        FROM investor.aif_document_details add
        JOIN fund.client_master cm ON add.client_id = cm.id
        WHERE add.user_attr2 = ANY($1::text[]);
      `;
      const res = await client.query(query, [processedFolioNumbers]);
      this.logger.info(
        `Fetched ${res.rows.length} rows from aif_document_details based on ${processedFolioNumbers.length} processed folios.`
      );
      return res.rows;
    } catch (error) {
      this.logger.error(`Error fetching aif_document_details: ${error}`);
      throw error;
    } finally {
      if (client) client.release();
    }
  }

  public async getUpdateDetails(): Promise<any[]> {
    let client: PoolClient | null = null;
    try {
      client = await this.getPool().connect();
      const query = `
        SELECT
          cm.client_code,
          add.user_attr1,
          add.transaction_reference_id
        FROM investor.aif_document_details add
        JOIN fund.client_master cm ON add.client_id = cm.id;
      `;
      const res = await client.query(query);
      this.logger.info(
        `Fetched ${res.rows.length} rows from aif_document_details for mongo update.`
      );
      return res.rows;
    } catch (error) {
      this.logger.error(`Error fetching details for mongo update: ${error}`);
      throw error;
    } finally {
      if (client) client.release();
    }
  }
}

// local helpers duplicated at end in original snippet; keeping top-level ones in-scope
// (No functional change)
