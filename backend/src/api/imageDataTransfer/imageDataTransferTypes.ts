// backend/src/api/imageDataTransfer/imageDataTransferTypes.ts

import mongoose, { Document } from "mongoose";

export interface SqlLog {
  row: number;
  status: "error" | "updated" | "info" | "success" | "executed";
  message: string;
  sql?: string;
}

export interface AifDocumentDetail {
  activity_status: string;
  application_id: string | null;
  client_code: string;
  created_by: string;
  creation_date: string;
  current_stage: number;
  document_format: string;
  document_path: string;
  document_size: string;
  document_type: string;
  last_updated_from: string | null;
  mime_type: string;
  document_process: string;
  source_user: string;
  total_page_count: number | null;
  transaction_reference_id: string;
  user_attr1: string; // Added for update details
}

export interface IAifDocumentInput {
  activityStatus: string;
  applicationId: string | null;
  clientId: string;
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

export interface IAifDocument extends Document, IAifDocumentInput {}

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
  // Add other properties if needed, e.g., insertedCount, upsertedCount, etc.
}
