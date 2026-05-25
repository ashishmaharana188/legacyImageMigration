// backend/src/api/duplicateProcessor/duplicateProcessorCore.ts

import { PoolClient } from "pg";
import mongoose, { Document, PipelineStage } from "mongoose";
import { DeleteResult } from "mongodb";
import { QueryResult } from "pg";

// --- SQL Queries ---

export const SQL_SELECT_CLIENT_ID_BY_CODE = `
SELECT id FROM fund.client_master WHERE client_code = $1
`;

export const SQL_DRY_RUN_DUPLICATE_METRICS = `
WITH keys_after_cutoff AS (
    SELECT DISTINCT
        client_id,
        %KEY_EXPR% AS k
    FROM investor.aif_document_details
    WHERE creation_date > $1::timestamptz
      AND user_attr1 IS NOT NULL
      AND client_id IS NOT NULL
      AND created_by = 'system'
      %CLIENT_FILTER%
),
all_matching_rows AS (
    SELECT d.*
    FROM investor.aif_document_details d
    JOIN keys_after_cutoff kac ON d.client_id = kac.client_id AND %KEY_EXPR_D% = kac.k
    WHERE d.user_attr1 IS NOT NULL
      AND d.client_id IS NOT NULL
      AND d.created_by = 'system'
      %CLIENT_FILTER_D%
),
ranked_rows AS (
    SELECT
        id,
        user_attr1,
        user_attr2,
        creation_date,
        folio_id,
        transaction_reference_id,
        (folio_id IS NOT NULL AND transaction_reference_id IS NOT NULL AND user_attr1 IS NOT NULL AND user_attr2 IS NOT NULL AND client_id IS NOT NULL) as is_perfect,
        COUNT(CASE WHEN folio_id IS NOT NULL AND transaction_reference_id IS NOT NULL AND user_attr1 IS NOT NULL AND user_attr2 IS NOT NULL AND client_id IS NOT NULL THEN 1 END) OVER (PARTITION BY client_id, %KEY_EXPR%) as perfect_rows_in_group,
        ROW_NUMBER() OVER (PARTITION BY client_id, %KEY_EXPR% ORDER BY creation_date DESC, id DESC) as rn_desc,
        COUNT(*) OVER (PARTITION BY client_id, %KEY_EXPR%) as total_rows_in_group
    FROM all_matching_rows
)
SELECT
    (COUNT(*) FILTER (
        WHERE perfect_rows_in_group > 0 AND NOT is_perfect
    ))::int AS imperfect_vs_perfect,
    (COUNT(*) FILTER (
        WHERE is_perfect AND perfect_rows_in_group = total_rows_in_group AND rn_desc > 1
    ))::int AS older_versions,
    (COUNT(*) FILTER (
        WHERE perfect_rows_in_group = 0 AND rn_desc > 1
    ))::int AS older_imperfects
FROM ranked_rows
WHERE total_rows_in_group > 1;
`;

export const SQL_DELETE_DUPLICATES = `
WITH keys_after_cutoff AS (
    SELECT DISTINCT
        client_id,
        %KEY_EXPR% AS k
    FROM investor.aif_document_details
    WHERE creation_date > $1::timestamptz
      AND user_attr1 IS NOT NULL
      AND client_id IS NOT NULL
      AND created_by = 'system'
      %CLIENT_FILTER%
),
all_matching_rows AS (
    SELECT d.*
    FROM investor.aif_document_details d
    JOIN keys_after_cutoff kac ON d.client_id = kac.client_id AND %KEY_EXPR_D% = kac.k
    WHERE d.user_attr1 IS NOT NULL
      AND d.client_id IS NOT NULL
      AND d.created_by = 'system'
      %CLIENT_FILTER_D%
),
ranked_rows AS (
    SELECT
        id,
        user_attr1,
        user_attr2,
        creation_date,
        folio_id,
        transaction_reference_id,
        (folio_id IS NOT NULL AND transaction_reference_id IS NOT NULL AND user_attr1 IS NOT NULL AND user_attr2 IS NOT NULL AND client_id IS NOT NULL) as is_perfect,
        COUNT(CASE WHEN folio_id IS NOT NULL AND transaction_reference_id IS NOT NULL AND user_attr1 IS NOT NULL AND user_attr2 IS NOT NULL AND client_id IS NOT NULL THEN 1 END) OVER (PARTITION BY client_id, %KEY_EXPR%) as perfect_rows_in_group,
        ROW_NUMBER() OVER (PARTITION BY client_id, %KEY_EXPR% ORDER BY creation_date DESC, id DESC) as rn_desc,
        COUNT(*) OVER (PARTITION BY client_id, %KEY_EXPR%) as total_rows_in_group
    FROM all_matching_rows
),
ids_to_delete AS (
    SELECT
        id,
        CASE
            WHEN perfect_rows_in_group > 0 AND NOT is_perfect THEN 'imperfectVsPerfect'
            WHEN is_perfect AND perfect_rows_in_group = total_rows_in_group AND rn_desc > 1 THEN 'olderVersions'
            WHEN perfect_rows_in_group = 0 AND rn_desc > 1 THEN 'olderImperfects'
        END AS reason
    FROM ranked_rows
    WHERE total_rows_in_group > 1
      AND (
        (perfect_rows_in_group > 0 AND NOT is_perfect)
        OR (is_perfect AND perfect_rows_in_group = total_rows_in_group AND rn_desc > 1)
        OR (perfect_rows_in_group = 0 AND rn_desc > 1)
      )
),
deleted AS (
    DELETE FROM investor.aif_document_details d
    USING ids_to_delete itd
    WHERE d.id = itd.id
    RETURNING d.id
),
deleted_reasons AS (
    SELECT itd.reason
    FROM ids_to_delete itd
    JOIN deleted d ON d.id = itd.id
)
SELECT
    (COUNT(*) FILTER (WHERE reason = 'imperfectVsPerfect'))::int AS imperfect_vs_perfect,
    (COUNT(*) FILTER (WHERE reason = 'olderVersions'))::int AS older_versions,
    (COUNT(*) FILTER (WHERE reason = 'olderImperfects'))::int AS older_imperfects
FROM deleted_reasons;
`;

// --- MongoDB Operations ---

export async function mongoAggregate<T>(model: mongoose.Model<Document>, pipeline: PipelineStage[]): Promise<T[]> {
  return model.aggregate(pipeline).exec();
}

export async function mongoDeleteMany(model: mongoose.Model<Document>, filter: Record<string, unknown>): Promise<DeleteResult> {
  return model.deleteMany(filter);
}

// --- PostgreSQL Operations ---

export async function pgQuery(client: PoolClient, query: string, params: unknown[] = []): Promise<QueryResult> {
  return client.query(query, params);
}

export async function pgBegin(client: PoolClient): Promise<void> {
  await client.query("BEGIN");
}

export async function pgCommit(client: PoolClient): Promise<void> {
  await client.query("COMMIT");
}

export async function pgRollback(client: PoolClient): Promise<void> {
  await client.query("ROLLBACK");
}
