import React, { useEffect, useRef, useState, ReactNode } from 'react';
import { S3UploadProgress } from '../types';
import { WebSocketContext } from './WebSocketContextDefinition';
import { useTaskLog } from '../hooks/useTaskLog';
import { webSocketService } from '../services/webSocketService';
import { createWebSocketMessageProcessor } from '../services/webSocketMessageProcessor';

interface WebSocketProviderProps {
  children: ReactNode;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ children }) => {
  const { updateTaskLog, setUploadStatuses } = useTaskLog();
  const [s3UploadProgress, setS3UploadProgress] = useState<S3UploadProgress>({ processedDirectories: 0, totalDirectories: 0, currentDirectory: "" });
  const [isConnected, setIsConnected] = useState(false);

  const progressAccumulator = useRef<S3UploadProgress>({ processedDirectories: 0, totalDirectories: 0, currentDirectory: "" });
  const reconnectAttempts = useRef(0);
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);

  const { processMessage } = createWebSocketMessageProcessor({
    updateTaskLog,
    setUploadStatuses,
    setS3UploadProgress,
    setIsConnected,
    progressAccumulator,
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setS3UploadProgress((prevProgress: S3UploadProgress) => {
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
    const handleWebSocketOpen = () => {
      console.log("WebSocket connected");
      updateTaskLog("websocket", { id: "websocket-status", message: "WebSocket connected", status: "success" });
      setIsConnected(true);
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
        reconnectTimeout.current = null;
      }
      reconnectAttempts.current = 0;
    };

    const handleWebSocketClose = () => {
      console.log("WebSocket disconnected. Attempting to reconnect...");
      updateTaskLog("websocket", { id: "websocket-status", message: "WebSocket disconnected. Attempting to reconnect...", status: "failed" });
      setIsConnected(false);
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
      reconnectTimeout.current = setTimeout(() => {
        reconnectAttempts.current++;
        webSocketService.connect(); // Use the singleton service to reconnect
      }, delay);
    };

    const handleWebSocketError = (error: Event) => {
      console.error("WebSocket error:", error);
      updateTaskLog("websocket", { id: `websocket-error-${Date.now()}`, message: `WebSocket error: ${error.type}`, status: "failed" });
      webSocketService.disconnect(); // Use the singleton service to disconnect
    };

    webSocketService.addListener(processMessage);
    webSocketService.onOpen(handleWebSocketOpen);
    webSocketService.onClose(handleWebSocketClose);
    webSocketService.onError(handleWebSocketError);

    // Ensure connection is established when component mounts
    webSocketService.connect();

    return () => {
      webSocketService.removeListener(processMessage);
      webSocketService.removeOnOpen(handleWebSocketOpen);
      webSocketService.removeOnClose(handleWebSocketClose);
      webSocketService.removeOnError(handleWebSocketError);
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
    };
  }, [updateTaskLog, setUploadStatuses, setS3UploadProgress, setIsConnected, progressAccumulator, processMessage]);

  const value = {
    s3UploadProgress,
    isConnected,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};
