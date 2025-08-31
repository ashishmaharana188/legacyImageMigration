// database.ts

import ExcelJS from "exceljs";
import fs from "fs/promises";
import path from "path";
import { Pool, PoolClient } from "pg";
import winston from "winston";

interface SqlLog {
  row: number;
  status: "success" | "error" | "executed" | "updated";
  message: string;
  sql?: string;
}

export class Database {
  private pool: Pool;

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
    this.pool = this.createPool();
  }

  private createPool(): Pool {
    const newPool = new Pool({
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      password: process.env.DB_PASSWORD || "",
      port: parseInt(process.env.DB_PORT || "5433", 10),
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      // Consider allowExitOnIdle in serverless/background contexts
      // allowExitOnIdle: true,
    });

    // Lifecycle diagnostics
    newPool.on("connect", () => {
      this.logger.info("pg Pool: connect (new backend connection established)");
    });
    newPool.on("acquire", () => {
      this.logger.info("pg Pool: acquire (client checked out from pool)");
    });

    // IMPORTANT: Do NOT end() or null-out the pool on idle client errors.
    // Log and let pg discard the broken idle client internally.
    newPool.on("error", (err) => {
      this.logger.error(
        `pg Pool: unexpected error on idle client: ${err.message}`
      );
    });

    // Optional warm-up (tolerant of transient failures; does not mutate pool)
    (async () => {
      try {
        this.logger.info("pool warm-up: attempting initial connect/release");
        const client = await newPool.connect();
        // attach a temporary error handler while checked out
        const onClientError = (e: Error) =>
          this.logger.error(`warm-up client error: ${e.message}`);
        client.on("error", onClientError);
        client.release();
        client.off("error", onClientError);
        this.logger.info("pool warm-up: connect/release successful");
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        this.logger.warn(`pool warm-up: failed (tolerated): ${msg}`);
      }
    })();

    // Background health check every 5 min (never recreates or nulls the pool)
    setInterval(async () => {
      let client: PoolClient | null = null;
      try {
        client = await newPool.connect();
        const onClientError = (e: Error) =>
          this.logger.error(`health-check client error: ${e.message}`);
        client.on("error", onClientError);
        await client.query("SELECT 1");
        client.off("error", onClientError);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        this.logger.warn(`pool health check failed (tolerated): ${msg}`);
      } finally {
        if (client) client.release();
      }
    }, 300000);

    this.logger.info("Postgres pool created");
    return newPool;
  }

  public getPool(): Pool {
    // Keep returning the existing singleton pool.
    return this.pool;
  }

  public async warmup() {
    let client: PoolClient | null = null;
    try {
      client = await this.getPool().connect();
      const onClientError = (e: Error) =>
        this.logger.error(`warmup client error: ${e.message}`);
      client.on("error", onClientError);
      // A simple ping ensures the backend is reachable
      await client.query("SELECT 1");
      client.off("error", onClientError);
      this.logger.info("🔥 Database connection warm-up successful");
    } catch (err) {
      this.logger.warn("Database warm-up failed (tolerated):", err);
    } finally {
      if (client) client.release();
    }
  }

  private readonly logger = winston.createLogger({
    level: "info",
    format: winston.format.json(),
    transports: [
      new winston.transports.File({
        filename: "logs/error.log",
        level: "error",
      }),
      new winston.transports.File({ filename: "logs/combined.log" }),
      // Added Console transport for immediate terminal visibility
      new winston.transports.Console({
        level: "debug",
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        ),
      }),
    ],
  });

  private getFileExtension(filePath: string): string {
    return filePath ? path.extname(filePath).toLowerCase() : "";
  }

  async generateSql(): Promise<{
    sql: string;
    transactions: {
      id_fund: number;
      id_trtype: string;
      id_ihno: number;
      image: string;
      id_path: string;
      id_acno: string;
      page_count: number | string;
    }[];
    logs: SqlLog[];
  }> {
    const logs: SqlLog[] = [];

    try {
      const csvPath = path.join(__dirname, "../../processed");
      this.logger.info("generateSql: Reading processed directory");
      const files = await fs.readdir(csvPath);
      this.logger.info(`generateSql: found ${files.length} files in processed`);

      const latestCsv = files
        .filter((f) => f.startsWith("processed_") && f.endsWith(".csv"))
        .sort()
        .pop();

      if (!latestCsv) {
        this.logger.warn("generateSql: no processed_*.csv found");
        logs.push({
          row: 0,
          status: "error",
          message: "No processed CSV found",
        });
        return { sql: "", transactions: [], logs };
      }

      const csvFullPath = path.join(csvPath, latestCsv);
      this.logger.info("generateSql: Reading CSV file");

      const workbook = new ExcelJS.Workbook();
      await workbook.csv.readFile(csvFullPath);
      this.logger.info("generateSql: CSV loaded into workbook");

      const worksheet = await workbook.csv.readFile(csvFullPath);

      const transactions: {
        id_fund: number;
        id_trtype: string;
        id_ihno: number;
        image: string;
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
            image: row.getCell(4).text.trim(),
            id_path: row.getCell(5).text.trim(),
            id_acno: row.getCell(6).text.trim(),
            page_count: isNaN(parseInt(row.getCell(7).text, 10))
              ? row.getCell(7).text.trim()
              : parseInt(row.getCell(7).text, 10),
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Unknown error";
          this.logger.warn(
            `generateSql: parse error at row ${rowNumber}: ${msg}`
          );
          logs.push({
            row: rowNumber,
            status: "error",
            message: `Failed to parse row: ${msg}`,
          });
        }
      });

      this.logger.info(
        `generateSql: parsed ${transactions.length} transaction rows`
      );

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
            const clientId = String(data.id_fund)
              .split("")
              .map((char) => (/\\d/.test(char) ? char.charCodeAt(0) : ""))
              .join("");

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

            this.logger.debug(`generateSql: built values for row ${index + 2}`);

            logs.push({
              row: index + 2,
              status: "success",
              message: "SQL generated for row",
              sql,
            });
            return sql;
          } catch (err) {
            const msg = err instanceof Error ? err.message : "Unknown error";
            this.logger.warn(
              `generateSql: failed generating SQL for row ${index + 2}: ${msg}`
            );
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
        this.logger.warn("generateSql: no valid rows to generate SQL");
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

      this.logger.info("Generated multi-row SQL");
      return { sql, transactions, logs };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      this.logger.error(`generateSql: failed: ${msg}`);
      logs.push({
        row: 0,
        status: "error",
        message: `generateSql failed: ${msg}`,
      });
      return { sql: "", transactions: [], logs };
    }
  }

  async executeSql(): Promise<{ result: string; logs: SqlLog[] }> {
    const logs: SqlLog[] = [];
    let client: PoolClient | null = null;

    try {
      this.logger.info("executeSql: generating SQL from CSV");
      const { transactions, logs: generateLogs } = await this.generateSql();
      logs.push(...generateLogs);

      if (!transactions.length) {
        this.logger.error("executeSql: no transactions to execute");
        logs.push({
          row: 0,
          status: "error",
          message: "No transactions to execute",
        });
        return { result: "failed", logs };
      }

      this.logger.info("executeSql: attempting pool.connect()");
      client = await this.getPool().connect();
      this.logger.info("executeSql: pool.connect() successful");

      client.on("error", (err) => {
        this.logger.error(`executeSql: client error: ${err.message}`);
      });

      await client.query("BEGIN");
      this.logger.info("executeSql: BEGIN started");

      const queryText = `
INSERT INTO investor.aif_document_details(
document_process, document_activity, document_type, document_format, document_path,
folio_id, transaction_reference_id, document_status, mime_type,
user_attr0, user_attr1, user_attr2, user_attr3, user_attr4,
user_attr5, user_attr6, user_attr7, user_attr8, user_attr9,
approval_status, approved_by, approved_on, comments, audit_code,
del_flag, last_update_tms, last_updated_by, creation_date, created_by,
page_count, client_id
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31)
`;

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
      };

      for (const [index, data] of transactions.entries()) {
        this.logger.debug(`executeSql: preparing row ${index + 2}`);
        const ext = this.getFileExtension(data.id_path);
        if (!ext) {
          this.logger.warn(
            `executeSql: row ${index + 2} has invalid file extension`
          );
          logs.push({
            row: index + 2,
            status: "error",
            message: "Invalid file extension",
          });
          continue;
        }

        const format = ext.replace(".", "").toUpperCase();
        const clientId = String(data.id_fund)
          .split("")
          .map((char) => (/\\d/.test(char) ? char.charCodeAt(0) : ""))
          .join("");
        const basePath = `aif-in-a-box-assets-prod: Data/APPLICATION_FORMS/CLIENT_CODE_${data.id_fund}/`;
        const docPath = `${basePath}CLIENT_CODE_${data.id_fund}_TRANSACTION_NUMBER_${data.id_ihno}/CLIENT_CODE_${data.id_fund}_TRANSACTION_NUMBER_${data.id_ihno}${ext}`;

        const values = [
          this.trxnMap[data.id_trtype] || "Unknown",
          "Image Upload",
          trxnNameMap[data.id_trtype] || "Unknown",
          format,
          docPath,
          null,
          data.id_ihno.toString(),
          "A",
          mimeType[ext.replace(".", "")] || "Unknown",
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
          clientId,
        ];

        await client.query(queryText, values);
        this.logger.info(`executeSql: inserted row ${index + 2}`);
        logs.push({
          row: index + 2,
          status: "executed",
          message: `Row ${index + 2} inserted successfully`,
        });
      }

      await client.query("COMMIT");
      this.logger.info("executeSql: COMMIT successful");
      this.logger.info("SQL executed successfully");
      return { result: "success", logs };
    } catch (err) {
      if (client) {
        this.logger.warn("executeSql: error occurred, attempting ROLLBACK");
        try {
          await client.query("ROLLBACK");
          this.logger.info("executeSql: transaction rolled back");
        } catch (e) {
          const m = e instanceof Error ? e.message : "Unknown error";
          this.logger.error(`executeSql: ROLLBACK failed: ${m}`);
        }
      }

      this.logger.error(`executeSql: failed:`, err);
      logs.push({
        row: 0,
        status: "error",
        message: `SQL execution failed: ${err}`,
      });
      return { result: "failed", logs };
    } finally {
      if (client) {
        client.release();
        this.logger.info("executeSql: client released back to pool");
      }
    }
  }

  async updateFolioAndTransaction(): Promise<{
    result: string;
    logs: SqlLog[];
  }> {
    this.logger.info("Starting updateFolioAndTransaction");
    const { transactions } = await this.generateSql();

    // Get unique id_fund values
    const uniqueClientCodes = [
      ...new Set(transactions.map((tx) => tx.id_fund)),
    ];
    this.logger.info(
      `updateFolioAndTransaction: unique client codes = ${uniqueClientCodes.length}`
    );

    const logs: SqlLog[] = [];
    let client: PoolClient | null = null;

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
      for (const clientCode of uniqueClientCodes) {
        const insertTempQuery = `
INSERT INTO public.temp_images_1 (client_code, folio_number, IHNO)
SELECT client_code, folio_number, IHNO
FROM (
  SELECT DISTINCT
    cm.client_code,
    fo.folio_number,
    ts.user_attr5 AS ihno
  FROM trxn.aif_transaction_summary ts
  JOIN investor.aif_folio fo ON ts.client_id = fo.client_id AND ts.folio_id = fo.id
  JOIN fund.client_master cm ON cm.id = fo.client_id
  WHERE cm.client_code = $1
    AND ts.created_by = 'aifappendersvc'
    AND (ts.trxn_status != 'R' OR ts.trxn_status IS NULL)
) AS cte;
`;
        this.logger.info(
          `updateFolioAndTransaction: inserting temp for client_code=${clientCode}`
        );
        const insertResult = await client.query(insertTempQuery, [clientCode]);
        logs.push({
          row: 0,
          status: "executed",
          message: `Inserted ${insertResult.rowCount} rows into temp_images_1`,
          sql: insertTempQuery,
        });
        this.logger.info(
          `updateFolioAndTransaction: inserted ${insertResult.rowCount} temp rows for client_code=${clientCode}`
        );
      }

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
WHERE d.user_attr2 = f.folio_number
   OR d.transaction_reference_id = t.ihno
`;
      this.logger.info("updateFolioAndTransaction: updating folio_id");
      const updateFolioResult = await client.query(updateFolioQuery);
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
  AND ts.client_id IN (SELECT id FROM fund.client_master WHERE client_code = ANY($1))
  AND (ts.trxn_status != 'R' OR ts.trxn_status IS NULL)
  AND ts.created_by = 'aifappendersvc';
`;
      this.logger.info(
        "updateFolioAndTransaction: updating transaction_reference_id"
      );
      const updateTransactionResult = await client.query(
        updateTransactionQuery,
        [uniqueClientCodes]
      );
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
      return { result: "success", logs };
    } catch (err) {
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

      const msg = err instanceof Error ? err.message : "Unknown error";
      this.logger.error(`updateFolioAndTransaction: failed: ${msg}`);
      logs.push({
        row: 0,
        status: "error",
        message: `Folio update failed: ${msg}`,
      });
      return { result: "failed", logs };
    } finally {
      if (client) {
        client.release();
        this.logger.info(
          "updateFolioAndTransaction: client released back to pool"
        );
      }
    }
  }

  // ADD THIS inside the Database class (e.g., after updateFolioAndTransaction)

  public async sanityCheckDuplicates(params: {
    dryRun?: boolean; // if true, does not delete; returns rows that would be deleted
    normalize?: boolean; // if true, compares TRIM(LOWER(user_attr1)) for robustness
  }): Promise<{
    result: "success" | "failed";
    dryRun: boolean;
    cutoffTms: string;
    deletedCount?: number;
    rows?: any[]; // In dry-run, this will be an array of rows to be deleted
    logs: SqlLog[];
  }> {
    const logs: SqlLog[] = [];
    const { dryRun = true, normalize = false } = params;
    const cutoffTms = "2025-08-31T00:00:00.0000"; // Hardcoded cutoff time
    let client: PoolClient | null = null;

    const keyExpr = normalize ? "TRIM(LOWER(user_attr1))" : "user_attr1";

    // Query for Rule 1: Deletes post-cutoff entries for keys that existed pre-cutoff.
    const deleteRule1Sql = `
WITH pre_cutoff_keys AS (
  SELECT DISTINCT ${keyExpr} AS k
  FROM investor.aif_document_details
  WHERE user_attr1 IS NOT NULL
    AND creation_date <= $1::timestamptz
)
DELETE FROM investor.aif_document_details d
WHERE ${keyExpr} IN (SELECT k FROM pre_cutoff_keys)
  AND d.creation_date > $1::timestamptz
RETURNING d.id
`;

    // Query for Rule 2: Deletes newer duplicates from post-cutoff-only keys.
    const deleteRule2Sql = `
WITH post_cutoff_only_keys AS (
    SELECT ${keyExpr} AS k
    FROM investor.aif_document_details
    WHERE user_attr1 IS NOT NULL
    GROUP BY ${keyExpr}
    HAVING MIN(creation_date) > $1::timestamptz
),
dups_to_delete AS (
    SELECT
        d.id,
        ROW_NUMBER() OVER (
            PARTITION BY ${keyExpr}
            ORDER BY d.creation_date ASC, d.id ASC
        ) as rn
    FROM investor.aif_document_details d
    JOIN post_cutoff_only_keys p ON ${keyExpr} = p.k
)
DELETE FROM investor.aif_document_details t
USING dups_to_delete d
WHERE t.id = d.id
  AND d.rn > 1
RETURNING t.id
`;

    const previewSql = `
WITH
-- CTEs for Rule 2 Preview
post_cutoff_only_keys AS (
  SELECT ${keyExpr} AS k
  FROM investor.aif_document_details
  WHERE user_attr1 IS NOT NULL
  GROUP BY ${keyExpr}
  HAVING MIN(creation_date) > $2::timestamptz
),
post_cutoff_dups_ranked AS (
  SELECT d.*,
         ROW_NUMBER() OVER (PARTITION BY ${keyExpr} ORDER BY d.creation_date ASC, d.id ASC) AS rn
  FROM investor.aif_document_details d
  WHERE ${keyExpr} IN (SELECT k FROM post_cutoff_only_keys)
)
-- Rule 1 Preview
SELECT d.*, NULL::integer AS rn, 'Rule 1' as reason
FROM investor.aif_document_details d
WHERE ${keyExpr} IN (
    SELECT DISTINCT ${keyExpr}
    FROM investor.aif_document_details
    WHERE user_attr1 IS NOT NULL AND creation_date <= $1::timestamptz
)
AND d.creation_date > $1::timestamptz

UNION ALL

-- Rule 2 Preview
SELECT r2.*, 'Rule 2' as reason
FROM post_cutoff_dups_ranked r2
WHERE r2.rn > 1;
`;

    try {
      this.logger.info(
        `sanityCheckDuplicates: start (cutoff=${cutoffTms}, dryRun=${dryRun}, normalize=${normalize})`
      );

      client = await this.getPool().connect();
      await client.query("BEGIN");

      if (dryRun) {
        const previewRes = await client.query(previewSql, [
          cutoffTms,
          cutoffTms,
        ]);
        await client.query("ROLLBACK");
        this.logger.info(
          `sanityCheckDuplicates_v2: dry-run complete, ${previewRes.rows.length} rows would be deleted`
        );
        return {
          result: "success",
          dryRun: true,
          cutoffTms,
          rows: previewRes.rows,
          logs,
        };
      }

      // Execute Rule 1 Delete
      const delRes1 = await client.query(deleteRule1Sql, [cutoffTms]);
      logs.push({
        row: 0,
        status: "updated",
        message: `Rule 1 (pre-existing keys) deleted ${delRes1.rowCount} rows.`,
      });

      // Execute Rule 2 Delete
      const delRes2 = await client.query(deleteRule2Sql, [cutoffTms]);
      logs.push({
        row: 0,
        status: "updated",
        message: `Rule 2 (post-only keys) deleted ${delRes2.rowCount} rows.`,
      });

      await client.query("COMMIT");

      const totalDeleted = (delRes1.rowCount ?? 0) + (delRes2.rowCount ?? 0);
      this.logger.info(
        `sanityCheckDuplicates_v2: committed. Total deleted: ${totalDeleted} rows.`
      );

      return {
        result: "success",
        dryRun: false,
        cutoffTms,
        deletedCount: totalDeleted,
        logs,
      };
    } catch (err) {
      if (client) {
        try {
          await client.query("ROLLBACK");
        } catch (e) {
          this.logger.error(`sanityCheckDuplicates_v2: ROLLBACK failed: ${e}`);
        }
      }
      this.logger.error(
        `sanityCheckDuplicates_v2: failed: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
      logs.push({
        row: 0,
        status: "error",
        message: `sanityCheckDuplicates_v2 failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      });
      return { result: "failed", dryRun, cutoffTms, logs };
    } finally {
      if (client) client.release();
    }
  }
}

// local helpers duplicated at end in original snippet; keeping top-level ones in-scope
// (No functional change)
