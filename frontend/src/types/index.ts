import { SanityCheckResponse } from "../api/dataClean/sanityCheckType";

// 1. Define the specific shape for Split Summary
export interface SplitSummary {
  totalSplitFilesGenerated: number;
  splitErrors: number;
  totalExpectedPagesFromCsv: number;
}

// 2. Define generic Upload Status
export interface UploadStatus {
  fileName: string;
  progress: number; // FIXED: Removed '?' to make it required (must be 0-100)
  status: string; // FIXED: Removed '?' to make it required
  isDirectory?: boolean;
  totalFiles?: number;
  processedFiles?: number;
  successfulFiles?: number;
  errorFiles?: number;
  notFoundFiles?: number;
  splitSummary?: SplitSummary;
  errorMessage?: string;
}

// 3. A Single, Flexible LogEntry Interface
export interface LogEntry {
  // Common Fields
  id?: string;
  message?: string;
  status?: string;
  timestamp?: number;
  fileName?: string;

  // Split Processor Specifics
  splitSummary?: SplitSummary;

  // Upload/Excel Specifics
  progress?: number;
  totalFiles?: number;
  processedFiles?: number;
  successfulFiles?: number;
  errorFiles?: number;
  notFoundFiles?: number;

  // Execution Summary (SQL/Mongo)
  totalRows?: number;
  successfulRows?: number;
  badRows?: number;
  badRowsFilePath?: string;

  // Mongo Specifics
  transferredCount?: number;
  documents?: any[];
  updatedCount?: number;
  updatedDocuments?: any[];

  // Folio/Transaction Updates
  updatedFolioRows?: number;
  updatedTransactionRows?: number;

  // Sanity Check
  dryRun?: boolean;
  duplicates?: any[];

  // File Details
  originalFile?: string;
  processedFile?: string;
  fileUrls?: Array<{ row: number; pageCount: number }>;
  downloadUrl?: string;

  // Index signature
  [key: string]: any;
}

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
  setSummaryData: React.Dispatch<
    React.SetStateAction<{ [key: string]: LogEntry[] }>
  >;
  setUploadStatuses: React.Dispatch<React.SetStateAction<UploadStatus[]>>;
}
