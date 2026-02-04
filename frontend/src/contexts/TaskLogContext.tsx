import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { UploadStatus, LogEntry, TaskLogContextType } from "../types";

const TaskLogContext = createContext<TaskLogContextType | undefined>(undefined);

export const TaskLogProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [taskLogs, setTaskLogs] = useState<{ [key: string]: LogEntry[] }>({});
  const [uploadStatuses, setUploadStatuses] = useState<UploadStatus[]>([]);

  // [FIX] Removed 'activeProgress' state entirely.
  // Progress is now stored inside 'taskLogs' to ensure isolation.

  const updateTaskLog = useCallback((taskKey: string, log: LogEntry) => {
    if (!log) return;

    setTaskLogs((prevLogs) => {
      const newLogs = { ...prevLogs };
      const currentTaskLogs = newLogs[taskKey] || [];

      // Check if we are updating an existing log entry (like a live progress bar)
      const existingIndex = currentTaskLogs.findIndex(
        (item) => item.id === log.id
      );

      if (existingIndex > -1) {
        // Update the existing entry (keeps the progress bar alive without duplication)
        const updatedList = [...currentTaskLogs];
        updatedList[existingIndex] = { ...updatedList[existingIndex], ...log };
        newLogs[taskKey] = updatedList;
      } else {
        // Append new log entry
        newLogs[taskKey] = [...currentTaskLogs, log];
      }
      return newLogs;
    });
  }, []);

  const onClearLogs = useCallback((taskKey: string) => {
    setTaskLogs((prev) => {
      const newLogs = { ...prev };
      delete newLogs[taskKey];
      return newLogs;
    });
  }, []);

  return (
    <TaskLogContext.Provider
      value={{
        taskLogs,
        uploadStatuses,
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
