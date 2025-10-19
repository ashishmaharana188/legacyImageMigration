export interface SummaryItem {
  fileName: string;
  status: string;
}

export interface SplitCount {
  row: number;
  sourcePath: string;
  destinationPath: string;
  pageCount: number | string;
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
  errorMessage?: string;
}

export interface UploadProgressResponse {
  totalRows: number;
  processedRows: number;
  successfulRows: number;
  errors: number;
  notFound: number;
}

export interface FileResponseSummary {
  totalRows: number;
  successfulRows: number;
  errors: number;
  notFound: number;
  successfulInserts: number;
  unsuccessfulCount: number;
  totalPageCount: number;
  totalSplitImages: number;
}

export interface FileResponse {
  statusCode?: number;
  message?: string;
  originalFile?: string;
  processedFile?: string;
  nextContinuationToken?: string;
  summary?: FileResponseSummary;
  splitSummary?: {
    totalOriginalFilesProcessed: number;
    totalExpectedSplits: number;
    totalSplitFilesGenerated: number;
    splitErrors: number;
    totalExpectedPagesFromCsv: number;
    currentlySplittingFiles?: string;
  };
  downloadUrl?: string;
  fileUrls?: Array<{ row: number; url: string; pageCount: number }>;
  splitCount?: SplitCount[];
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

export interface TaskLogEntry {
  id: string;
  message: string;
  status: "success" | "failed" | "in-progress";
  totalRows?: number;
  successfulRows?: number;
  badRows?: number;
  splitSummary?: FileResponse['splitSummary'];
  // Add other properties from FileResponse if they are logged
  originalFile?: string;
  processedFile?: string;
  downloadUrl?: string;
  fileUrls?: Array<{ row: number; url: string; pageCount: number }>;
  splitCount?: SplitCount[];
  error?: string;
  directories?: string[];
  files?: unknown[];
  badRowsFilePath?: string | null;
  updatedFolioRows?: number;
  updatedTransactionRows?: number;
  successfulFilesCount?: number;
  failedFilesCount?: number;
}

export interface BadRow {
  rowNumber: string;
  id_fund: string;
  id_trtype: string;
  id_ihno: string;
  id_path: string;
  id_acno: string;
  page_count_status: string;
}
export interface UseUploadProcessorProps {
  updateTaskLog: (task: string, log: unknown) => void;
  clearTaskLog: (task: string) => void;
  setUploadStatuses: React.Dispatch<React.SetStateAction<UploadStatus[]>>;
}

export interface UploadProgressDisplayProps {
  title: string;
  progress?: number;
  total?: number;
  processed?: number;
  successful?: number;
  errors?: number;
  notFound?: number;
  badRowsDetails?: UploadStatus['badRowsDetails'];
  displayType?: "aggregate" | "default";
  unit?: string;
}
