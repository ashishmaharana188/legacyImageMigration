import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { UploadStatus, LogEntry, TaskLogContextType } from "../types";

// 1. Single Source of Truth: Define Context Here
const TaskLogContext = createContext<TaskLogContextType | undefined>(undefined);

export const TaskLogProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [taskLogs, setTaskLogs] = useState<{ [key: string]: LogEntry[] }>({});
  const [uploadStatuses, setUploadStatuses] = useState<UploadStatus[]>([]);

  // 2. Interval State: Updates only when backend sends new count
  const [activeProgress, setActiveProgress] = useState({
    total: 0,
    success: 0,
    failure: 0,
    percent: 0,
  });

  const updateTaskLog = useCallback((taskKey: string, log: LogEntry) => {
    if (!log) return;

    // A. History Log Update
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

    // B. Interval Progress Update (For SummaryDisplay)
    if (log.id === "upload-status" && log.totalRows) {
      setActiveProgress({
        total: Number(log.totalRows),
        success: Number(log.successfulRows || 0),
        failure: Number(log.badRows || 0) + Number(log.notFoundFiles || 0),
        percent: log.progress || 0,
      });
    }
  }, []);

  const onClearLogs = useCallback((taskKey: string) => {
    setTaskLogs((prevLogs) => {
      const newLogs = { ...prevLogs };
      delete newLogs[taskKey];
      return newLogs;
    });
    // Reset progress on clear
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

// 3. Unified Hook: Exported directly from here
export const useTaskLog = () => {
  const context = useContext(TaskLogContext);
  if (!context) {
    throw new Error("useTaskLog must be used within a TaskLogProvider");
  }
  return context;
};
