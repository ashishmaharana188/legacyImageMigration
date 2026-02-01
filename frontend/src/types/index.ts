export interface UploadStatus {
  fileName: string;
  status: string;
  progress: number;
}

export interface LogEntry {
  id: string;
  status?: string;
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
}

export interface S3UploadProgress {
  processedDirectories: number;
  totalDirectories: number;
  currentDirectory: string;
}

export interface TaskLogContextType {
  taskLogs: { [key: string]: LogEntry[] };
  uploadStatuses: UploadStatus[];
  // [REMOVED] activeProgress: ... (This was the cause of the bug)

  updateTaskLog: (taskKey: string, log: LogEntry) => void;
  onClearLogs: (taskKey: string) => void;
  setSummaryData: React.Dispatch<
    React.SetStateAction<{ [key: string]: LogEntry[] }>
  >;
  setUploadStatuses: React.Dispatch<React.SetStateAction<UploadStatus[]>>;
}
