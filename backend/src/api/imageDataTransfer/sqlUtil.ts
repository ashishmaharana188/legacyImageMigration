// backend/src/api/imageDataTransfer/sqlUtil.ts

import { parse } from "csv-parse";
import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import ExcelJS from "exceljs";
import { Pool, PoolClient } from "pg";
import logger from "../../utils/logger"; // Adjusted path
import {
  getPgPool,
  reconnectPgPool,
  warmupPgPool,
} from "../../../controllers/dbConnect"; // Adjusted path
import Cursor from "pg-cursor";
import { SqlLog, AifDocumentDetail, IPgQueryResult } from "./imageDataTransferTypes"; // Adjusted path
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


  private async reconnectPool(): Promise<void> {
    await reconnectPgPool();
  }

  public async getPool(): Promise<Pool> {
    return await getPgPool();
  }

  public async warmup() {
    await warmupPgPool();
  }

  private readonly logger = logger;

  private getFileExtension(filePath: string): string {
    return filePath ? path.extname(filePath).toLowerCase() : "";
  }

  private formatQuery(query: string, params: unknown[]): string {
    let formattedQuery = query;
    params.forEach((param, index) => {
      // Replace $1, $2, etc., with the actual parameter value
      // Handle strings by quoting them, numbers directly
      const replacement = typeof param === "string" ? `"${param}"` : String(param);
      formattedQuery = formattedQuery.replace(`$${index + 1}`, replacement);
    });
    return formattedQuery;
  }

  private async getProcessedFolioNumbers(): Promise<string[]> {
    const csvPath = path.join(__dirname, "../../../../processed"); // Adjusted path
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
      worksheet.eachRow((row: ExcelJS.Row, rowNumber: number) => {
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
      const csvPath = path.join(__dirname, "../../../../processed"); // Adjusted path
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
        message: "Reading CSV file via streaming parser",
      });

      const transactions: {
        id_fund: number;
        id_trtype: string;
        id_ihno: number;
        id_path: string;
        id_acno: string;
        page_count: number | string;
      }[] = [];

      await new Promise<void>((resolve, reject) => {
        let rowNumber = 1; // Start from 1 for header, actual data from 2
        fsSync
          .createReadStream(csvFullPath)
          .pipe(parse({ delimiter: ",", from_line: 2 })) // Skip header row
          .on("data", (row: string[]) => {
            rowNumber++;
            try {
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
          })
          .on("end", () => {
            this.logger.info({
              function: "generateSql",
              message: `Finished parsing CSV. Total rows processed: ${
                rowNumber - 1
              }`,
            });
            resolve();
          })
          .on("error", (err: unknown) => {
            const msg = err instanceof Error ? err.message : "Unknown error";
            this.logger.error({
              function: "generateSql",
              message: `Error reading CSV stream: ${msg}`,
              error: err,
            });
            logs.push({
              row: 0,
              status: "error",
              message: `CSV stream error: ${msg}`,
            });
            reject(err);
          });
      });

      this.logger.info({
        function: "generateSql",
        message: `Parsed ${transactions.length} transaction rows`,
      });

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

      const values = transactions
        .map((data, index) => {
          try {
            const p = data.id_path;
            const ext = this.getFileExtension(p).replace(".", "");
            if (!ext) throw new Error("Invalid file extension");

            const format = ext.replace(".", "").toUpperCase();
            const clientId = data.id_fund;

            const basePath = `aif-in-a-box-assets-prod: Data/APPLICATION_FORMS/CLIENT_CODE_${String(data.id_fund)}/`;
            const docPath = `${basePath}CLIENT_CODE_${String(data.id_fund)}_TRANSACTION_NUMBER_${data.id_ihno}/CLIENT_CODE_${String(data.id_fund)}_TRANSACTION_NUMBER_${data.id_ihno}${ext}`;

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

      const sql = SQL_INSERT_AIF_DOCUMENT_DETAILS.replace("%VALUES%", values.join(", "));

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
      badRows: unknown[];
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

      client = await (await this.getPool()).connect();
      this.logger.info("executeSql: pool.connect() successful");

      client.on("error", (err) => {
        this.logger.error(`executeSql: client error: ${err.message}`);
      });

      await pgBegin(client);
      this.logger.info("executeSql: BEGIN started");

      // --- Start of new logic for client_id lookup ---
      const uniqueIdFunds = [
        ...new Set(transactions.map((t) => String(t.id_fund))),
      ];
      this.logger.info(
        `executeSql: found ${uniqueIdFunds.length} unique id_fund values`
      );

interface ClientMasterRow { id: number; client_code: string; }


      const clientIdMap: Map<string, number> = new Map();
      if (uniqueIdFunds.length > 0) {
        const clientMasterRes = await pgQuery(client, SQL_SELECT_CLIENT_MASTER_BY_CODES, [
          uniqueIdFunds,
        ]);
        (clientMasterRes.rows as ClientMasterRow[]).forEach((row: ClientMasterRow) => {
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
      const badRows: unknown[] = [];
      const chunkSize = 500; // Process 500 rows at a time

      for (let i = 0; i < transactions.length; i += chunkSize) {
        const chunk = transactions.slice(i, i + chunkSize);
        const valueParams: unknown[] = [];
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
              } at row ${originalIndex + 2}. Skipping row.`
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
            continue; // Skip this row entirely from valueParams and valueStrings
          }

          const basePath = `aif-in-a-box-assets-prod: Data/APPLICATION_FORMS/CLIENT_CODE_${String(data.id_fund)}/`;
          const docPath = `${basePath}CLIENT_CODE_${String(data.id_fund)}_TRANSACTION_NUMBER_${data.id_ihno}/CLIENT_CODE_${String(data.id_fund)}_TRANSACTION_NUMBER_${data.id_ihno}${ext}`;
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
          const queryText = SQL_INSERT_AIF_DOCUMENT_DETAILS.replace(
            "%VALUES%",
            valueStrings.join(", ")
          );
          this.logger.info(
            `executeSql: executing batch of ${valueStrings.length} rows.`
          );
          const result = await pgQuery(client, queryText, valueParams) as IPgQueryResult;
          insertedRows += result.rowCount || 0;
        }
      }
      this.logger.info(`executeSql: inserted a total of ${insertedRows} rows`);

      await pgCommit(client);
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
          await pgRollback(client);
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

  async updateFolioAndTransaction(
    updateAll: boolean,
    transactions: {
      id_fund: number;
      id_trtype: string;
      id_ihno: number;
      id_path: string;
      id_acno: string;
      page_count: number | string;
    }[],
    initialLogs: SqlLog[]
  ): Promise<{
    result: string;
    logs: SqlLog[];
    summary: {
      updatedFolioRows: number;
      updatedTransactionRows: number;
      badRows: { user_attr1: string; user_attr2: string; reason: string }[];
      badRowsFilePath: string | null;
    };
  }> {
    const logs: SqlLog[] = [...initialLogs];

    this.logger.info(
      `Starting updateFolioAndTransaction with updateAll: ${updateAll}`
    );

    let processedFolioNumbers: string[] = [];
    if (!updateAll) {
      // Extract folio numbers from the provided transactions
      processedFolioNumbers = [
        ...new Set(transactions.map((tx) => tx.id_acno)),
      ];
      if (processedFolioNumbers.length === 0) {
        this.logger.warn(
          "updateFolioAndTransaction: No processed folio numbers found from provided transactions. Skipping updates."
        );
        logs.push({
          row: 0,
          status: "error",
          message: "No processed folio numbers found to update.",
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

    let client: PoolClient | null = null;
    const updatedTransactionIdentifiers = new Set<string>();

    try {
      this.logger.info("updateFolioAndTransaction: attempting pool.connect()");
      client = await (await this.getPool()).connect();
      this.logger.info("updateFolioAndTransaction: pool.connect() successful");
      client.on("error", (err) =>
        this.logger.error(
          `updateFolioAndTransaction: client error: ${err.message}`
        )
      );

      await pgBegin(client);
      this.logger.info("updateFolioAndTransaction: BEGIN started");

      // Create a temporary table for transaction data
      await pgQuery(client, SQL_CREATE_TEMP_TRANSACTION_DATA);
      this.logger.info(
        "updateFolioAndTransaction: temp_transaction_data table created."
      );

      const transactionDataToInsert = transactions.map((tx) => ({
        id_ihno: tx.id_ihno.toString(),
        id_acno: tx.id_acno,
      }));
      const insertChunkSize = 1000; // Define a suitable chunk size for inserts

      for (
        let i = 0;
        i < transactionDataToInsert.length;
        i += insertChunkSize
      ) {
        const chunk = transactionDataToInsert.slice(i, i + insertChunkSize);
        const valueStrings = chunk.map(
          (data, idx) => `($${idx * 2 + 1}, $${idx * 2 + 2})`
        );
        const valueParams = chunk.flatMap((data) => [
          data.id_ihno,
          data.id_acno,
        ]);

        if (valueStrings.length > 0) {
          const insertQuery = SQL_INSERT_TEMP_TRANSACTION_DATA.replace(
            "%VALUES%",
            valueStrings.join(", ")
          );
          await pgQuery(client, insertQuery, valueParams);
        }
      }
      this.logger.info(
        `updateFolioAndTransaction: Inserted ${transactionDataToInsert.length} rows into temp_transaction_data.`
      );

      // Query 1: Delete from temp_images_1
      const deleteQuery = SQL_DELETE_TEMP_IMAGES_1;
      await pgQuery(client, deleteQuery);
      logs.push({
        row: 0,
        status: "executed",
        message: "Deleted from temp_images_1",
        sql: deleteQuery,
      });
      this.logger.info("updateFolioAndTransaction: deleted temp_images_1");

      // Query 2: Insert into temp_images_1
      const insertTempQuery = SQL_INSERT_TEMP_IMAGES_1.replace(
        "%WHERE_CLAUSE%",
        updateAll ? "TRUE" : "fo.folio_number = ANY($1::text[])"
      );
      this.logger.info(
        `updateFolioAndTransaction: inserting temp for ${
          updateAll ? "all" : processedFolioNumbers.length
        } folios`
      );
      const insertResult = await pgQuery(
        client,
        insertTempQuery,
        updateAll ? [] : [processedFolioNumbers]
      ) as IPgQueryResult;
      logs.push({
        row: 0,
        status: "executed",
        message: `Inserted ${insertResult.rowCount} rows into temp_images_1`,
        sql: insertTempQuery,
      });
      this.logger.info(
        `updateFolioAndTransaction: inserted ${insertResult.rowCount} temp rows`
      );

      // Query 3: Update folio_id using id_acno and temp_transaction_data
      const updateFolioQuery = SQL_UPDATE_FOLIO_ID.replace(
        "%WHERE_CLAUSE%",
        updateAll ? "" : "AND d.user_attr2 = ANY($1::text[])"
      );
      this.logger.info("updateFolioAndTransaction: updating folio_id");
interface FolioUpdateRow { user_attr1: string; user_attr2: string; }


      const updateFolioResult = await pgQuery(
        client,
        updateFolioQuery,
        updateAll ? [] : [processedFolioNumbers]
      ) as IPgQueryResult;
      (updateFolioResult.rows as FolioUpdateRow[]).forEach((row: FolioUpdateRow) => {
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

      // Query 4: Update transaction_reference_id using temp_transaction_data
      const updateTransactionQuery = SQL_UPDATE_TRANSACTION_REFERENCE_ID.replace(
        "%WHERE_CLAUSE%",
        updateAll ? "" : "AND d.user_attr2 = ANY($1::text[])"
      );
      this.logger.info(
        "updateFolioAndTransaction: updating transaction_reference_id"
      );
      const updateTransactionResult = await pgQuery(
        client,
        updateTransactionQuery,
        updateAll ? [] : [processedFolioNumbers]
      ) as IPgQueryResult;
      (updateTransactionResult.rows as FolioUpdateRow[]).forEach((row: FolioUpdateRow) => {
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

      await pgCommit(client);
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
        this.logger.warn("updateFolioAndTransaction: error occurred, attempting ROLLBACK");
        try {
          await pgRollback(client);
          this.logger.info("updateFolioAndTransaction: transaction rolled back");
        } catch (e) {
          const m = e instanceof Error ? e.message : "Unknown error";
          this.logger.error({
            function: "updateFolioAndTransaction",
            message: `ROLLBACK failed: ${m}`,
            error: e,
          });
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





  public async reconnect(): Promise<void> {
    this.logger.info("Manual reconnection triggered.");
    await reconnectPgPool();
    await warmupPgPool();
    this.logger.info("New PostgreSQL pool created and warmed up manually.");
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
      const clientRow: { id: number } | undefined = res.rows[0] as { id: number } | undefined;
      logger.info({
        category: "task-steps",
        message: `Fetched client ID for code ${clientCode}: ${
          clientRow?.id || "Not Found"
        }`,
        clientCode: clientCode,
        clientIdFound: clientRow?.id || "N/A",
      });
      return res.rows[0] as { id: number };
    } catch (error) {
      logger.error({
        category: "task-steps",
        message: `Error fetching client ID for code ${clientCode}: ${error}`,
        clientCode: clientCode,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    } finally {
      if (client) client.release();
    }
  }

  public async getAifDocumentDetails(clientId?: number): Promise<AifDocumentDetail[]> {
    let client: PoolClient | null = null;
    try {
      const processedFolioNumbers = await this.getProcessedFolioNumbers();
      if (processedFolioNumbers.length === 0) {
        logger.warn({
          category: "task-steps",
          message:
            "getAifDocumentDetails: No processed folio numbers found by query from processed CSV for transferToMongo",
        });
        return [];
      }

      client = await (await this.getPool()).connect();
      const queryParams: unknown[] = [processedFolioNumbers]; // Add processedFolioNumbers as the first parameter
      let clientIdClause = "";

      if (clientId) {
        clientIdClause = ` AND add.client_id = $${queryParams.length + 1}`;
        queryParams.push(clientId);
      }

      const query = SQL_SELECT_AIF_DOCUMENT_DETAILS.replace(
        "%CLIENT_ID_CLAUSE%",
        clientIdClause
      );

      logger.info({
        category: "task-steps",
        message: `Executing getAifDocumentDetails query.`,
        clientId: clientId || "N/A",
        query: query,
        queryParams: JSON.stringify(queryParams),
      });

      const res = await pgQuery(client, query, queryParams);
      logger.info({
        category: "task-steps",
        message: `Fetched ${res.rows.length} rows from aif_document_details.`,
        rowsFetched: res.rows.length,
      });
      return res.rows as AifDocumentDetail[];
    } catch (error) {
      this.logger.error(`Error fetching aif_document_details: ${error}`);
      throw error;
    } finally {
      if (client) client.release();
    }
  }

  public async getUpdateDetails(): Promise<unknown[]> {
    let client: PoolClient | null = null;
    try {
      client = await (await this.getPool()).connect();
      const res = await pgQuery(client, SQL_SELECT_UPDATE_DETAILS);
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
        clientId ? ` AND add.client_id = $${queryParams.length + 1}` : ""
      );

      if (clientId) {
        queryParams.push(clientId);
      }

      logger.info({
        category: "task-steps",
        message: `Executing streamUpdateDetails query.`,
        clientId: clientId || "N/A",
        query: query,
        queryParams: JSON.stringify(queryParams),
        interpolatedQuery: this.formatQuery(query, queryParams),
      });

      const cursor = client.query(new Cursor(query, queryParams));

      let batch: unknown[] = [];
      let rows: unknown[];
      do {
        rows = await new Promise<unknown[]>((resolve, reject) => {
            cursor.read(batchSize, (err: Error | undefined, rows: unknown[]) => {
            if (err) {
              logger.error({
                category: "task-steps",
                message: `Error reading from PostgreSQL cursor in streamUpdateDetails: ${err.message}`,
                error: err.message,
              });
              return reject(err);
            }
            logger.info({
              category: "task-steps",
              message: `Read ${rows.length} rows from PostgreSQL cursor.`,
              rowsReadFromCursor: rows.length,
            });
            resolve(rows);
          });
        });

        if (rows.length > 0) {
          batch = rows;
          logger.info({
            category: "task-steps",
            message: `Processing a batch of ${batch.length} rows from PostgreSQL.`,
            batchSize: batch.length,
          });
          await processBatch(batch as AifDocumentDetail[]);
        }
      } while (rows.length > 0);

      logger.info("Finished streaming all data from PostgreSQL.");
    } catch (error) {
      this.logger.error(`Error streaming details from PostgreSQL: ${error}`);
      throw error;
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  private async writeBadRowsToFile(
    badRows: unknown[],
    fileName: string
  ): Promise<string | null> {
    if (badRows.length === 0) {
      return null;
    }

    const timestamp = new Date().toISOString().replace(/[:.-]/g, "_");
    const fullFileName = `bad_rows_${timestamp}_${fileName}`;
    const filePath = path.join(__dirname, "../../../../processed", fullFileName);

    try {
      const header = Object.keys(badRows[0] || {}).join(",");
      const rows = badRows.map((row) =>
        Object.values(row as Record<string, unknown>).map(value => `"${String(value).replace(/"/g, '""')}"`).join(",")
      );
      const content = [header, ...rows].join("\n");
      await fs.writeFile(filePath, content, "utf8");
      this.logger.warn({
        function: "writeBadRowsToFile",
        message: `Bad rows written to: ${filePath}`,
      });
      return filePath;
    } catch (error) {
      this.logger.error({
        function: "writeBadRowsToFile",
        message: `Failed to write bad rows to file ${filePath}: ${error}`,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }
}
