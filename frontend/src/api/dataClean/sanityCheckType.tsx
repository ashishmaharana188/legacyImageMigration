import { TaskLogContextType, LogEntry } from '../../types';
import dayjs from 'dayjs';

export interface SanityCheckUIProps {
  handlePgSanityCheck: (dryRun: boolean) => Promise<void>;
  handleMongoSanityCheck: (dryRun: boolean) => Promise<void>;
  isDeleteEnabled: boolean;
  setIsDeleteEnabled: (value: boolean) => void;
  normalize: boolean;
  setNormalize: (value: boolean) => void;
  cutoffDate: dayjs.Dayjs | null;
  setCutoffDate: (value: dayjs.Dayjs | null) => void;
  clientCode: string;
  setClientCode: (value: string) => void;
  isLoadingPg: boolean;
  isLoadingMongo: boolean;
  duplicateMongoCheckResult: SanityCheckResponse | null;
  isMongoDeleteEnabled: boolean;
  setIsMongoDeleteEnabled: (value: boolean) => void;
}

export interface UseSanityCheckHookProps {
  updateTaskLog: TaskLogContextType['updateTaskLog'];
  clearTaskLog: TaskLogContextType['onClearLogs'];
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
  log: LogEntry;
  logKey: string;
}
