// backend/src/api/duplicateProcessor/duplicateProcessorCore.ts

import { PoolClient } from "pg";
import mongoose, { Document, PipelineStage } from "mongoose";
import { DeleteResult } from "mongodb";
import { QueryResult } from "pg";

// --- SQL Queries ---

export const SQL_SELECT_CLIENT_ID_BY_CODE = `
SELECT id FROM fund.client_master WHERE client_code = $1
`;

export const SQL_DRY_RUN_DUPLICATES = `
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
        client_id,
        %KEY_EXPR% AS user_attr1_normalized,
        user_attr1,
        user_attr2,
        creation_date,
        folio_id,
        transaction_reference_id,
        (folio_id IS NOT NULL AND transaction_reference_id IS NOT NULL AND user_attr1 IS NOT NULL AND user_attr2 IS NOT NULL AND client_id IS NOT NULL) as is_perfect,
        COUNT(CASE WHEN folio_id IS NOT NULL AND transaction_reference_id IS NOT NULL THEN 1 END) OVER (PARTITION BY client_id, %KEY_EXPR%) as perfect_rows_in_group,
        ROW_NUMBER() OVER (PARTITION BY client_id, %KEY_EXPR% ORDER BY creation_date DESC, id DESC) as rn_desc,
        COUNT(*) OVER (PARTITION BY client_id, %KEY_EXPR%) as total_rows_in_group
    FROM all_matching_rows
)
SELECT *
FROM ranked_rows
WHERE total_rows_in_group > 1
ORDER BY client_id, user_attr1_normalized, creation_date;
`;

export const SQL_DELETE_IMPERFECT_DUPLICATES = `
WITH keys_after_cutoff AS (
    SELECT DISTINCT client_id, %KEY_EXPR% AS k
    FROM investor.aif_document_details
    WHERE creation_date > $1::timestamptz
      AND user_attr1 IS NOT NULL AND client_id IS NOT NULL AND created_by = 'system'
      %CLIENT_FILTER%
),
groups_with_perfect_row AS (
    SELECT DISTINCT d.client_id, %KEY_EXPR_D% AS k
    FROM investor.aif_document_details d
    JOIN keys_after_cutoff kac ON d.client_id = kac.client_id AND %KEY_EXPR_D% = kac.k
    WHERE d.folio_id IS NOT NULL AND d.transaction_reference_id IS NOT NULL AND d.user_attr1 IS NOT NULL AND d.user_attr2 IS NOT NULL AND d.client_id IS NOT NULL
      AND d.created_by = 'system'
      %CLIENT_FILTER_D%
),
ids_to_delete AS (
    SELECT d.id
    FROM investor.aif_document_details d
    JOIN groups_with_perfect_row gwpr ON d.client_id = gwpr.client_id AND %KEY_EXPR_D% = gwpr.k
    WHERE (d.folio_id IS NULL OR d.transaction_reference_id IS NULL)
      AND d.created_by = 'system'
      %CLIENT_FILTER_D%
)
DELETE FROM investor.aif_document_details
WHERE id IN (SELECT id FROM ids_to_delete)
RETURNING id;
`;

export const SQL_DELETE_OLDER_PERFECT_DUPLICATES = `
WITH keys_after_cutoff AS (
    SELECT DISTINCT client_id, %KEY_EXPR% AS k
    FROM investor.aif_document_details
    WHERE creation_date > $1::timestamptz
      AND user_attr1 IS NOT NULL AND client_id IS NOT NULL AND created_by = 'system'
      %CLIENT_FILTER%
),
groups_where_all_are_perfect AS (
    SELECT d.client_id, %KEY_EXPR_D% AS k
    FROM investor.aif_document_details d
    JOIN keys_after_cutoff kac ON d.client_id = kac.client_id AND %KEY_EXPR_D% = kac.k
    WHERE d.created_by = 'system' %CLIENT_FILTER_D%
    GROUP BY d.client_id, %KEY_EXPR_D%
    HAVING COUNT(*) > 1 AND COUNT(CASE WHEN d.folio_id IS NULL OR d.transaction_reference_id IS NOT NULL OR d.user_attr1 IS NULL OR d.user_attr2 IS NULL OR d.client_id IS NULL THEN 1 END) = 0
),
ids_to_delete AS (
    SELECT id
    FROM (
        SELECT
            d.id,
            ROW_NUMBER() OVER (PARTITION BY d.client_id, %KEY_EXPR_D% ORDER BY d.creation_date DESC, d.id DESC) as rn
        FROM investor.aif_document_details d
        JOIN groups_where_all_are_perfect gwaap ON d.client_id = gwaap.client_id AND %KEY_EXPR_D% = gwaap.k
        WHERE d.created_by = 'system' %CLIENT_FILTER_D%
    ) ranked
    WHERE rn > 1
)
DELETE FROM investor.aif_document_details
WHERE id IN (SELECT id FROM ids_to_delete)
RETURNING id;
`;

export const SQL_DELETE_OLDER_IMPERFECT_DUPLICATES = `
WITH keys_after_cutoff AS (
    SELECT DISTINCT client_id, %KEY_EXPR% AS k
    FROM investor.aif_document_details
    WHERE creation_date > $1::timestamptz
      AND user_attr1 IS NOT NULL AND client_id IS NOT NULL AND created_by = 'system'
      %CLIENT_FILTER%
),
groups_with_only_imperfect_duplicates AS (
    SELECT d.client_id, %KEY_EXPR_D% AS k
    FROM investor.aif_document_details d
    JOIN keys_after_cutoff kac ON d.client_id = kac.client_id AND %KEY_EXPR_D% = kac.k
    WHERE d.created_by = 'system' %CLIENT_FILTER_D%
    GROUP BY d.client_id, %KEY_EXPR_D%
    HAVING COUNT(*) > 1
       AND COUNT(CASE WHEN (d.folio_id IS NOT NULL AND d.transaction_reference_id IS NOT NULL AND d.user_attr1 IS NOT NULL AND d.user_attr2 IS NOT NULL AND d.client_id IS NOT NULL) THEN 1 END) = 0
),
ids_to_delete AS (
    SELECT id
    FROM (
        SELECT
            d.id,
            ROW_NUMBER() OVER (PARTITION BY d.client_id, %KEY_EXPR_D% ORDER BY d.creation_date DESC, d.id DESC) as rn
        FROM investor.aif_document_details d
        JOIN groups_with_only_imperfect_duplicates gwoid ON d.client_id = gwoid.client_id AND %KEY_EXPR_D% = gwoid.k
        WHERE d.created_by = 'system' %CLIENT_FILTER_D%
    ) ranked
    WHERE rn > 1
)
DELETE FROM investor.aif_document_details
WHERE id IN (SELECT id FROM ids_to_delete)
RETURNING id;
`;

export const SQL_SELECT_IMPERFECT_DUPLICATES = `
WITH keys_after_cutoff AS (
    SELECT DISTINCT client_id, %KEY_EXPR% AS k
    FROM investor.aif_document_details
    WHERE creation_date > $1::timestamptz
      AND user_attr1 IS NOT NULL AND client_id IS NOT NULL AND created_by = 'system'
      %CLIENT_FILTER%
),
duplicate_groups AS (
    SELECT d.client_id, %KEY_EXPR_D% AS k, COUNT(*) as total_rows
    FROM investor.aif_document_details d
    JOIN keys_after_cutoff kac ON d.client_id = kac.client_id AND %KEY_EXPR_D% = kac.k
    WHERE d.created_by = 'system' %CLIENT_FILTER_D%
    GROUP BY d.client_id, %KEY_EXPR_D%
    HAVING COUNT(*) > 1
),
groups_with_no_perfect_row AS (
    SELECT dg.client_id, dg.k
    FROM duplicate_groups dg
    WHERE NOT EXISTS (
        SELECT 1
        FROM investor.aif_document_details p
        WHERE p.client_id = dg.client_id
          AND %KEY_EXPR_P% = dg.k
          AND p.folio_id IS NOT NULL
          AND p.transaction_reference_id IS NOT NULL
          AND p.user_attr1 IS NOT NULL
          AND p.user_attr2 IS NOT NULL
          AND p.client_id IS NOT NULL
    )
)
SELECT DISTINCT d.user_attr1, 'Imperfect Duplicate Group (No Action Taken)' as reason
FROM investor.aif_document_details d
JOIN groups_with_no_perfect_row gwnpr ON d.client_id = gwnpr.client_id AND %KEY_EXPR_D% = gwnpr.k
WHERE d.created_by = 'system' %CLIENT_FILTER_D%;
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
