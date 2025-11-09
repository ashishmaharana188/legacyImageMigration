// backend/src/api/duplicateProcessor/duplicateProcessorSqlUtil.ts

import fs from "fs/promises";
import path from "path";
import { Pool, PoolClient } from "pg";
import logger from "../../utils/logger";
import {
  getPgPool,
  reconnectPgPool,
  warmupPgPool,
} from "../../../controllers/dbConnect";
import {
  SqlLog,

  DryRunResultRow,

} from "./dataCleanTypes";
import {
  pgQuery,
  pgBegin,
  pgCommit,
  pgRollback,
  SQL_SELECT_CLIENT_ID_BY_CODE,
  SQL_DRY_RUN_DUPLICATES,
  SQL_DELETE_IMPERFECT_DUPLICATES,
  SQL_DELETE_OLDER_PERFECT_DUPLICATES,
  SQL_DELETE_OLDER_IMPERFECT_DUPLICATES,
  SQL_SELECT_IMPERFECT_DUPLICATES,
} from "./dataCleanCore";

export class DuplicateProcessorSqlUtil {
  constructor() {
    // Pool is now managed externally
  }

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

  private async writeBadRowsToFile(
    badRows: {
      id_ihno?: string | number;
      user_attr1?: string;
      user_attr2?: string;
      reason: string;
    }[],
    baseFilename: string
  ): Promise<string | null> {
    if (badRows.length === 0) {
      return null;
    }

    const timestamp = new Date().toISOString().replace(/[:.-]/g, "_");
    const filenameWithTimestamp = `${timestamp}_${baseFilename}`;
    const filePath = path.join(__dirname, "../../../../logs", filenameWithTimestamp);
    let content = "";

    if (badRows[0].id_ihno !== undefined) {
      content = "id_ihno,reason\n";
      badRows.forEach((row) => {
        content += `${row.id_ihno},"${row.reason}"\n`;
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
        content += `"${row.reason}"\n`;
      });
    }

    try {
      await fs.writeFile(filePath, content);
      this.logger.info(`Bad rows written to ${filePath}`);
      return filenameWithTimestamp;
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
    rows?: DryRunResultRow[];
    logs: SqlLog[];
    imperfectDuplicates?: string[];
    imperfectDuplicatesFilePath?: string | null;
    totalDuplicatesFound?: number;
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
      client = await (await this.getPool()).connect();
      await pgBegin(client);

      let clientId: number | null = null;
      if (clientCode) {
        const clientRes = await pgQuery(
          client,
          SQL_SELECT_CLIENT_ID_BY_CODE,
          [clientCode]
        );
        if (clientRes.rows.length === 0) {
          await pgRollback(client);
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
        clientId = clientRes.rows[0].id;
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
      const dryRunSql = SQL_DRY_RUN_DUPLICATES
        .replace(/%KEY_EXPR%/g, keyExpr())
        .replace(/%KEY_EXPR_D%/g, keyExpr("d"))
        .replace(/%CLIENT_FILTER%/g, clientFilter())
        .replace(/%CLIENT_FILTER_D%/g, clientFilter("d"));

      // Deletion Rule 1: Delete imperfect rows if a perfect row exists in the group.
      const deleteImperfectSql = SQL_DELETE_IMPERFECT_DUPLICATES
        .replace(/%KEY_EXPR%/g, keyExpr())
        .replace(/%KEY_EXPR_D%/g, keyExpr("d"))
        .replace(/%CLIENT_FILTER%/g, clientFilter())
        .replace(/%CLIENT_FILTER_D%/g, clientFilter("d"));

      // Deletion Rule 2: If all rows in a group are perfect, keep only the latest one.
      const deleteOlderPerfectSql = SQL_DELETE_OLDER_PERFECT_DUPLICATES
        .replace(/%KEY_EXPR%/g, keyExpr())
        .replace(/%KEY_EXPR_D%/g, keyExpr("d"))
        .replace(/%CLIENT_FILTER%/g, clientFilter())
        .replace(/%CLIENT_FILTER_D%/g, clientFilter("d"));

      // Deletion Rule 3: If all rows in a group are imperfect and there are duplicates, keep only the latest one.
      const deleteImperfectDuplicatesSql = SQL_DELETE_OLDER_IMPERFECT_DUPLICATES
        .replace(/%KEY_EXPR%/g, keyExpr())
        .replace(/%KEY_EXPR_D%/g, keyExpr("d"))
        .replace(/%CLIENT_FILTER%/g, clientFilter())
        .replace(/%CLIENT_FILTER_D%/g, clientFilter("d"));

      // Query to find groups of duplicates where no perfect row exists.
      const imperfectDuplicatesSql = SQL_SELECT_IMPERFECT_DUPLICATES
        .replace(/%KEY_EXPR%/g, keyExpr())
        .replace(/%KEY_EXPR_D%/g, keyExpr("d"))
        .replace(/%KEY_EXPR_P%/g, keyExpr("p"))
        .replace(/%CLIENT_FILTER%/g, clientFilter())
        .replace(/%CLIENT_FILTER_D%/g, clientFilter("d"));

      if (dryRun) {
        const dryRunRes = await pgQuery(client, dryRunSql, [cutoffTms]);
        await pgRollback(client);

        const processedRows: DryRunResultRow[] = dryRunRes.rows.map((row) => {
          let wouldBeDeleted = false;
          let reason = "";

          const isPerfectRow =
            row.folio_id !== null &&
            row.transaction_reference_id !== null &&
            row.user_attr1 !== null &&
            row.user_attr2 !== null &&
            row.client_id !== null;

          if (row.perfect_rows_in_group > 0) {
            if (!isPerfectRow) {
              wouldBeDeleted = true;
              reason =
                "Would be deleted: Imperfect row in a group with a perfect row.";
            } else {
              reason = "Perfect row, kept.";
            }
          } else if (row.total_rows_in_group > 1) {
            // New condition for imperfect duplicates
            if (row.rn_desc > 1) {
              wouldBeDeleted = true;
              reason =
                "Would be deleted: Older imperfect row in an all-imperfect duplicate group.";
            } else {
              reason =
                "Kept: Newest imperfect row in an all-imperfect duplicate group.";
            }
          } else {
            reason =
              "No action: Group contains no perfect rows and no duplicates.";
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
            is_perfect: row.is_perfect, // Added missing property
            perfect_rows_in_group: row.perfect_rows_in_group, // Added missing property
            rn_desc: row.rn_desc, // Added missing property
            total_rows_in_group: row.total_rows_in_group, // Added missing property
            isPerfect: isPerfectRow,
            wouldBeDeleted,
            reason,
          };
        });

        const imperfectRes = await pgQuery(client, imperfectDuplicatesSql, [
          cutoffTms,
        ]);
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
      const delImperfectRes = await pgQuery(client, deleteImperfectSql, [
        cutoffTms,
      ]);
      logs.push({
        row: 0,
        status: "updated",
        message: `Rule 1 (Imperfects with Perfect) deleted ${delImperfectRes.rowCount} rows.`,
      });

      const delOlderPerfectRes = await pgQuery(client, deleteOlderPerfectSql, [
        cutoffTms,
      ]);
      logs.push({
        row: 0,
        status: "updated",
        message: `Rule 2 (Older Perfects) deleted ${delOlderPerfectRes.rowCount} rows.`,
      });

      const delImperfectDuplicatesRes = await pgQuery(
        client,
        deleteImperfectDuplicatesSql,
        [cutoffTms]
      );
      logs.push({
        row: 0,
        status: "updated",
        message: `Rule 3 (Older Imperfect Duplicates) deleted ${delImperfectDuplicatesRes.rowCount} rows.`,
      });

      await pgCommit(client);

      const totalDeleted =
        (delImperfectRes.rowCount ?? 0) +
        (delOlderPerfectRes.rowCount ?? 0) +
        (delImperfectDuplicatesRes.rowCount ?? 0);
      this.logger.info(
        `sanityCheckDuplicates: committed. Total deleted: ${totalDeleted} rows.`
      );

      // Identify and log groups with only imperfect duplicates for reporting
      const imperfectRes = await pgQuery(client, imperfectDuplicatesSql, [
        cutoffTms,
      ]);
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
          await pgRollback(client);
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
}
