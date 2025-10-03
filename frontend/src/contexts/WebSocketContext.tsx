import React, { createContext, useContext, useEffect, useRef, useState, ReactNode, useCallback } from 'react';
import { TaskLog, UploadStatus, S3UploadProgress } from '../types';

interface WebSocketContextType {
  uploadStatuses: UploadStatus[];
  taskLogs: { [key: string]: TaskLog[] };
  s3UploadProgress: S3UploadProgress;
  isConnected: boolean;
  updateTaskLog: (task: string, log: TaskLog) => void;
  clearTaskLog: (task: string) => void;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};

interface WebSocketProviderProps {
  children: ReactNode;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ children }) => {
  const [uploadStatuses, setUploadStatuses] = useState<UploadStatus[]>([]);
  const [taskLogs, setTaskLogs] = useState<{ [key: string]: TaskLog[] }>({});
    const [s3UploadProgress, setS3UploadProgress] = useState<S3UploadProgress>({ processedDirectories: 0, totalDirectories: 0, currentDirectory: "" });
  const [isConnected, setIsConnected] = useState(false);

  const progressAccumulator = useRef<S3UploadProgress>({ processedDirectories: 0, totalDirectories: 0, currentDirectory: "" });  const reconnectAttempts = useRef(0);
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setS3UploadProgress((prevProgress) => {
        if (
          prevProgress.processedDirectories !== progressAccumulator.current.processedDirectories ||
          prevProgress.totalDirectories !== progressAccumulator.current.totalDirectories ||
          prevProgress.currentDirectory !== progressAccumulator.current.currentDirectory
        ) {
          return { ...progressAccumulator.current };
        }
        return prevProgress;
      });
    }, 200);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const connectWebSocket = () => {
      ws.current = new WebSocket("ws://localhost:3000");

      ws.current.onopen = () => {
        console.log("WebSocket connected");
        setIsConnected(true);
        if (reconnectTimeout.current) {
          clearTimeout(reconnectTimeout.current);
          reconnectTimeout.current = null;
        }
        reconnectAttempts.current = 0;
      };

      ws.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          if (message.type === "s3-upload-total-directories") {
            progressAccumulator.current.totalDirectories = message.totalDirectories;
          }

          if (message.type === "s3-directory-progress") {
            progressAccumulator.current.processedDirectories = message.completedDirectories;
            progressAccumulator.current.totalDirectories = message.totalDirectories;
            progressAccumulator.current.currentDirectory = message.currentDirectory;
          }

          if (message.type === "progressUpdate" || message.type === "progressComplete") {
            setUploadStatuses((prevStatuses) => {
              const fileName = "excel_processing";
              const existingFileIndex = prevStatuses.findIndex((s) => s.fileName === fileName);
              const totalRows = message.totalRows || 0;
              const processedRows = message.processedRows || 0;
              const progressPercentage = totalRows > 0 ? Math.round((processedRows / totalRows) * 100) : 0;

              let newStatus: UploadStatus = {
                fileName: fileName,
                progress: progressPercentage,
                status: message.type === "progressComplete" ? "Complete" : "Processing",
                totalFiles: totalRows,
                processedFiles: processedRows,
                successfulFiles: message.successfulRows || 0,
                errorFiles: message.errors || 0,
                notFoundFiles: message.notFound || 0,
                badRowsDetails: prevStatuses[existingFileIndex]?.badRowsDetails || [],
              };

              if (
                message.currentRow &&
                (message.currentRow.page_count_status === "Error" ||
                  message.currentRow.page_count_status === "Not Found" ||
                  message.currentRow.page_count_status === "Path Error" ||
                  message.currentRow.page_count_status === "Missing serverId" ||
                  message.currentRow.page_count_status === "Missing drivePath" ||
                  message.currentRow.page_count_status === "Missing pathVal" ||
                  message.currentRow.page_count_status === "Unsupported" ||
                  message.currentRow.page_count_status === "PDF Error")
              ) {
                const currentBadRows = newStatus.badRowsDetails || [];
                const isDuplicate = currentBadRows.some(
                  (detail) =>
                    detail.id_ihno === message.currentRow.id_ihno &&
                    detail.id_acno === message.currentRow.id_acno &&
                    detail.page_count_status === message.currentRow.page_count_status
                );

                if (!isDuplicate) {
                  newStatus.badRowsDetails = [...currentBadRows, message.currentRow];
                }
              }

              if (existingFileIndex > -1) {
                const updatedStatuses = [...prevStatuses];
                updatedStatuses[existingFileIndex] = { ...updatedStatuses[existingFileIndex], ...newStatus };
                return updatedStatuses;
              } else {
                return [...prevStatuses, newStatus];
              }
            });
          }
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
        }
      };

      ws.current.onclose = () => {
        console.log("WebSocket disconnected. Attempting to reconnect...");
        setIsConnected(false);
        if (reconnectTimeout.current) {
          clearTimeout(reconnectTimeout.current);
        }
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
        reconnectTimeout.current = setTimeout(() => {
          reconnectAttempts.current++;
          connectWebSocket();
        }, delay);
      };

      ws.current.onerror = (error) => {
        console.error("WebSocket error:", error);
        ws.current?.close();
      };
    };

    connectWebSocket();

    return () => {
      if (ws.current) {
        ws.current.close();
      }
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
    };
  }, []);

  const updateTaskLog = useCallback((task: string, log: TaskLog) => {
    setTaskLogs((prev) => {
      const existingLogs = prev[task] || [];
      return { ...prev, [task]: [...existingLogs, log] };
    });
  }, []);

  const clearTaskLog = useCallback((task: string) => {
    setTaskLogs((prev) => ({ ...prev, [task]: [] }));
  }, []);

  const value = {
    uploadStatuses,
    taskLogs,
    s3UploadProgress,
    isConnected,
    updateTaskLog,
    clearTaskLog,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};
