import { TaskLogContextType } from '../../types/index';

export interface SQLTaskUIProps {
  loading: boolean;
  handleGenerateSql: () => Promise<void>;
  handleExecuteSql: () => Promise<void>;
  handleUpdateFolioAndTransaction: (updateAll: boolean) => Promise<void>;
  handleReconnect: () => Promise<void>;
  updateAll: boolean;
  setUpdateAll: (updateAll: boolean) => void;
}

export interface UseSQLTaskHookProps {
  updateTaskLog: TaskLogContextType['updateTaskLog'];
  clearTaskLog: (task: string) => void;
}

export interface FileResponse {
  statusCode?: number;
  message?: string;
  originalFile?: string;
  processedFile?: string;
  nextContinuationToken?: string;
  totalRows?: number;
  successfulRows?: number;
  badRows?: number;
  summary?: {
    errors: number;
    notFound: number;
    successfulInserts: number;
    unsuccessfulCount: number;
    totalPageCount: number;
    totalSplitImages: number;
    badRowsFilePath?: string | null;
  };
  splitSummary?: {
    totalOriginalFilesProcessed: number;
    totalExpectedSplits: number;
    totalSplitFilesGenerated: number;
    splitErrors: number;
    totalExpectedPagesFromCsv: number;
  };
  downloadUrl?: string;
  fileUrls?: Array<{ row: number; url: string; pageCount: number }>;
  error?: string;
  updatedFolioRows?: number;
  updatedTransactionRows?: number;
}

export interface SQLExecutionSummaryLog {
  successfulRows?: number;
  badRows?: number;
  totalRows?: number;
  message?: string;
  status?: "success" | "failed";
  badRowsFilePath?: string | null;
}

export interface FolioTransactionUpdateSummaryLog {
  updatedFolioRows?: number;
  updatedTransactionRows?: number;
  badRows?: number;
  message?: string;
  status?: "success" | "failed";
}

export interface SQLSummaryDisplayProps {
  log: SQLExecutionSummaryLog | FolioTransactionUpdateSummaryLog;
  logKey: string;
  expandedLogId: string | null;
  toggleBadRowsDisplay: (filePath: string, logId: string) => void;
}
