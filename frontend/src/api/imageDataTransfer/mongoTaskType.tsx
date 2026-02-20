import { TaskLogContextType } from "../../types/index";

export interface MongoTaskUIProps {
  loading: boolean;

  clientCode: string;
    setClientCode: (code: string) => void;
    useCsv: boolean;
      setUseCsv: (val: boolean) => void;

  // [FIX] This matches the hook signature
  handleTransferToMongo: (clientCode: string) => Promise<void>;
}

export interface UseMongoTaskHookProps {
  updateTaskLog: TaskLogContextType["updateTaskLog"];
  clearTaskLog: (task: string) => void;
}

// [FIX] Exporting this interface so Service can use it
export interface TransferResponse {
  message: string;
  transferredCount?: number;
  error?: string;
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
  documents?: unknown[];
}

export interface MongoTransferSummaryLog {
  transferredCount?: number;
  documents?: MongoDocument[];
  message?: string;
  status?: "success" | "failed";
}

export interface MongoDocument {
  _id: string;
  clientCode: string;
  status: string;
}

export interface MongoDuplicateCheckSummaryLog {
  duplicates?: unknown;
  totalDuplicateDocuments?: number;
  totalDuplicateGroups?: number;
  message?: string;
  status?: "success" | "failed";
}

export interface MongoTransactionsUpdateSummaryLog {
  updatedCount?: number;
  updatedDocuments?: MongoUpdatedDocument[];
  message?: string;
  status?: "success" | "failed";
}

export interface MongoUpdatedDocument {
  _id: string;
  clientCode: string;
  oldTransactionId: string;
  newTransactionId: string;
}

export interface MongoSummaryDisplayProps {
  log:
    | MongoTransferSummaryLog
    | MongoDuplicateCheckSummaryLog
    | MongoTransactionsUpdateSummaryLog;
}
