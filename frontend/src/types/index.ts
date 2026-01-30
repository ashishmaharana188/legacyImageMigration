import { SanityCheckResponse } from "../api/dataClean/sanityCheckType";

// 1. Split Summary
export interface SplitSummary {
  totalSplitFilesGenerated: number;
  splitErrors: number;
  totalExpectedPagesFromCsv: number;
}

// 2. Upload Status
export interface UploadStatus {
  fileName: string;
  progress: number;
  status: string;
  isDirectory?: boolean;
  totalFiles?: number;
  processedFiles?: number;
  successfulFiles?: number;
  errorFiles?: number;
  notFoundFiles?: number;
  splitSummary?: SplitSummary;
  errorMessage?: string;
}

// 3. Log Entry
export interface LogEntry {
  id?: string;
  message?: string;
  status?: string;
  timestamp?: number;
  fileName?: string;
  splitSummary?: SplitSummary;
  progress?: number;
  totalFiles?: number;
  processedFiles?: number;
  successfulFiles?: number;
  errorFiles?: number;
  notFoundFiles?: number;
  totalRows?: number;
  successfulRows?: number;
  badRows?: number;
  badRowsFilePath?: string;
  transferredCount?: number;
  documents?: any[];
  updatedCount?: number;
  updatedDocuments?: any[];
  updatedFolioRows?: number;
  updatedTransactionRows?: number;
  dryRun?: boolean;
  duplicates?: any[];
  originalFile?: string;
  processedFile?: string;
  fileUrls?: Array<{ row: number; pageCount: number }>;
  downloadUrl?: string;
  [key: string]: any;
}

export interface S3UploadProgress {
  processedDirectories: number;
  totalDirectories: number;
  currentDirectory: string;
}

// 4. [CRITICAL] Context Definition with activeProgress
export interface TaskLogContextType {
  taskLogs: { [key: string]: LogEntry[] };
  uploadStatuses: UploadStatus[];
  // The Fast Lane
  activeProgress: {
    total: number;
    success: number;
    failure: number;
    percent: number;
  };
  updateTaskLog: (taskKey: string, log: LogEntry) => void;
  onClearLogs: (taskKey: string) => void;
  setSummaryData: React.Dispatch<
    React.SetStateAction<{ [key: string]: LogEntry[] }>
  >;
  setUploadStatuses: React.Dispatch<React.SetStateAction<UploadStatus[]>>;
}
