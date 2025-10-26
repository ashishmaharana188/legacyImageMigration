export interface splitProcessorUIProps {
    splitMessage: string;
    loading: boolean;
    handleSplitFiles: () => Promise<void>;
    handleSplitFilesWithMuPDF: () => Promise<void>;
}

export interface useSplitProcessorProps {
    updateTaskLog: (task: string, log: unknown) => void;
    clearTaskLog: (task: string) => void;
    setUploadStatuses: React.Dispatch<React.SetStateAction<UploadStatus[]>>;
}

export interface RequestConfig {
  endpoint: string;
  updateTaskLog: (task: string, log: unknown) => void;
  setUploadMessage: React.Dispatch<React.SetStateAction<string>>;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  logId: string;
  operationName: string;
  setUploadStatuses?: React.Dispatch<React.SetStateAction<UploadStatus[]>>;
}

export interface FileResponseSummary {
  totalSplits: number;
  totalSuccessfulSplits: number;
  errors: number;
  totalUnsuccessfulSplits: number;
  totalPageCount: number;
}

export interface FileResponse {
  statusCode?: number;
  message?: string;
  nextContinuationToken?: string;
  summary?: FileResponseSummary;
  fileUrls?: Array<{ row: number; url: string; pageCount: number }>;
  error?: string;
  directories?: string[];
}

export interface UploadStatus {
  fileName: string;
  progress?: number;
  status?: string;
  isDirectory?: boolean;
  errorMessage?: string;
}
