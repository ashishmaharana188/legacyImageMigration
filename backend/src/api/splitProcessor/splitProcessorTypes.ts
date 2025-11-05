export interface SplitResult {
  splitFiles: SplitFileDetail[]; // Still keep this to return the list of successfully split files
  summary: {
    totalSplitFilesGenerated: number;
    splitErrors: number;
    totalExpectedPagesFromCsv: number;
  };
}

// Removed splitVerification as it's no longer needed for the final output

export interface SplitFileDetail {
  originalPath: string;
  splitPath: string;
  page: number;
}

export interface SplitProgressUpdate {
  type: "splitProgressUpdate";
  // Removed totalOriginalFilesProcessed and totalExpectedSplits
  totalSplitFilesGenerated: number;
  splitErrors: number;
  currentlySplittingFiles: string;
  status: string;
}

export interface SplitProgressComplete {
  type: "splitProgressComplete";
  // Removed totalOriginalFilesProcessed and totalExpectedSplits
  totalSplitFilesGenerated: number;
  splitErrors: number;
  totalExpectedPagesFromCsv: number;
  status: string;
}
