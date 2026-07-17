export interface LogEntry {
  id: string;
  status?: string;
  completed?: number;
  total?: number;
  type?: string;
  message?: string;
  timestamp?: string;
  processedRows?: number;
  progress?: number;
  totalRows?: number;
  successfulRows?: number;
  errors?: number;
  notFound?: number;

  // [STEP 4] Added for detailed metrics display
  totalDuplicates?: number;
  metrics?: {
    // Sanity Check
    imperfectVsPerfect?: number;
    olderVersions?: number;
    olderImperfects?: number;
    duplicates?: number;

    // Image Data Transfer
    folioUpdated?: number;
    txnUpdated?: number;
    inserted?: number;
    synced?: number;
    failed?: number;

    [key: string]: number | undefined;
  };
  rows?: any[];
  result?: string;
}

export interface UseMasterMigrationHookProps {
  updateTaskLog: (task: string, log: LogEntry) => void;
  clearTaskLog: (task: string) => void;
}
