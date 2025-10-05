import { PoolClient, Pool } from "pg";

export interface SqlLog {
  row: number;
  status: "success" | "error" | "executed" | "updated";
  message: string;
  sql?: string;
}

export interface SanityCheckRow {
  id: number;
  document_process: string;
  document_activity: string;
  document_type: string;
  document_format: string;
  document_path: string;
  folio_id: number | null;
  transaction_reference_id: string | null;
  document_status: string;
  mime_type: string;
  user_attr0: string | null;
  user_attr1: string | null;
  user_attr2: string | null;
  user_attr3: string | null;
  user_attr4: string | null;
  user_attr5: string | null;
  user_attr6: string | null;
  user_attr7: string | null;
  user_attr8: string | null;
  user_attr9: string | null;
  approval_status: string | null;
  approved_by: string | null;
  approved_on: Date | null;
  comments: string | null;
  audit_code: string | null;
  del_flag: boolean;
  last_update_tms: Date;
  last_updated_by: string;
  creation_date: Date;
  created_by: string;
  page_count: number;
  client_id: number;
  rn: number | null; // For ranked duplicates
  reason: string;
}

export interface DryRunResultRow {
  id: number;
  client_id: number;
  user_attr1_normalized: string;
  user_attr1: string;
  user_attr2: string;
  creation_date: string;
  folio_id: string | null;
  transaction_reference_id: string | null;
  isPerfect: boolean;
  wouldBeDeleted: boolean;
  reason: string; // To explain why it would be deleted or is imperfect
}

export interface ImperfectDuplicateRow {
  user_attr1: string;
}
