import React, { createContext, useState, useContext, ReactNode } from 'react';

interface UploadStatus {
  fileName: string;
  progress?: number;
  status?: string;
  isDirectory?: boolean;
  totalFiles?: number;
  processedFiles?: number;
  successfulFiles?: number;
  errorFiles?: number;
  notFoundFiles?: number;
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

interface TaskLogContextType {
  taskLogs: { [key: string]: any[] };
  uploadStatuses: UploadStatus[];
  updateTaskLog: (taskKey: string, log: any) => void;
  onClearLogs: (taskKey: string) => void;
  setSummaryData: React.Dispatch<React.SetStateAction<{ [key: string]: any[]; }>>;
  setUploadStatuses: React.Dispatch<React.SetStateAction<UploadStatus[]>>;
}

const TaskLogContext = createContext<TaskLogContextType | undefined>(undefined);

export const TaskLogProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [taskLogs, setTaskLogs] = useState<{ [key: string]: any[] }>({});
  const [uploadStatuses, setUploadStatuses] = useState<UploadStatus[]>([]);

  const updateTaskLog = (taskKey: string, log: any) => {
    setTaskLogs(prevLogs => {
      const newLogs = { ...prevLogs };
      if (!newLogs[taskKey]) {
        newLogs[taskKey] = [];
      }
      newLogs[taskKey] = [...newLogs[taskKey], log];
      return newLogs;
    });
  };

  const onClearLogs = (taskKey: string) => {
    setTaskLogs(prevLogs => {
      const newLogs = { ...prevLogs };
      delete newLogs[taskKey];
      return newLogs;
    });
  };

  const setSummaryData = setTaskLogs; // Alias for clarity if needed elsewhere

  return (
    <TaskLogContext.Provider
      value={{
        taskLogs,
        uploadStatuses,
        updateTaskLog,
        onClearLogs,
        setSummaryData,
        setUploadStatuses,
      }}
    >
      {children}
    </TaskLogContext.Provider>
  );
};

export const useTaskLog = () => {
  const context = useContext(TaskLogContext);
  if (context === undefined) {
    throw new Error('useTaskLog must be used within a TaskLogProvider');
  }
  return context;
};
