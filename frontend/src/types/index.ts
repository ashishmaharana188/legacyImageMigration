import { SanityCheckResponse } from '../api/dataClean/sanityCheckType';

export interface SummaryItem {
  fileName: string;
  status: string;
}

export interface UploadStatus {
  fileName: string;
  progress?: number;
  status?: string;
  isDirectory?: boolean;
  totalFiles?: number;
  processedFiles?: number;
  successfulFiles?: number;
  errorFiles?: number;
  notFoundFiles?: number;
}

export interface SplitSummaryLog {
  splitSummary: {
    totalOriginalFilesProcessed: number;
    totalExpectedSplits: number;
    totalSplitFilesGenerated: number;
    splitErrors: number;
    totalExpectedPagesFromCsv: number;
  };
  splitFiles: Array<{
    id_fund: string;
    id_ihno: string;
    id_acno: string;
    page_count?: string;
    split_count?: string;
  }>;
}

export interface FileUploadLog {
  originalFile: string;
  processedFile: string;
  fileUrls: Array<{
    row: number;
    pageCount: number;
  }>;
}

export interface SanityCheckLog {
  dryRun: boolean;
  cutoffTms: string;
  rows: Array<{
    user_attr1: string;
    client_id: string;
    creation_date: string;
  }>;
}

export interface SqlExecutionLog {
  totalRows: number;
  successfulRows: number;
  badRows: number;
  badRowsFilePath?: string;
  message: string;
  totalInserts?: number; // Added for SQL Execution Summary
}

export interface MongoTransferLog {
  transferredCount: number;
  documents: Array<{
    clientId: string;
    transactionNo: string;
    workDate: string;
  }>;
  message: string;
}

export interface FolioTransactionUpdateLog {
  updatedFolioRows: number;
  updatedTransactionRows: number;
  badRows: number;
  badRowsFilePath?: string;
  message: string;
}

export interface UploadProgressResponse {
  totalRows: number;
  processedRows: number;
  successfulRows: number;
  errors: number;
  notFound: number;
}

export interface FileResponseSummary {
  totalRows: number;
  successfulRows: number;
  errors: number;
  notFound: number;
  successfulInserts: number;
  unsuccessfulCount: number;
  totalPageCount: number;
}

export interface FileResponse {
  statusCode?: number;
  message?: string;
  originalFile?: string;
  processedFile?: string;
  nextContinuationToken?: string;
  summary?: FileResponseSummary;
  downloadUrl?: string;
  fileUrls?: Array<{ row: number; url: string; pageCount: number }>;
  error?: string;
  directories?: string[];
  files?: unknown[];
  badRowsFilePath?: string | null;
  updatedFolioRows?: number;
  updatedTransactionRows?: number;
  badRows?: number;
  successfulFilesCount?: number;
  failedFilesCount?: number;
}

export interface TaskLogEntry {
  id: string;
  message: string;
  status: "success" | "failed" | "in-progress";
  originalFile?: string;
  processedFile?: string;
  downloadUrl?: string;
  fileUrls?: Array<{ row: number; url: string; pageCount: number }>;
  error?: string;
  directories?: string[];
  files?: unknown[];
  badRowsFilePath?: string | null;
  successfulFilesCount?: number;
  failedFilesCount?: number;
}

export type LogEntry =
  | string
  | SplitSummaryLog
  | FileUploadLog
  | SanityCheckLog
  | SqlExecutionLog
  | MongoTransferLog
  | FolioTransactionUpdateLog
  | TaskLogEntry
  | FileResponse
  | UploadProgressResponse
  | SanityCheckResponse;

export interface S3UploadProgress {
  processedDirectories: number;
  totalDirectories: number;
  currentDirectory: string;
}

export interface TaskLogContextType {
  taskLogs: { [key: string]: LogEntry[] };
  uploadStatuses: UploadStatus[];
  updateTaskLog: (taskKey: string, log: LogEntry) => void;
  onClearLogs: (taskKey: string) => void;
  setSummaryData: React.Dispatch<React.SetStateAction<{ [key: string]: LogEntry[]; }>>;
  setUploadStatuses: React.Dispatch<React.SetStateAction<UploadStatus[]>>;
}