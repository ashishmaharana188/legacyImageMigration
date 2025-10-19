export interface ProcessedRow {
  // Fields used in all push operations in uploadExcelProcessor.ts and created in createProcessedExcelFile
  id_fund: string;
  id_trtype: string;
  id_ihno: string;
  id_path: string;
  id_acno: string;
  page_count: number | string;
  // Make 'status' optional to fix the TS2345 error in uploadExcelProcessor.ts
  status?: "success" | "error" | "not-found";
  [key: string]: unknown; // Keep index signature for flexibility
}

export interface ProcessedSummary {
  totalRows: number;
  successfulRows: number;
  errors: number;
  notFound: number;
}

export interface ProcessExcelRowsResult extends ProcessedSummary {
  // Added properties to match the required return from processExcelRows
  processedRows: ProcessedRow[];
}

export interface SplitCount {
  row: number;
  sourcePath: string;
  destinationPath: string;
  pageCount: number | string;
}

export interface ProcessExcelRowsResult extends ProcessedSummary {
  // Added properties to match the required return from processExcelRows
  processedRows: ProcessedRow[];
  splitCount: SplitCount[];
}

export interface ProcessedExcelFileResult {
  outputFileName: string;
  summary: ProcessedSummary;
  processedRows: ProcessedRow[];
  splitCount: SplitCount[];
}

export interface RequestConfig {
  endpoint: string;
  selectedFile: File;
  updateTaskLog: (task: string, log: unknown) => void;
  setUploadMessage: React.Dispatch<React.SetStateAction<string>>;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  logId: string;
  operationName: string;
  setUploadStatuses?: React.Dispatch<React.SetStateAction<[]>>;
  setIsUploading?: React.Dispatch<React.SetStateAction<boolean>>;
}
