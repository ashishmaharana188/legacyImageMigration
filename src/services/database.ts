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
  private readonly trxnMap: Record<string, string> = {
    NEW: "IC",
    NCT: "NCT",
    RED: "RED",
    FUL: "RED",
    IPO: "IOBI",
    SIN: "IOBIS",
    SWOP: "SWP",
    SWOF: "SWP",
  };

  private readonly pool = new Pool({
    user: process.env.DB_USER || "postgres",
    host: process.env.DB_HOST || "localhost",
    database: process.env.DB_NAME || "investor",
    password: process.env.DB_PASSWORD || "your_password",
    port: parseInt(process.env.DB_PORT || "5432", 10),
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  private readonly logger = winston.createLogger({
    level: "info",
    format: winston.format.json(),
    transports: [
      new winston.transports.File({
        filename: "logs/error.log",
        level: "error",
      }),
      new winston.transports.File({ filename: "logs/combined.log" }),
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
    const csvPath = path.join(__dirname, "../../processed");
    const files = await fs.readdir(csvPath);
    const latestCsv = files
      .filter((f) => f.startsWith("processed_") && f.endsWith(".csv"))
      .sort()
      .pop();
    if (!latestCsv) {
      logs.push({
        row: 0,
        status: "error",
        message: "No processed CSV found",
      });
      return { sql: "", transactions: [], logs };
    }

    const csvFullPath = path.join(csvPath, latestCsv);
    const workbook = new ExcelJS.Workbook();
    await workbook.csv.readFile(csvFullPath);
    const worksheet = workbook.worksheets[0];
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
        logs.push({
          row: rowNumber,
          status: "error",
          message: `Failed to parse row: ${
            err instanceof Error ? err.message : "Unknown error"
          }`,
        });
      }
    });

    const trxnNameMap: Record<string, string> = {
      NEW: "New Application Form",
      NCT: "NCT Form",
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

    const values = transactions

      .map((data, index) => {
        try {
          const path = data.id_path;
          const ext = this.getFileExtension(path);
          if (!ext) throw new Error("Invalid file extension");
          const format = ext.toUpperCase();
          const clientId = String(data.id_fund)
            .split("")
            .map((char) => (/\d/.test(char) ? char.charCodeAt(0) : ""))
            .join("");
          const basePath = `aif-in-a-box-assets-prod: Data/APPLICATION_FORMS/CLIENT_CODE_${data.id_fund}/`;
          const docPath = `${basePath}CLIENT_CODE_${data.id_fund}_TRANSACTION_NUMBER_${data.id_ihno}/CLIENT_CODE_${data.id_fund}_TRANSACTION_NUMBER_${data.id_ihno}.${ext}`;
          const sql = `(
          '${this.trxnMap[data.id_trtype] || "Unknown"}', 'Image Upload', '${
            trxnNameMap[data.id_trtype] || "Unknown"
          }', '${format}', '${docPath}',
          null, '${data.id_ihno}', 'A', '${
            mimeType[ext] || "application/octet-stream"
          }',
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
          logs.push({
            row: index + 2,
            status: "error",
            message: `Failed to generate SQL: ${
              err instanceof Error ? err.message : "Unknown error"
            }`,
          });
          return null;
        }
      })
      .filter((val): val is string => val !== null);

    if (values.length === 0) {
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
     ) VALUES ${values.join(", ")};`;

    this.logger.info("Generated multi-row SQL", { sql });
    return { sql, transactions, logs };
  }

  async executeSql(): Promise<{ result: string; logs: SqlLog[] }> {
    const logs: SqlLog[] = [];
    let client: PoolClient | null = null;

    try {
      const { transactions, logs: generateLogs } = await this.generateSql();
      logs.push(...generateLogs);

      if (!transactions.length) {
        logs.push({
          row: 0,
          status: "error",
          message: "No transactions to execute",
        });
        return { result: "failed", logs };
      }

      client = await this.pool.connect();
      this.logger.info("Connected to database");

      await client.query("BEGIN");

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
      for (const [index, data] of transactions.entries()) {
        const ext = this.getFileExtension(data.id_path);
        if (!ext) {
          logs.push({
            row: index + 2,
            status: "error",
            message: "Invalid file extension",
          });
          continue;
        }
        const format = ext.toUpperCase();
        const clientId = String(data.id_fund)
          .split("")
          .map((char) => (/\d/.test(char) ? char.charCodeAt(0) : ""))
          .join("");
        const basePath = `aif-in-a-box-assets-prod: Data/APPLICATION_FORMS/CLIENT_CODE_${data.id_fund}/`;
        const docPath = `${basePath}CLIENT_CODE_${data.id_fund}_TRANSACTION_NUMBER_${data.id_ihno}/CLIENT_CODE_${data.id_fund}_TRANSACTION_NUMBER_${data.id_ihno}.${ext}`;
        const values = [
          this.trxnMap[data.id_trtype] || "Unknown",
          "Image Upload",
          trxnNameMap[data.id_trtype] || "Unknown",
          format,
          docPath,
          null,
          data.id_ihno.toString(),
          "A",
          mimeType[ext] || "application/octet-stream",
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
        logs.push({
          row: index + 2,
          status: "executed",
          message: `Row ${index + 2} inserted successfully`,
        });
      }

      await client.query("COMMIT");
      this.logger.info("SQL executed successfully");
      return { result: "success", logs };
    } catch (err) {
      if (client) {
        await client.query("ROLLBACK");
        this.logger.info("Transaction rolled back");
      }
      logs.push({
        row: 0,
        status: "error",
        message: `SQL execution failed: ${
          err instanceof Error ? err.message : "Unknown error"
        }`,
      });
      return { result: "failed", logs };
    } finally {
      if (client) {
        client.release();
        this.logger.info("Database connection released");
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

    const logs: SqlLog[] = [];
    let client: PoolClient | null = null;
    try {
      client = await this.pool.connect();
      this.logger.info("Connected to database for folio update");
      await client.query("BEGIN");

      // Query 1: Delete from temp_images_1
      const deleteQuery = `
        DELETE FROM public.temp_images_1;
      `;
      await client.query(deleteQuery);
      logs.push({
        row: 0,
        status: "executed",
        message: "Deleted from temp_images_1",
        sql: deleteQuery,
      });
      this.logger.info("Deleted from temp_images_1");

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
        const insertResult = await client.query(insertTempQuery, [clientCode]);
        logs.push({
          row: 0,
          status: "executed",
          message: `Inserted ${insertResult.rowCount} rows into temp_images_1`,
          sql: insertTempQuery,
        });
        this.logger.info(
          `Inserted ${insertResult.rowCount} rows into temp_images_1`
        );
      }

      // Query 3: Update folio_id using id_acno

      const updateFolioQuery = `
      WITH client_folio AS (
        SELECT folio_number,id,client_id,
      (select cm.client_code from fund.client_master cm where cm.id=client_id) from investor.aif_folio)
        UPDATE investor.aif_document_details AS d
        SET folio_id = f.id
        FROM client_folio AS f
        JOIN fund.client_master cm on f.client_id=cm.id
        LEFT JOIN public.temp_images_1 AS t ON f.folio_number = t.folio_number AND t.client_code = cm.client_code
        WHERE d.user_attr2 = f.folio_number
        OR d.transaction_reference_id = t.ihno
      `;
      const updateFolioResult = await client.query(updateFolioQuery);
      logs.push({
        row: 0,
        status: "updated",
        message: `Updated ${updateFolioResult.rowCount} folio_id rows in aif_document_details`,
        sql: updateFolioQuery,
      });
      this.logger.info(`Updated ${updateFolioResult.rowCount} folio_id rows`);

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
        `Updated ${updateTransactionResult.rowCount} transaction_reference_id rows`
      );

      await client.query("COMMIT");
      this.logger.info("Folio and transaction updates completed");
      return { result: "success", logs };
    } catch (err) {
      if (client) {
        await client.query("ROLLBACK");
        this.logger.info("Transaction rolled back for folio update");
      }
      logs.push({
        row: 0,
        status: "error",
        message: `Folio update failed: ${
          err instanceof Error ? err.message : "Unknown error"
        }`,
      });
      return { result: "failed", logs };
    } finally {
      if (client) {
        client.release();
        this.logger.info("Database connection released");
      }
    }
  }
}

const trxnNameMap: Record<string, string> = {
  NEW: "New Application Form",
  NCT: "NCT Form",
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
