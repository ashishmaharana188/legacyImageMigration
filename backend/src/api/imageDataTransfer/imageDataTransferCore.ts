import { PoolClient } from "pg";
import mongoose, { PipelineStage, BulkWriteOperation } from "mongoose";
import {
  IAifDocument,
  IAifDocumentInput,
  IBulkWriteResult,
} from "./imageDataTransferTypes";

// --- SQL Queries ---

// [EXISTING] Specific Update Queries (Safely Filtered)
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

export const SQL_SELECT_CLIENT_MASTER_BY_CODES = `SELECT id, client_code FROM fund.client_master WHERE client_code = ANY($1::text[])`;
export const SQL_DELETE_TEMP_IMAGES_1 = `DELETE FROM temp_images_1;`;

export const SQL_INSERT_TEMP_IMAGES_1 = `
INSERT INTO public.temp_images_1 (client_code, folio_number, IHNO)
SELECT DISTINCT cm.client_code, fo.folio_number, ts.user_attr5 AS ihno
FROM trxn.aif_transaction_summary ts
JOIN investor.aif_folio fo ON ts.client_id = fo.client_id AND ts.folio_id = fo.id
JOIN fund.client_master cm ON cm.id = fo.client_id
WHERE fo.folio_number = ANY($1::text[]) 
  AND ts.created_by = 'aifappendersvc' 
  AND (ts.trxn_status != 'R' OR ts.trxn_status IS NULL);
`;

export const SQL_CREATE_TEMP_TRANSACTION_DATA = `CREATE TEMPORARY TABLE temp_transaction_data (id_ihno TEXT NOT NULL, id_acno TEXT NOT NULL) ON COMMIT DROP;`;
export const SQL_INSERT_TEMP_TRANSACTION_DATA = `INSERT INTO temp_transaction_data (id_ihno, id_acno) VALUES %VALUES%;`;

export const SQL_UPDATE_FOLIO_ID = `
WITH client_folio AS (
  SELECT folio_number, id, client_id, (SELECT cm.client_code FROM fund.client_master cm WHERE cm.id = client_id) AS client_code
  FROM investor.aif_folio
)
UPDATE investor.aif_document_details AS d SET folio_id = cf.id FROM client_folio AS cf
WHERE d.client_id = cf.client_id AND d.user_attr2 = cf.folio_number AND d.created_by = 'system'
  AND EXISTS (SELECT 1 FROM temp_transaction_data AS ttd WHERE d.user_attr1 = ttd.id_ihno AND d.user_attr2 = ttd.id_acno)
  AND d.user_attr2 = ANY($1::text[])
RETURNING d.user_attr1, d.user_attr2;
`;

export const SQL_UPDATE_TRANSACTION_REFERENCE_ID = `
UPDATE investor.aif_document_details AS d 
SET 
    transaction_reference_id = ts.transaction_number,
    folio_id = ts.folio_id 
FROM trxn.aif_transaction_summary AS ts
WHERE ts.client_id = d.client_id 
  AND ts.user_attr5 = d.user_attr1 
  AND d.created_by = 'system' 
  AND (ts.trxn_status != 'R' OR ts.trxn_status IS NULL) 
  AND ts.created_by = 'aifappendersvc'
  AND EXISTS (SELECT 1 FROM temp_transaction_data AS ttd WHERE d.user_attr1 = ttd.id_ihno AND d.user_attr2 = ttd.id_acno)
  AND d.user_attr2 = ANY($1::text[])
RETURNING d.user_attr1, d.user_attr2;
`;

// [NEW] Update All Queries (As requested)
export const SQL_INSERT_ALL_TEMP_IMAGES = `
INSERT INTO temp_images_1 (client_code, folio_number, IHNO)
SELECT client_code, folio_number, IHNO
FROM (
    SELECT DISTINCT
        cm.client_code,
        fo.folio_number,
        ts.user_attr5 AS ihno
    FROM
        trxn.aif_transaction_summary ts
    JOIN
        investor.aif_folio fo ON ts.client_id = fo.client_id AND ts.folio_id = fo.id
    JOIN
        fund.client_master cm ON cm.id = fo.client_id
    WHERE
        ts.created_by = 'aifappendersvc'
        AND (ts.trxn_status != 'R' OR ts.trxn_status IS NULL)
) AS cte;
`;

export const SQL_UPDATE_ALL_TRXN_REF = `
UPDATE investor.aif_document_details AS d
SET transaction_reference_id = ts.transaction_number
FROM trxn.aif_transaction_summary AS ts
WHERE ts.client_id = d.client_id
  AND ts.folio_id = d.folio_id
  AND ts.user_attr5 = d.user_attr1
  AND d.created_by = 'system'
  AND (ts.trxn_status != 'R' OR ts.trxn_status IS NULL)
  AND ts.created_by='aifappendersvc';
`;

export const SQL_UPDATE_ALL_FOLIO_ID = `
UPDATE investor.aif_document_details AS d
SET FOLIO_ID=af.id
FROM INVESTOR.AIF_FOLIO AF
WHERE af.folio_number=d.user_attr2
AND d.client_id=af.client_id
AND d.created_by='system'
AND d.user_attr2 IS NOT NULL;
`;

export const SQL_SELECT_CLIENT_ID_BY_CODE = `SELECT id FROM fund.client_master WHERE client_code = $1`;
export const SQL_SELECT_AIF_DOCUMENT_DETAILS = `
SELECT add.*, cm.client_code
FROM investor.aif_document_details add
JOIN fund.client_master cm ON add.client_id = cm.id
WHERE add.user_attr2 = ANY($1::text[]) %CLIENT_ID_CLAUSE%;
`;
export const SQL_STREAM_UPDATE_DETAILS = `
SELECT cm.client_code, add.user_attr1, add.transaction_reference_id
FROM investor.aif_document_details add
JOIN fund.client_master cm ON add.client_id = cm.id
WHERE add.created_by = 'system' %CLIENT_ID_CLAUSE%;
`;

// --- MongoDB Operations ---
export async function mongoFindOne(
  model: mongoose.Model<IAifDocument>
): Promise<IAifDocumentInput | null> {
  return model.findOne({}).lean() as unknown as IAifDocumentInput | null;
}

export async function mongoInsertMany(
  model: mongoose.Model<IAifDocument>,
  documents: IAifDocumentInput[]
): Promise<IAifDocument[]> {
  return model.insertMany(documents);
}

export async function mongoBulkWrite(
  model: mongoose.Model<IAifDocument>,
  operations: BulkWriteOperation<IAifDocument>[]
): Promise<IBulkWriteResult> {
  return model.bulkWrite(operations) as unknown as IBulkWriteResult;
}

export async function mongoFind(
  model: mongoose.Model<IAifDocument>,
  query: Record<string, unknown>
): Promise<IAifDocumentInput[]> {
  return model.find(query).lean() as unknown as IAifDocumentInput[];
}

export async function mongoAggregate(
  model: mongoose.Model<IAifDocument>,
  pipeline: PipelineStage[]
): Promise<IAifDocumentInput[]> {
  return model.aggregate(pipeline).exec() as unknown as IAifDocumentInput[];
}

// --- PostgreSQL Operations ---
export async function pgQuery(
  client: PoolClient,
  query: string,
  params: unknown[] = []
): Promise<{ rows: unknown[]; rowCount?: number }> {
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
