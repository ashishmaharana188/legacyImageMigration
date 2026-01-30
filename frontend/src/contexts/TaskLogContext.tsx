import React, { useState, useCallback, ReactNode } from "react";
import { UploadStatus, LogEntry } from "../types";
import { TaskLogContext } from "./TaskLogContextDefinition";

export const TaskLogProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [taskLogs, setTaskLogs] = useState<{ [key: string]: LogEntry[] }>({});
  const [uploadStatuses, setUploadStatuses] = useState<UploadStatus[]>([]);

  // [FIX] useCallback prevents the function from being recreated on every render
  const updateTaskLog = useCallback((taskKey: string, log: LogEntry) => {
    if (!log) return;

    setTaskLogs((prevLogs) => {
      const currentTaskLogs = prevLogs[taskKey] || [];

      // LOG: Confirm update is triggering
      if (
        typeof log === "object" &&
        "id" in log &&
        log.id === "upload-status"
      ) {
        // Keep this log for one more check
        // console.log("[DEBUG-STATE] Context Update:", (log as any).successfulRows);
      }

      if (typeof log === "object" && log !== null && "id" in log) {
        const existingIndex = currentTaskLogs.findIndex(
          (item: any) => item.id === (log as any).id
        );

        if (existingIndex > -1) {
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
  }, []); // Empty dependency array ensures stability

  const onClearLogs = useCallback((taskKey: string) => {
    setTaskLogs((prevLogs) => {
      const newLogs = { ...prevLogs };
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
