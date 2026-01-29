export interface splitProcessorUIProps {
  loading: boolean;
  handleSplitFiles: (file: File) => Promise<void>;
  handleSplitFilesWithMuPDF: (file: File) => Promise<void>;
  selectedFile: File | null;
  setSelectedFile: React.Dispatch<React.SetStateAction<File | null>>;
  splitFiles: string[];
}

export interface UploadStatus {
  fileName: string;
  progress?: number;
  status: string; // FIXED: Changed from optional to required
  isDirectory?: boolean;
  errorMessage?: string;
}

export interface RequestConfig {
  endpoint: string;
  updateTaskLog: (task: string, log: unknown) => void;
  setSplitMessage: React.Dispatch<React.SetStateAction<string>>;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  logId: string;
  operationName: string;
  setUploadStatuses?: React.Dispatch<React.SetStateAction<UploadStatus[]>>;
  setIsUploading?: React.Dispatch<React.SetStateAction<boolean>>;
}

export interface SplitSummary {
  totalSplitFilesGenerated: number;
  splitErrors: number;
  totalExpectedPagesFromCsv: number;
}

export interface SplitFileResponse {
  statusCode?: number;
  message?: string;
  splitFiles?: string[];
  splitSummary?: SplitSummary;
  summary?: {
    totalSplitFilesGenerated: number;
    splitErrors: number;
    totalExpectedPagesFromCsv: number;
  };
}

export interface useSplitProcessorProps {
  updateTaskLog: (task: string, log: unknown) => void;
  clearTaskLog: (task: string) => void;
  setUploadStatuses: React.Dispatch<React.SetStateAction<UploadStatus[]>>;
}

export interface SplitProcessorSummaryUIProps {
  splitMessage: string;
  totalSplitFilesGenerated: number;
}

export interface SplitProgressMessage {
  type: "splitProgressUpdate" | "splitProgressComplete";
  totalSplitFilesGenerated: number;
  splitErrors: number;
  totalExpectedPagesFromCsv?: number;
  status?: string;
}
