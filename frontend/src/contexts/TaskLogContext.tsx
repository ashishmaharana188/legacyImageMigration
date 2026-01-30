import React, { useState, ReactNode } from "react";
import { UploadStatus, LogEntry } from "../types";
import { TaskLogContext } from "./TaskLogContextDefinition";

export const TaskLogProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [taskLogs, setTaskLogs] = useState<{ [key: string]: LogEntry[] }>({});
  const [uploadStatuses, setUploadStatuses] = useState<UploadStatus[]>([]);

  const updateTaskLog = (taskKey: string, log: LogEntry) => {
    if (!log) return;

    setTaskLogs((prevLogs) => {
      // 1. Get current logs or empty array
      const currentTaskLogs = prevLogs[taskKey] || [];

      // 2. If log has an ID, find and update immutably
      if (typeof log === "object" && log !== null && "id" in log) {
        const existingIndex = currentTaskLogs.findIndex(
          (item: any) => item.id === (log as any).id
        );

        if (existingIndex > -1) {
          // CLONING: Create a new array and new object reference to trigger UI re-render
          const updatedLogs = [...currentTaskLogs];
          updatedLogs[existingIndex] = {
            ...updatedLogs[existingIndex],
            ...(log as object),
          };
          return { ...prevLogs, [taskKey]: updatedLogs };
        }

        // New log entry with ID
        return { ...prevLogs, [taskKey]: [...currentTaskLogs, log] };
      }

      // 3. Fallback for non-ID logs (append new entry)
      return { ...prevLogs, [taskKey]: [...currentTaskLogs, log] };
    });
  };

  const onClearLogs = (taskKey: string) => {
    setTaskLogs((prevLogs) => {
      const newLogs = { ...prevLogs };
      delete newLogs[taskKey];
      return newLogs;
    });
  };

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
