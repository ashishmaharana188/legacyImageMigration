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
  SanityCheckRow,
  DryRunResultRow,
  ImperfectDuplicateRow,
} from "./duplicateProcessorTypes";

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
      content = "id_ihno,reason\\n";
      badRows.forEach((row) => {
        content += `${row.id_ihno},"${row.reason}"\\n`;
      });
    } else if (
      badRows[0].user_attr1 !== undefined ||
      badRows[0].user_attr2 !== undefined
    ) {
      content = "user_attr1,user_attr2,reason\\n";
      badRows.forEach((row) => {
        content += `${row.user_attr1 || ""},${row.user_attr2 || ""},"${
          row.reason
        }"\\n`;
      });
    } else {
      // Fallback if structure is unexpected
      content = "reason\\n";
      badRows.forEach((row) => {
        content += `"${row.reason}"\\n`;
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
    rows?: any[];
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
            `sanityCheckDuplicates: Client code \'${clientCode}\' not found.`
          );
          return {
            result: "failed",
            dryRun,
            cutoffTms,
            logs: [
              {
                row: 0,
                status: "error",
                message: `Client code \'${clientCode}\' not found.`,
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
            HAVING COUNT(*) > 1 AND COUNT(CASE WHEN d.folio_id IS NULL OR d.transaction_reference_id IS NOT NULL OR d.user_attr1 IS NULL OR d.user_attr2 IS NULL OR d.client_id IS NULL THEN 1 END) = 0
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
            JOIN keys_after_cutoff kac ON d.client_id = kac.client_id AND ${keyExpr(
              "d"
            )} = kac.k
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
                    ROW_NUMBER() OVER (PARTITION BY d.client_id, ${keyExpr(
                      "d"
                    )} ORDER BY d.creation_date DESC, d.id DESC) as rn
                FROM investor.aif_document_details d
                JOIN groups_with_only_imperfect_duplicates gwoid ON d.client_id = gwoid.client_id AND ${keyExpr(
                  "d"
                )} = gwoid.k
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

      const delImperfectDuplicatesRes = await client.query(
        deleteImperfectDuplicatesSql,
        [cutoffTms]
      );
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
}
