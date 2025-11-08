import mongoose from "mongoose";

export interface SanityCheckRow {
  id: number;
  client_id: number;
  user_attr1_normalized: string;
  user_attr1: string;
  user_attr2: string;
  creation_date: Date;
  folio_id: number | null;
  transaction_reference_id: number | null;
  is_perfect: boolean;
  perfect_rows_in_group: number;
  rn_desc: number;
  total_rows_in_group: number;
}

export interface DryRunResultRow extends SanityCheckRow {
  wouldBeDeleted: boolean;
  reason: string;
}

export interface ImperfectDuplicateRow {
  user_attr1: string;
  reason: string;
}

export interface MongoDuplicateCheckResult {
  _id: { clientId: string; transactionNo: string };
  count: number;
  documents: { _id: mongoose.Types.ObjectId; createdOnDate: Date }[];
}
