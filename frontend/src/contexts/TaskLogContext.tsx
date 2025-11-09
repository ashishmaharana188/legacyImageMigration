import React, { useState, ReactNode } from 'react';
import { UploadStatus, LogEntry } from '../types';
import { TaskLogContext } from './TaskLogContextDefinition';

export const TaskLogProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [taskLogs, setTaskLogs] = useState<{ [key: string]: LogEntry[] }>({});
  const [uploadStatuses, setUploadStatuses] = useState<UploadStatus[]>([]);

  const updateTaskLog = (taskKey: string, log: LogEntry) => {
    if (!log) {
      console.warn(`Attempted to log an undefined message for taskKey: ${taskKey}`);
      return;
    }
    setTaskLogs(prevLogs => {
      const newLogs = { ...prevLogs };
      if (!newLogs[taskKey]) {
        newLogs[taskKey] = [];
      }

      if (typeof log === 'object' && log !== null && 'id' in log) {
        const existingLogIndex = newLogs[taskKey].findIndex((item: LogEntry) => typeof item === 'object' && item !== null && 'id' in item && item.id === log.id);
        if (existingLogIndex > -1) {
          newLogs[taskKey][existingLogIndex] = { ...(newLogs[taskKey][existingLogIndex] as object), ...(log as object) };
        } else {
          newLogs[taskKey] = [...newLogs[taskKey], log];
        }
      } else {
        newLogs[taskKey] = [...newLogs[taskKey], log];
      }
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
