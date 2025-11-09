// backend/src/api/imageDataTransfer/imageDataTransferCore.ts

import { PoolClient } from "pg";
import mongoose, { PipelineStage, BulkWriteOperation } from "mongoose";
import { IAifDocument, IAifDocumentInput, IBulkWriteResult } from "./imageDataTransferTypes";

// --- SQL Queries ---

export const SQL_INSERT_AIF_DOCUMENT_DETAILS = `
INSERT INTO investor.aif_document_details(
document_process, document_activity, document_type, document_format, document_path,
folio_id, transaction_reference_id, document_status, mime_type,
user_attr0, user_attr1, user_attr2, user_attr3, user_attr4,
user_attr5, user_attr6, user_attr7, user_attr8, user_attr9,
approval_status, approved_by, approved_on, comments, audit_code,
del_flag, last_update_tms, last_updated_by, creation_date, created_by,
page_count, client_id
) VALUES %VALUES%;
`;

export const SQL_SELECT_CLIENT_MASTER_BY_CODES = `
SELECT id, client_code FROM fund.client_master WHERE client_code = ANY($1::text[])
`;

export const SQL_DELETE_TEMP_IMAGES_1 = `
DELETE FROM public.temp_images_1;
`;

export const SQL_INSERT_TEMP_IMAGES_1 = `
INSERT INTO public.temp_images_1 (client_code, folio_number, IHNO)
SELECT DISTINCT
    cm.client_code,
    fo.folio_number,
    ts.user_attr5 AS ihno
  FROM trxn.aif_transaction_summary ts
  JOIN investor.aif_folio fo ON ts.client_id = fo.client_id AND ts.folio_id = fo.id
  JOIN fund.client_master cm ON cm.id = fo.client_id
  WHERE %WHERE_CLAUSE%
    AND ts.created_by = 'aifappendersvc'
    AND (ts.trxn_status != 'R' OR ts.trxn_status IS NULL);
`;

export const SQL_CREATE_TEMP_TRANSACTION_DATA = `
CREATE TEMPORARY TABLE temp_transaction_data (
  id_ihno TEXT NOT NULL,
  id_acno TEXT NOT NULL
) ON COMMIT DROP;
`;

export const SQL_INSERT_TEMP_TRANSACTION_DATA = `
INSERT INTO temp_transaction_data (id_ihno, id_acno)
VALUES %VALUES%;
`;

export const SQL_UPDATE_FOLIO_ID = `
WITH client_folio AS (
  SELECT folio_number, id, client_id,
  (SELECT cm.client_code FROM fund.client_master cm WHERE cm.id = client_id) AS client_code
  FROM investor.aif_folio
)
UPDATE investor.aif_document_details AS d
SET folio_id = cf.id
FROM client_folio AS cf
WHERE d.client_id = cf.client_id
  AND d.user_attr2 = cf.folio_number
  AND d.created_by = 'system'
  AND EXISTS (
    SELECT 1
    FROM temp_transaction_data AS ttd
    WHERE d.user_attr1 = ttd.id_ihno AND d.user_attr2 = ttd.id_acno
  )
  %WHERE_CLAUSE%
RETURNING d.user_attr1, d.user_attr2;
`;

export const SQL_UPDATE_TRANSACTION_REFERENCE_ID = `
UPDATE investor.aif_document_details AS d
SET transaction_reference_id = ts.transaction_number
FROM trxn.aif_transaction_summary AS ts
WHERE ts.client_id = d.client_id
  AND ts.folio_id = d.folio_id
  AND ts.user_attr5 = d.user_attr1
  AND d.created_by = 'system'
  AND (ts.trxn_status != 'R' OR ts.trxn_status IS NULL)
  AND ts.created_by = 'aifappendersvc'
  AND EXISTS (
    SELECT 1
    FROM temp_transaction_data AS ttd
    WHERE d.user_attr1 = ttd.id_ihno AND d.user_attr2 = ttd.id_acno
  )
  %WHERE_CLAUSE%
RETURNING d.user_attr1, d.user_attr2;
`;

export const SQL_SELECT_CLIENT_ID_BY_CODE = `
SELECT id FROM fund.client_master WHERE client_code = $1
`;

export const SQL_SELECT_AIF_DOCUMENT_DETAILS = `
SELECT
  add.document_process,
  add.document_activity,
  add.document_type,
  add.document_format,
  add.document_path,
  add.folio_id,
  add.transaction_reference_id,
  add.document_status,
  add.mime_type,
  add.user_attr0,
  add.user_attr1,
  add.user_attr2,
  add.user_attr3,
  add.user_attr4,
  add.user_attr5,
  add.user_attr6,
  add.user_attr7,
  add.user_attr8,
  add.user_attr9,
  add.approval_status,
  add.approved_by,
  add.approved_on,
  add.comments,
  add.audit_code,
  add.del_flag,
  add.last_update_tms,
  add.last_updated_by,
  add.creation_date,
  add.created_by,
  add.page_count,
  add.client_id,
  cm.client_code
FROM investor.aif_document_details add
JOIN fund.client_master cm ON add.client_id = cm.id
WHERE add.user_attr2 = ANY($1::text[]) %CLIENT_ID_CLAUSE%;
`;

export const SQL_SELECT_UPDATE_DETAILS = `
SELECT
  cm.client_code,
  add.user_attr1,
  add.transaction_reference_id
FROM investor.aif_document_details add
JOIN fund.client_master cm ON add.client_id = cm.id;
`;

export const SQL_STREAM_UPDATE_DETAILS = `
SELECT
  cm.client_code,
  add.user_attr1,
  add.transaction_reference_id
FROM investor.aif_document_details add
JOIN fund.client_master cm ON add.client_id = cm.id
WHERE add.created_by = 'system' %CLIENT_ID_CLAUSE%;
`;

// --- MongoDB Operations ---

export async function mongoFindOne(model: mongoose.Model<IAifDocument>): Promise<IAifDocument | null> {
  return model.findOne({}).lean();
}

export async function mongoInsertMany(model: mongoose.Model<IAifDocument>, documents: IAifDocumentInput[]): Promise<IAifDocument[]> {
  return model.insertMany(documents);
}

export async function mongoBulkWrite(model: mongoose.Model<IAifDocument>, operations: BulkWriteOperation<IAifDocument>[]): Promise<IBulkWriteResult> {
  return model.bulkWrite(operations);
}

export async function mongoFind(model: mongoose.Model<IAifDocument>, query: Record<string, unknown>): Promise<IAifDocument[]> {
  return model.find(query).lean();
}

export async function mongoAggregate(model: mongoose.Model<IAifDocument>, pipeline: PipelineStage[]): Promise<IAifDocument[]> {
  return model.aggregate(pipeline).exec();
}

// --- PostgreSQL Operations ---

export async function pgQuery(client: PoolClient, query: string, params: unknown[] = []): Promise<{ rows: unknown[] }> {
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
