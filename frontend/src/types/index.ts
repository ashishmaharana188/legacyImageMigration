export interface UploadStatus {
  fileName: string;
  status: string;
  progress: number;
  id?: number;
  totalFiles?: number;
  processedFiles?: number;
  successfulFiles?: number;
  errorFiles?: number;
  errorMessage?: string;
  error?: string;
}

export interface LogEntry {
  id: string;
  status?: string;
  completed?: number;
  total?: number;
  message?: string;
  timestamp?: string;

  // Progress specific fields
  totalRows?: number;
  processedRows?: number;
  successfulRows?: number;
  errors?: number;
  notFound?: number;
  progress?: number;
  duplicates?: number;

  // Split specific fields
  splitSummary?: {
    totalSplitFilesGenerated: number;
    splitErrors: number;
    totalExpectedPagesFromCsv: number;
  };

  // [FIX] Added missing fields for SQL/Mongo WebSocket support
  subTask?: string;
  metrics?: {
    inserted?: number;
    updated?: number;
    folioUpdated?: number; // [NEW]
    txnUpdated?: number; // [NEW]
    synced?: number;
    failed?: number;
  };
  badRowsFilePath?: string;
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
