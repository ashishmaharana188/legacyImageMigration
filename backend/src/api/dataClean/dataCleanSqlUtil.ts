// backend/src/api/duplicateProcessor/duplicateProcessorSqlUtil.ts

import fs from "fs/promises";
import path from "path";
import { Pool, PoolClient } from "pg";
import logger from "../../utils/logger";
import {
  getPgPool,
  reconnectPgPool,
  warmupPgPool,
} from "../../utils/dbConnect";
import { SqlLog, DryRunResultRow } from "./dataCleanTypes";
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
    badRows: any[],
    baseFilename: string
  ): Promise<string | null> {
    if (badRows.length === 0) return null;
    const timestamp = new Date().toISOString().replace(/[:.-]/g, "_");
    const filePath = path.join(
      __dirname,
      "../../../../logs",
      `${timestamp}_${baseFilename}`
    );
    let content = "user_attr1,reason\n";
    badRows.forEach((row) => {
      content += `${row.user_attr1 || ""},"${row.reason}"\n`;
    });
    try {
      await fs.writeFile(filePath, content);
      return `${timestamp}_${baseFilename}`;
    } catch (error) {
      return null;
    }
  }

  public async sanityCheckDuplicates(params: {
    dryRun?: boolean;
    normalize?: boolean;
    cutoffTms?: string;
    clientCode?: string;
  }) {
    const logs: SqlLog[] = [];
    // FIX: Default to safety. If dryRun is not explicitly FALSE, it is TRUE
    const dryRun = params.dryRun !== false;
    const {
      normalize = false,
      cutoffTms = "2025-09-09T00:00:00.0000",
      clientCode,
    } = params;

    let client: PoolClient | null = null;
    try {
      client = await (await this.getPool()).connect();
      await pgBegin(client);

      let clientId: number | null = null;
      if (clientCode) {
        const clientRes = await pgQuery(client, SQL_SELECT_CLIENT_ID_BY_CODE, [
          clientCode,
        ]);
        if (clientRes.rows.length === 0) {
          await pgRollback(client);
          return {
            result: "failed",
            dryRun,
            cutoffTms,
            logs: [{ row: 0, status: "error", message: "Client not found" }],
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
      const clientFilter = (alias?: string) =>
        clientId
          ? `AND ${alias ? alias + "." : ""}client_id = ${clientId}`
          : "";

      const dryRunSql = SQL_DRY_RUN_DUPLICATES.replace(/%KEY_EXPR%/g, keyExpr())
        .replace(/%KEY_EXPR_D%/g, keyExpr("d"))
        .replace(/%CLIENT_FILTER%/g, clientFilter())
        .replace(/%CLIENT_FILTER_D%/g, clientFilter("d"));
      const deleteImperfectSql = SQL_DELETE_IMPERFECT_DUPLICATES.replace(
        /%KEY_EXPR%/g,
        keyExpr()
      )
        .replace(/%KEY_EXPR_D%/g, keyExpr("d"))
        .replace(/%CLIENT_FILTER%/g, clientFilter())
        .replace(/%CLIENT_FILTER_D%/g, clientFilter("d"));
      const deleteOlderPerfectSql = SQL_DELETE_OLDER_PERFECT_DUPLICATES.replace(
        /%KEY_EXPR%/g,
        keyExpr()
      )
        .replace(/%KEY_EXPR_D%/g, keyExpr("d"))
        .replace(/%CLIENT_FILTER%/g, clientFilter())
        .replace(/%CLIENT_FILTER_D%/g, clientFilter("d"));
      const deleteImperfectDuplicatesSql =
        SQL_DELETE_OLDER_IMPERFECT_DUPLICATES.replace(/%KEY_EXPR%/g, keyExpr())
          .replace(/%KEY_EXPR_D%/g, keyExpr("d"))
          .replace(/%CLIENT_FILTER%/g, clientFilter())
          .replace(/%CLIENT_FILTER_D%/g, clientFilter("d"));
      const imperfectDuplicatesSql = SQL_SELECT_IMPERFECT_DUPLICATES.replace(
        /%KEY_EXPR%/g,
        keyExpr()
      )
        .replace(/%KEY_EXPR_D%/g, keyExpr("d"))
        .replace(/%KEY_EXPR_P%/g, keyExpr("p"))
        .replace(/%CLIENT_FILTER%/g, clientFilter())
        .replace(/%CLIENT_FILTER_D%/g, clientFilter("d"));

      if (dryRun) {
        // --- START DRY RUN BLOCK ---
        const dryRunRes = await pgQuery(client, dryRunSql, [cutoffTms]);
        await pgRollback(client); // Ensure no changes are ever committed

        const processedRows: DryRunResultRow[] = dryRunRes.rows.map((row) => {
          const isPerfectRow = !!(
            row.folio_id &&
            row.transaction_reference_id &&
            row.user_attr1 &&
            row.user_attr2
          );
          let wouldBeDeleted = false;
          let reason = "Kept";

          if (row.perfect_rows_in_group > 0 && !isPerfectRow) {
            wouldBeDeleted = true;
            reason = "Delete: Imperfect row in group with perfect row";
          } else if (row.rn_desc > 1) {
            wouldBeDeleted = true;
            reason = "Delete: Older version of row";
          }

          return { ...row, isPerfect: isPerfectRow, wouldBeDeleted, reason };
        });

        const imperfectRes = await pgQuery(client, imperfectDuplicatesSql, [
          cutoffTms,
        ]);
        return {
          result: "success",
          dryRun: true,
          cutoffTms,
          rows: processedRows,
          imperfectDuplicates: imperfectRes.rows.map((r) => r.user_attr1),
          totalDuplicatesFound: processedRows.filter((p) => p.wouldBeDeleted)
            .length,
          logs,
        };
      } else {
        // --- START LIVE DELETION BLOCK (Wrapped in ELSE for physical isolation) ---
        this.logger.warn("CRITICAL: Executing live deletion.");

        const del1 = await pgQuery(client, deleteImperfectSql, [cutoffTms]);
        const del2 = await pgQuery(client, deleteOlderPerfectSql, [cutoffTms]);
        const del3 = await pgQuery(client, deleteImperfectDuplicatesSql, [
          cutoffTms,
        ]);

        await pgCommit(client); // Only commit if dryRun was explicitly FALSE

        return {
          result: "success",
          dryRun: false,
          cutoffTms,
          deletedCount:
            (del1.rowCount || 0) + (del2.rowCount || 0) + (del3.rowCount || 0),
          logs: [{ row: 0, status: "info", message: "Deletion complete" }],
        };
      }
    } catch (err) {
      if (client) await pgRollback(client);
      return {
        result: "failed",
        dryRun,
        cutoffTms,
        logs: [{ row: 0, status: "error", message: String(err) }],
      };
    } finally {
      if (client) client.release();
    }
  }
}
