export interface SplitResult {
  summary: {
    totalSplitFilesGenerated: number;
    splitErrors: number;
    totalExpectedPagesFromCsv: number;
  };
}

export interface SplitFileDetail {
  originalPath: string;
  splitPath: string;
  page: number;
}

export interface SplitProgressUpdate {
  type: "splitProgressUpdate";
  taskKey: "splitFiles";
  totalSplitFilesGenerated: number;
  splitErrors: number;
  // [FIX] Made optional as the worker might not have global context
  totalExpectedPagesFromCsv?: number;
  // [FIX] Made optional to be flexible
  currentlySplittingFiles?: string;
  // [FIX] Added 'message' to resolve Error 2353
  message?: string;
  status: string;
}

export interface SplitProgressComplete {
  type: "splitProgressComplete";
  taskKey: "splitFiles";
  totalSplitFilesGenerated: number;
  splitErrors: number;
  totalExpectedPagesFromCsv: number;
  status: string;
}

export interface SplitSummary {
  totalSplitFilesGenerated: number;
  splitErrors: number;
  totalExpectedPagesFromCsv: number;
}

export interface SplitFileResponse {
  statusCode: number;
  message: string;
  splitSummary?: SplitSummary;
  summary?: SplitSummary;
  error?: string;
  details?: string;
}

export interface UploadStatus {
  fileName: string;
  status: string;
  progress: number;
  totalFiles?: number;
  processedFiles?: number;
  successfulFiles?: number;
  errorFiles?: number;
  notFoundFiles?: number;
  errorMessage?: string;
  splitSummary?: SplitSummary;
}
