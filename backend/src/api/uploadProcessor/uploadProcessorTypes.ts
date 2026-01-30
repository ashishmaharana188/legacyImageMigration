export interface ProcessedRow {
  id_fund: string;
  id_trtype: string;
  id_ihno: string;
  id_path: string;
  id_acno: string;
  page_count: number | string;
  status?: "success" | "error" | "not-found";
  [key: string]: unknown;
}

export interface ProcessedSummary {
  totalRows: number;
  successfulRows: number;
  errors: number;
  notFound: number;
}

export interface ProcessExcelRowsResult extends ProcessedSummary {
  processedRows: ProcessedRow[];
}

export interface ProcessedExcelFileResult {
  outputFileName: string;
  summary: ProcessedSummary;
  processedRows: ProcessedRow[];
}
