import { Document, Types } from "mongoose";

export interface SqlLog {
  row: number;
  status: "error" | "updated" | "info" | "success" | "executed";
  message: string;
  sql?: string;
}

// [FIX] Expanded interface to match actual SQL return columns
export interface AifDocumentDetail {
  activity_status?: string; // Optional as it might be mapped
  application_id: string | null;
  client_id: number; // [Added]
  client_code: string;
  created_by: string;
  creation_date: string;
  current_stage?: number;
  document_format: string;
  document_path: string;
  document_size?: string;
  document_type: string;
  last_updated_from?: string | null;
  last_updated_by?: string; // [Added]
  last_update_tms?: string; // [Added]
  mime_type: string;
  document_process: string;
  document_activity?: string; // [Added]
  source_user?: string;
  total_page_count?: number | string | null;
  page_count?: number | string | null; // [Added] (SQL often returns this)
  transaction_reference_id: string;
  folio_id?: number | null; // [Added]
  document_status?: string; // [Added]

  // [Added] Missing User Attributes
  user_attr0?: string | null;
  user_attr1: string;
  user_attr2?: string | null;
  user_attr3?: string | null;
  user_attr4?: string | null;
  user_attr5?: string | null;
  user_attr6?: string | null;
  user_attr7?: string | null;
  user_attr8?: string | null;
  user_attr9?: string | null;

  // [Added] Missing Audit/Approval fields
  approval_status?: string | null;
  approved_by?: string | null;
  approved_on?: string | null;
  comments?: string | null;
  audit_code?: string | null;
  del_flag?: boolean;
}

// Pure Data Interface
export interface IAifDocumentInput {
  _id?: Types.ObjectId | string;
  activityStatus: string;
  barcode?: string;
  applicationId: string | null;
  clientId: string;
  branchId?: string;
  createdBy: string;
  createdFrom: string;
  createdOn: string;
  currentStage: number;
  documentFormat: string;
  documentPath: string;
  documentSize: string;
  documentType: string;
  lastUpdatedBy: string;
  lastUpdatedFrom: string | null;
  lastUpdatedOn: string;
  mimeType: string;
  processCode: string;
  sourceUser: string;
  totalPageCount: number | null;
  transactionCode: string;
  transactionNo: string;
  transactionType: string;
  workDate: string;
}

// Mongoose Document Interface
export interface IAifDocument
  extends Document, Omit<IAifDocumentInput, "_id"> {}

export interface IUpdatedDocumentSummary {
  clientId: string;
  oldTransactionNo: string;
  newTransactionNo: string;
  documentType: string;
  processCode: string;
}

export interface ISyncedDocumentSummary {
  clientId: string;
  transactionNo: string;
}

export interface IBulkWriteResult {
  modifiedCount: number;
  insertedCount: number;
  matchedCount: number;
  deletedCount: number;
  upsertedCount: number;
}

export interface ImageDataProgress {
  type: "sqlProgressUpdate" | "mongoProgressUpdate";
  subTask: "executeSql" | "updateFolio" | "transferMongo" | "syncMongo";
  total: number;
  processed: number;
  // [FIX] Added 'Warning' to allowed statuses
  status: "Running" | "Completed" | "Error" | "Warning";
  message?: string;
  metrics?: {
    inserted?: number;
    updated?: number;
    folioUpdated?: number;
    txnUpdated?: number;
    synced?: number;
    failed?: number;
  };
}

export interface MongoTransferResult {
  insertedCount: number;
  transactionNumbers: string[];
  excelPath?: string;
}
