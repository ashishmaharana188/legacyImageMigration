export interface SummaryItem {
  fileName: string;
  status: string;
}

export interface SplitFile {
  originalPath: string;
  url: string;
  page: number;
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
  totalOriginalFilesProcessed?: number;
  totalExpectedSplits?: number;
  totalSplitFilesGenerated?: number;
  splitErrors?: number;
  totalExpectedPagesFromCsv?: number;
  currentlySplittingFiles?: string;
}

export interface UploadProgressResponse {
  totalRows: number;
  processedRows: number;
  successfulRows: number;
  errors: number;
  notFound: number;
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
  splitFiles?: SplitFile[];
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

export interface SplitFileResponse extends FileResponse {
  splitFiles: SplitFile[];
  message: string;
}

export interface RequestConfig {
  endpoint: string;
  selectedFile: File;
  updateTaskLog: (task: string, log: unknown) => void;
  setUploadMessage: React.Dispatch<React.SetStateAction<string>>;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  logId: string;
  operationName: string;
  setUploadStatuses?: React.Dispatch<React.SetStateAction<UploadStatus[]>>;
  setIsUploading?: React.Dispatch<React.SetStateAction<boolean>>;
}
