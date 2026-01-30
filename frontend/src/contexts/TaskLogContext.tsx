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
      const currentTaskLogs = prevLogs[taskKey] || [];
      if (typeof log === "object" && log !== null && "id" in log) {
        const existingIndex = currentTaskLogs.findIndex(
          (item: any) => item.id === (log as any).id
        );
        if (existingIndex > -1) {
          // Create new array + new object reference
          const updatedLogs = [...currentTaskLogs];
          updatedLogs[existingIndex] = {
            ...updatedLogs[existingIndex],
            ...(log as object),
          };
          return { ...prevLogs, [taskKey]: updatedLogs };
        }
        return { ...prevLogs, [taskKey]: [...currentTaskLogs, log] };
      }
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
