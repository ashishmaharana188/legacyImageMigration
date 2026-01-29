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
  taskKey: "splitFiles"; // CRITICAL: Routes message to the correct sidebar section
  totalSplitFilesGenerated: number;
  splitErrors: number;
  totalExpectedPagesFromCsv: number;
  currentlySplittingFiles: string; // FIXED: Added to resolve Error 2353
  status: string;
}

export interface SplitProgressComplete {
  type: "splitProgressComplete";
  taskKey: "splitFiles"; // CRITICAL: Routes completion message
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
  summary?: SplitSummary; // Keep for backward compatibility
  error?: string;
  details?: string;
}

// Ensure UploadStatus is also exported if it resides here
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
  splitSummary?: SplitSummary; // Optional field for splitting tasks
}
