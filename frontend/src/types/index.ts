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
  badRowsDetails?: Array<{
    rowNumber: number;
    id_fund: string;
    id_trtype: string;
    id_ihno: string;
    id_path: string;
    id_acno: string;
    page_count_status: string | number;
  }>;
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

export type TaskLog =
  | string
  | SplitSummaryLog
  | FileUploadLog
  | SanityCheckLog
  | SqlExecutionLog
  | MongoTransferLog
  | FolioTransactionUpdateLog;

export interface S3UploadProgress {
  processed: number;
  total: number;
}
