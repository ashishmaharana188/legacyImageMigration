import React, { useState, useCallback, ReactNode } from "react";
import { UploadStatus, LogEntry } from "../types";
import { TaskLogContext } from "./TaskLogContextDefinition";

export const TaskLogProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [taskLogs, setTaskLogs] = useState<{ [key: string]: LogEntry[] }>({});
  const [uploadStatuses, setUploadStatuses] = useState<UploadStatus[]>([]);

  // [FIX] Wrap in useCallback to keep function reference stable across renders
  const updateTaskLog = useCallback((taskKey: string, log: LogEntry) => {
    if (!log) return;

    setTaskLogs((prevLogs) => {
      const newLogs = { ...prevLogs };
      if (!newLogs[taskKey]) {
        newLogs[taskKey] = [];
      }

      const currentTaskLogs = newLogs[taskKey];

      if (typeof log === "object" && log !== null && "id" in log) {
        const existingIndex = currentTaskLogs.findIndex(
          (item: any) => item.id === (log as any).id
        );

        if (existingIndex > -1) {
          // Create new array reference for the list
          const updatedList = [...currentTaskLogs];
          // Update the specific item
          updatedList[existingIndex] = {
            ...updatedList[existingIndex],
            ...(log as object),
          };
          newLogs[taskKey] = updatedList;
        } else {
          newLogs[taskKey] = [...currentTaskLogs, log];
        }
      } else {
        newLogs[taskKey] = [...currentTaskLogs, log];
      }
      return newLogs;
    });
  }, []);

  // [FIX] Stable clear function
  const onClearLogs = useCallback((taskKey: string) => {
    setTaskLogs((prevLogs) => {
      const newLogs = { ...prevLogs };
      delete newLogs[taskKey];
      return newLogs;
    });
  }, []);

  // Alias for compatibility
  const setSummaryData = setTaskLogs;

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
