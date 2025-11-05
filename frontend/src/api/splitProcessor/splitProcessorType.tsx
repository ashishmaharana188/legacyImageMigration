export interface splitProcessorUIProps {
    loading: boolean;
    handleSplitFiles: () => Promise<void>;
    handleSplitFilesWithMuPDF: () => Promise<void>;
    selectedFile: File | null;
    setSelectedFile: React.Dispatch<React.SetStateAction<File | null>>;
}

export interface useSplitProcessorProps {
    updateTaskLog: (task: string, log: unknown) => void;
    clearTaskLog: (task: string) => void;
    setUploadStatuses: React.Dispatch<React.SetStateAction<UploadStatus[]>>;
}

export interface SplitFile {
  row: number;
  url: string;
  pageCount: number;
}

export interface SplitFileResponse {
  statusCode?: number;
  message?: string;
  splitFiles?: SplitFile[];
  error?: string;
}

export interface RequestConfig {
  endpoint: string;
  selectedFile?: File | null;
  updateTaskLog: (task: string, log: unknown) => void;
  setSplitMessage: React.Dispatch<React.SetStateAction<string>>;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  logId: string;
  operationName: string;
  setUploadStatuses?: React.Dispatch<React.SetStateAction<UploadStatus[]>>;
  setIsUploading?: React.Dispatch<React.SetStateAction<boolean>>;
  setSplitFiles?: React.Dispatch<React.SetStateAction<SplitFile[]>>;
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

export interface SplitProgressMessage {
  type: "splitProgressUpdate" | "splitProgressComplete";
  // Removed totalExpectedSplits
  totalSplitFilesGenerated: number;
  splitErrors: number;
  totalExpectedPagesFromCsv?: number; // Added this field
  status?: string;
}