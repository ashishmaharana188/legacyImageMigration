import { TaskLogContextType, LogEntry } from "../../types";
import { Dayjs } from "dayjs";

export interface SanityCheckUIProps {
  handlePgSanityCheck: (dryRun: boolean) => Promise<void>;
  handleMongoSanityCheck: (dryRun: boolean) => Promise<void>;
  isDeleteEnabled: boolean;
  setIsDeleteEnabled: (value: boolean) => void;
  normalize: boolean;
  setNormalize: (value: boolean) => void;
  cutoffDate: Dayjs | null;
  setCutoffDate: (value: Dayjs | null) => void;
  clientCode: string;
  setClientCode: (value: string) => void;
  isLoadingPg: boolean;
  isLoadingMongo: boolean;
  duplicateMongoCheckResult: SanityCheckResponse | null;
  isMongoDeleteEnabled: boolean;
  setIsMongoDeleteEnabled: (value: boolean) => void;
}

export interface SanityCheckSummaryDisplayProps {
  // Handlers
  handlePgSanityCheck: (dryRun: boolean) => Promise<void>;
  handleMongoSanityCheck: (dryRun: boolean) => Promise<void>;

  // State
  isDeleteEnabled: boolean;
  setIsDeleteEnabled: (value: boolean) => void;

  // Kept for backward compatibility if needed, otherwise optional
  isMongoDeleteEnabled?: boolean;
  setIsMongoDeleteEnabled?: (value: boolean) => void;

  normalize: boolean;
  setNormalize: (value: boolean) => void;

  cutoffDate: Dayjs | null;
  setCutoffDate: (value: Dayjs | null) => void;

  clientCode: string;
  setClientCode: (value: string) => void;

  // Loading States
  isLoadingPg: boolean;
  isLoadingMongo: boolean;
}

export interface UseSanityCheckHookProps {
  updateTaskLog: (task: string, log: LogEntry) => void;
  clearTaskLog: (task: string) => void;
}

export interface SanityCheckResponse {
  message?: string;
  dryRun?: boolean;
  normalize?: boolean;
  cutoffTms?: string;
  clientCode?: string;
  rows?: Array<{
    user_attr1: string;
    client_id: string;
    creation_date: string;
  }>;
  duplicates?: unknown;
  totalDuplicateDocuments?: number;
  totalDuplicateGroups?: number;
  status?: "success" | "failed";
  error?: string;
}

export interface UseSanityCheckHookProps {
  updateTaskLog: TaskLogContextType["updateTaskLog"];
  clearTaskLog: TaskLogContextType["onClearLogs"];
}

export interface SanityCheckResponse {
  message?: string;
  dryRun?: boolean;
  normalize?: boolean;
  cutoffTms?: string;
  clientCode?: string;
  rows?: Array<{
    user_attr1: string;
    client_id: string;
    creation_date: string;
  }>;
  duplicates?: unknown;
  totalDuplicateDocuments?: number;
  totalDuplicateGroups?: number;
  status?: "success" | "failed";
  error?: string;
}

export interface SanityCheckSummaryDisplayProps {
  // Handlers
  handlePgSanityCheck: (dryRun: boolean) => Promise<void>;
  handleMongoSanityCheck: (dryRun: boolean) => Promise<void>;

  // State
  isDeleteEnabled: boolean;
  setIsDeleteEnabled: (value: boolean) => void;

  // Optional for backward compatibility
  isMongoDeleteEnabled?: boolean;
  setIsMongoDeleteEnabled?: (value: boolean) => void;

  normalize: boolean;
  setNormalize: (value: boolean) => void;

  cutoffDate: Dayjs | null;
  setCutoffDate: (value: Dayjs | null) => void;

  clientCode: string;
  setClientCode: (value: string) => void;

  // Loading States
  isLoadingPg: boolean;
  isLoadingMongo: boolean;
}

export interface UseSanityCheckHookProps {
  updateTaskLog: (task: string, log: LogEntry) => void;
  clearTaskLog: (task: string) => void;
}

export interface SanityCheckResponse {
  message?: string;
  dryRun?: boolean;
  normalize?: boolean;
  cutoffTms?: string;
  clientCode?: string;
  metrics?: any;
  totalDuplicatesFound?: number;
  totalDuplicateGroups?: number;
  totalDuplicateDocuments?: number;
  status?: "success" | "failed";
  error?: string;
}
