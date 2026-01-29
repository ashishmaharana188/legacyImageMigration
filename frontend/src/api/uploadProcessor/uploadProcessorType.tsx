import { LogEntry } from "../../types";

export interface FileResponseSummary {
  totalRows: number;
  successfulRows: number;
  errors: number;
  notFound: number;
}

export interface FileResponse {
  message?: string;
  summary?: FileResponseSummary;
  successfulFilesCount?: number;
  failedFilesCount?: number;
}

export interface UploadStatus {
  fileName: string;
  status: string;
  progress: number;
  isDirectory?: boolean;
  totalFiles?: number;
  processedFiles?: number;
  successfulFiles?: number;
  errorFiles?: number;
  notFoundFiles?: number;
  errorMessage?: string;
  badRowsDetails?: Array<{
    rowNumber: number;
    id_fund: string;
    id_trtype: string;
    id_ihno: string;
    id_path: string;
    id_acno: string;
    page_count_status: string | number;
  }>;
}

export interface useUploadProcessorProps {
  updateTaskLog: (task: string, log: unknown) => void;
  clearTaskLog: (task: string) => void;
  setUploadStatuses: React.Dispatch<React.SetStateAction<UploadStatus[]>>;
}

export interface uploadProcessorUIProps {
  selectedFile: File | null;
  uploadMessage: string;
  loading: boolean;
  isUploading: boolean;
  handleFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleUpload: () => Promise<void>;
  handleFallback: () => Promise<void>;
}
