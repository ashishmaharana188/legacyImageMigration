
export interface SplitFile {
  originalPath: string;
  splitPath: string;
  page: number;
}

export interface splitVerification {
  id_ihno: string;
  id_acno: string;
  id_fund: string;
  status: string;
  page_count: number | null;
  split_count: number;
}

export interface SplitResult {
  splitFiles: (SplitFile | splitVerification)[];
  summary: {
    totalOriginalFilesProcessed: number;
    totalExpectedSplits: number; // Re-added: Internal count of expected splits
    totalSplitFilesGenerated: number;
    splitErrors: number;
    totalExpectedPagesFromCsv: number; // New field for total expected pages from CSV
  };
}
