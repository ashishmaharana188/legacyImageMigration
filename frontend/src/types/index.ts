export interface UploadStatus {
  fileName: string;
  status: string;
  progress: number;
  id?: number;
  jobId?: string;
  folderId?: string;
  uploadKind?: string;
  currentDirectory?: string;
  totalDirectories?: number;
  processedDirectories?: number;
  folderIndex?: number;
  totalFolders?: number;
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
  type?: string;
  message?: string;
  timestamp?: string;
  processedRows?: number;
  progress?: number;
  totalRows?: number;
  successfulRows?: number;
  errors?: number;
  notFound?: number;

  // [STEP 4] Added for detailed metrics display
  totalDuplicates?: number;
  metrics?: {
    // Sanity Check
    imperfectVsPerfect?: number;
    olderVersions?: number;
    olderImperfects?: number;
    duplicates?: number;

    // Image Data Transfer
    folioUpdated?: number;
    txnUpdated?: number;
    inserted?: number;
    synced?: number;
    failed?: number;

    [key: string]: number | undefined;
  };
  rows?: any[];
  result?: string;
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
