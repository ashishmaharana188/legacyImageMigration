import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
  useEffect,
} from "react";
import { UploadStatus, LogEntry, TaskLogContextType } from "../types";

const TaskLogContext = createContext<TaskLogContextType | undefined>(undefined);

export const TaskLogProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [taskLogs, setTaskLogs] = useState<{ [key: string]: LogEntry[] }>({});
  const [uploadStatuses, setUploadStatuses] = useState<UploadStatus[]>([]);

  const [activeProgress, setActiveProgress] = useState({
    total: 0,
    success: 0,
    failure: 0,
    percent: 0,
  });

  const updateTaskLog = useCallback((taskKey: string, log: LogEntry) => {
    if (!log) return;

    // 1. History Logs (Keep as is)
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

    // 2. [FIX] The Fast Lane with "Zero Guard"
    if (log.id === "upload-status") {
      const newTotal = Number(log.totalRows);

      // GUARD: Only update progress if we actually have rows.
      // This blocks the "Ghost" legacy code that sends totalRows: 0
      if (newTotal > 0) {
        setActiveProgress({
          total: newTotal,
          success: Number(log.successfulRows || 0),
          failure: Number(log.errors || 0) + Number(log.notFound || 0),
          percent:
            Math.round((Number(log.processedRows) / newTotal) * 100) || 0,
        });
      }
    }
  }, []);

  const onClearLogs = useCallback((taskKey: string) => {
    setTaskLogs((prev) => {
      const newLogs = { ...prev };
      delete newLogs[taskKey];
      return newLogs;
    });
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
