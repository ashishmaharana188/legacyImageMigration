import { Pool, PoolClient } from "pg";
import { createFeatureLogger } from "../../utils/logger";
import {
  getPgPool,
  reconnectPgPool,
  warmupPgPool,
} from "../../utils/dbConnect";
import { SqlLog, SanityCheckResult, InternalDryRunRow } from "./dataCleanTypes";
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

const logger = createFeatureLogger("dataClean");

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

  public async sanityCheckDuplicates(params: {
    dryRun?: boolean;
    normalize?: boolean;
    cutoffTms?: string;
    clientCode?: string;
  }): Promise<SanityCheckResult> {
    const logs: SqlLog[] = [];
    const dryRun = params.dryRun !== false;
    const {
      normalize = false,
      cutoffTms = "2025-09-09T00:00:00.0000",
      clientCode,
    } = params;

    logger.info("SqlUtil: sanityCheckDuplicates started.", {
      params,
      console: true,
    });

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
          logger.error("SqlUtil: Client not found", {
            clientCode,
            console: true,
          });
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

      // Prepare SQL Strings
      const dryRunSql = SQL_DRY_RUN_DUPLICATES.replace(/%KEY_EXPR%/g, keyExpr())
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

      if (dryRun) {
        logger.info("SqlUtil: Executing Dry Run queries...", { console: true });

        const dryRunRes = await pgQuery(client, dryRunSql, [cutoffTms]);
        const imperfectRes = await pgQuery(client, imperfectDuplicatesSql, [
          cutoffTms,
        ]);

        await pgRollback(client);

        // [METRICS CALCULATION - FIXED TO MATCH DATABASE.TS LOGIC]
        let countImperfectVsPerfect = 0;
        let countOlderVersions = 0;
        let countOlderImperfects = 0;

        for (const row of dryRunRes.rows as InternalDryRunRow[]) {
          const isPerfectRow = !!(
            row.folio_id &&
            row.transaction_reference_id &&
            row.user_attr1 &&
            row.user_attr2
          );

          // Rule 1: Group has at least one perfect row. Delete the imperfects.
          if (row.perfect_rows_in_group > 0) {
            if (!isPerfectRow) {
              countImperfectVsPerfect++; // "Imperfect row in group with perfect row"
            } else {
              // It is a perfect row.
              // Check if the group is ALL perfect rows (Pure Perfect Group)
              if (row.perfect_rows_in_group === row.total_rows_in_group) {
                // Rule 2: In an all-perfect group, keep newest, delete older.
                if (row.rn_desc > 1) {
                  countOlderVersions++;
                }
              }
              // If group is Mixed (Perfect + Imperfect), we KEEP the perfect rows.
              // So we do NOT increment countOlderVersions here.
            }
          }
          // Rule 3: Group has NO perfect rows (All Imperfect).
          else if (row.total_rows_in_group > 1) {
             // Keep newest, delete older.
             if (row.rn_desc > 1) {
               countOlderImperfects++;
             }
          }
        }

        const totalDuplicates =
          countImperfectVsPerfect + countOlderVersions + countOlderImperfects;

        logger.info(
          `SqlUtil: Dry Run stats: ImpVsPerf=${countImperfectVsPerfect}, OldVer=${countOlderVersions}, OldImp=${countOlderImperfects}`,
          { console: true }
        );

        return {
          result: "success",
          dryRun: true,
          cutoffTms,
          totalDuplicatesFound: totalDuplicates,
          metrics: {
            imperfectVsPerfect: countImperfectVsPerfect,
            olderVersions: countOlderVersions,
            olderImperfects: countOlderImperfects,
          },
          logs,
        };
      } else {
        logger.warn("SqlUtil: Executing LIVE DELETE queries...", {
          console: true,
        });

        const del1 = await pgQuery(client, deleteImperfectSql, [cutoffTms]);
        const del2 = await pgQuery(client, deleteOlderPerfectSql, [cutoffTms]);
        const del3 = await pgQuery(client, deleteImperfectDuplicatesSql, [
          cutoffTms,
        ]);

        await pgCommit(client);

        const totalDeleted =
          (del1.rowCount || 0) + (del2.rowCount || 0) + (del3.rowCount || 0);

        logger.info(`SqlUtil: Live Delete finished. Total: ${totalDeleted}`, {
          console: true,
        });

        return {
          result: "success",
          dryRun: false,
          cutoffTms,
          deletedCount: totalDeleted,
          totalDuplicatesFound: totalDeleted,
          metrics: {
            imperfectVsPerfect: del1.rowCount || 0,
            olderVersions: del2.rowCount || 0,
            olderImperfects: del3.rowCount || 0,
          },
          logs: [{ row: 0, status: "info", message: "Deletion complete" }],
        };
      }
    } catch (err) {
      if (client) await pgRollback(client);
      const msg = String(err);
      logger.error("SqlUtil: Error during execution", {
        error: msg,
        console: true,
      });
      return {
        result: "failed" as const,
        dryRun,
        cutoffTms,
        logs: [{ row: 0, status: "error", message: msg }],
      } as SanityCheckResult;
    } finally {
      if (client) client.release();
    }
  }
}
