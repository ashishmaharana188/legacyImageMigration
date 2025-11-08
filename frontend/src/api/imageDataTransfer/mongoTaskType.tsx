import { TaskLogUpdate } from '../../contexts/TaskLogContext';

export interface MongoTaskUIProps {
  loading: boolean;
  clientCode: string;
  setClientCode: (code: string) => void;
  handleTransferToMongo: (updateAll: boolean, clientCode: string) => Promise<void>;
  updateAllMongo: boolean;
  setUpdateAllMongo: (updateAllMongo: boolean) => void;
}

export interface UseMongoTaskHookProps {
  updateTaskLog: TaskLogUpdate;
  clearTaskLog: (task: string) => void;
}

export interface FileResponse {
  statusCode?: number;
  message?: string;
  originalFile?: string;
  processedFile?: string;
  nextContinuationToken?: string;
  summary?: {
    totalRows: number;
    successfulRows: number;
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
  transferredCount?: number;
  documents?: any[];
}

export interface MongoTransferSummaryLog {
  transferredCount?: number;
  documents?: any[];
  message?: string;
  status?: "success" | "failed";
}

export interface MongoDuplicateCheckSummaryLog {
  duplicates?: any[];
  totalDuplicateDocuments?: number;
  totalDuplicateGroups?: number;
  message?: string;
  status?: "success" | "failed";
}

export interface MongoTransactionsUpdateSummaryLog {
  updatedCount?: number;
  updatedDocuments?: any[];
  message?: string;
  status?: "success" | "failed";
}

export interface MongoSummaryDisplayProps {
  log: MongoTransferSummaryLog | MongoDuplicateCheckSummaryLog | MongoTransactionsUpdateSummaryLog;
}
