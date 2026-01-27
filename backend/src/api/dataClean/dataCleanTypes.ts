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

// backend/src/api/duplicateProcessor/dataCleanTypes.ts (or similar)
export interface SanityCheckResult {
  // <--- Ensure 'export' is here
  result: "success" | "failed";
  dryRun: boolean;
  cutoffTms: string;
  logs: SqlLog[];
  rows?: DryRunResultRow[];
  imperfectDuplicates?: string[];
  totalDuplicatesFound?: number;
  deletedCount?: number;
}

export interface SanityCheckResponse {
  result: "success" | "failed";
  dryRun: boolean;
  cutoffTms: string;
  deletedCount?: number;
  rows?: DryRunResultRow[];
  logs: SqlLog[];
  imperfectDuplicates?: string[];
  totalDuplicatesFound?: number;
}

export interface DryRunResultRow extends SanityCheckRow {
  wouldBeDeleted: boolean;
  reason: string;
}

export interface ImperfectDuplicateRow {
  user_attr1: string;
  reason: string;
}

export interface SqlLog {
  row: number;
  status: "error" | "updated" | "info";
  message: string;
}

export interface MongoCountResult {
  count: number;
}

export interface MongoDuplicateGroupResult {
  _id: {
    clientId: string;
    transactionNo: string;
    modifiedDocumentPathNo: string;
    sourceUser: string;
  };
  count: number;
  documents: { _id: mongoose.Types.ObjectId; createdOnDate: Date }[];
}

export interface MongoDuplicateCheckResult {
  _id: { clientId: string; transactionNo: string };
  count: number;
  documents: { _id: mongoose.Types.ObjectId; createdOnDate: Date }[];
}
