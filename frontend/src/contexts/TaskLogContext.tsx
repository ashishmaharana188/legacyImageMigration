import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { UploadStatus, LogEntry, TaskLogContextType } from "../types";

// 1. Single Source of Truth
const TaskLogContext = createContext<TaskLogContextType | undefined>(undefined);

export const TaskLogProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [taskLogs, setTaskLogs] = useState<{ [key: string]: LogEntry[] }>({});
  const [uploadStatuses, setUploadStatuses] = useState<UploadStatus[]>([]);

  // 2. THE FAST LANE (Dedicated State for Progress Bar)
  const [activeProgress, setActiveProgress] = useState({
    total: 0,
    success: 0,
    failure: 0,
    percent: 0,
  });

  const updateTaskLog = useCallback((taskKey: string, log: LogEntry) => {
    if (!log) return;

    // A. History Logs (Slow Lane) - Only for permanent records
    setTaskLogs((prevLogs) => {
      const newLogs = { ...prevLogs };
      const currentTaskLogs = newLogs[taskKey] || [];
      const existingIndex = currentTaskLogs.findIndex(
        (item) => item.id === log.id
      );

      if (existingIndex > -1) {
        const updatedList = [...currentTaskLogs];
        updatedList[existingIndex] = { ...updatedList[existingIndex], ...log };
        newLogs[taskKey] = updatedList;
      } else {
        newLogs[taskKey] = [...currentTaskLogs, log];
      }
      return newLogs;
    });

    // B. Progress Bar (Fast Lane) - Catches the Batched Updates
    // This looks specifically for the "upload-status" ID sent by the backend
    if (log.id === "upload-status" && log.totalRows) {
      setActiveProgress({
        total: Number(log.totalRows),
        success: Number(log.successfulRows || 0),
        failure: Number(log.errors || 0) + Number(log.notFound || 0),
        percent:
          Math.round(
            (Number(log.processedRows) / Number(log.totalRows)) * 100
          ) || 0,
      });
    }
  }, []);

  const onClearLogs = useCallback((taskKey: string) => {
    setTaskLogs((prev) => {
      const newLogs = { ...prev };
      delete newLogs[taskKey];
      return newLogs;
    });
    // Reset the Fast Lane when clearing
    setActiveProgress({ total: 0, success: 0, failure: 0, percent: 0 });
  }, []);

  return (
    <TaskLogContext.Provider
      value={{
        taskLogs,
        uploadStatuses,
        activeProgress,
        updateTaskLog,
        onClearLogs,
        setSummaryData: setTaskLogs,
        setUploadStatuses,
      }}
    >
      {children}
    </TaskLogContext.Provider>
  );
};

export const useTaskLog = () => {
  const context = useContext(TaskLogContext);
  if (!context)
    throw new Error("useTaskLog must be used within a TaskLogProvider");
  return context;
};
