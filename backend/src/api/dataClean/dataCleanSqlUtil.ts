import { Pool, PoolClient } from "pg";
import { createFeatureLogger } from "../../utils/logger";
import {
  getPgPool,
  reconnectPgPool,
  warmupPgPool,
} from "../../utils/dbConnect";
import { SqlLog, SanityCheckResult } from "./dataCleanTypes";
import {
  pgQuery,
  pgBegin,
  pgCommit,
  pgRollback,
  SQL_SELECT_CLIENT_ID_BY_CODE,
  SQL_DRY_RUN_DUPLICATE_METRICS,
  SQL_DELETE_DUPLICATES,
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
    let inTransaction = false;
    try {
      client = await (await this.getPool()).connect();

      let clientId: number | null = null;
      if (clientCode) {
        const clientRes = await pgQuery(client, SQL_SELECT_CLIENT_ID_BY_CODE, [
          clientCode,
        ]);
        if (clientRes.rows.length === 0) {
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
          ? `AND ${alias ? alias + "." : ""}client_id = $2`
          : "";
      const queryParams = clientId ? [cutoffTms, clientId] : [cutoffTms];

      const readMetricCounts = (row: any = {}) => ({
        imperfectVsPerfect: Number(row.imperfect_vs_perfect || 0),
        olderVersions: Number(row.older_versions || 0),
        olderImperfects: Number(row.older_imperfects || 0),
      });

      // Prepare SQL Strings
      const dryRunSql = SQL_DRY_RUN_DUPLICATE_METRICS.replace(
        /%KEY_EXPR%/g,
        keyExpr()
      )
        .replace(/%KEY_EXPR_D%/g, keyExpr("d"))
        .replace(/%CLIENT_FILTER%/g, clientFilter())
        .replace(/%CLIENT_FILTER_D%/g, clientFilter("d"));

      const deleteDuplicatesSql = SQL_DELETE_DUPLICATES.replace(
        /%KEY_EXPR%/g,
        keyExpr()
      )
        .replace(/%KEY_EXPR_D%/g, keyExpr("d"))
        .replace(/%CLIENT_FILTER%/g, clientFilter())
        .replace(/%CLIENT_FILTER_D%/g, clientFilter("d"));

      if (dryRun) {
        logger.info("SqlUtil: Executing Dry Run queries...", { console: true });

        const dryRunRes = await pgQuery(client, dryRunSql, queryParams);

        const {
          imperfectVsPerfect: countImperfectVsPerfect,
          olderVersions: countOlderVersions,
          olderImperfects: countOlderImperfects,
        } = readMetricCounts(dryRunRes.rows[0]);

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

        await pgBegin(client);
        inTransaction = true;

        const deleteRes = await pgQuery(
          client,
          deleteDuplicatesSql,
          queryParams
        );

        await pgCommit(client);
        inTransaction = false;

        const deleteMetrics = readMetricCounts(deleteRes.rows[0]);
        const totalDeleted =
          deleteMetrics.imperfectVsPerfect +
          deleteMetrics.olderVersions +
          deleteMetrics.olderImperfects;

        logger.info(`SqlUtil: Live Delete finished. Total: ${totalDeleted}`, {
          console: true,
        });

        return {
          result: "success",
          dryRun: false,
          cutoffTms,
          deletedCount: totalDeleted,
          totalDuplicatesFound: totalDeleted,
          metrics: deleteMetrics,
          logs: [{ row: 0, status: "info", message: "Deletion complete" }],
        };
      }
    } catch (err) {
      if (client && inTransaction) await pgRollback(client);
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
