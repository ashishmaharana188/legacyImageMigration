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
  outputFileName?: string; // Added to match controller response
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
}

// FIX: Added missing RequestConfig interface
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
