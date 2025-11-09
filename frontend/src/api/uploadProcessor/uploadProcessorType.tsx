import { UploadStatus, SummaryItem, LogEntry, UploadProgressResponse, FileResponse, TaskLogEntry } from '../../types';

export interface uploadProcessorUIProps {
  selectedFile: File | null;
  uploadMessage: string;
  loading: boolean;
  isUploading: boolean;
  handleFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleUpload: () => Promise<void>;
  handleFallback: () => Promise<void>;
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

export interface BadRow {
  rowNumber: string;
  id_fund: string;
  id_trtype: string;
  id_ihno: string;
  id_path: string;
  id_acno: string;
  page_count_status: string;
}
export interface useUploadProcessorProps {
  updateTaskLog: (task: string, log: unknown) => void;
  clearTaskLog: (task: string) => void;
  setUploadStatuses: React.Dispatch<React.SetStateAction<UploadStatus[]>>;
}

export interface UploadProcessDisplayProps {
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

export interface SummaryDisplayProps {
  taskLogs: { [key: string]: LogEntry[] };
  uploadStatuses: UploadStatus[];
  onClearLogs: (taskKey: string) => void;
}

export interface useUploadProgressSummaryProps {
  uploadStatuses: UploadStatus[];
  taskLogs: { [key: string]: LogEntry[] };
}
