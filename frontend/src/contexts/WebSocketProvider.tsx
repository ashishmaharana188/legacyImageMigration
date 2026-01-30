import React, { useEffect, useRef, useState, useMemo, ReactNode } from "react";
import { S3UploadProgress } from "../types";
import { WebSocketContext } from "./WebSocketContextDefinition";
import { useTaskLog } from "../hooks/useTaskLog";
import { webSocketService } from "../services/webSocketService";
import { createWebSocketMessageProcessor } from "../services/webSocketMessageProcessor";

interface WebSocketProviderProps {
  children: ReactNode;
}

// Ensure this is a named export
export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({
  children,
}) => {
  const { updateTaskLog, setUploadStatuses } = useTaskLog();
  const [s3UploadProgress, setS3UploadProgress] = useState<S3UploadProgress>({
    processedDirectories: 0,
    totalDirectories: 0,
    currentDirectory: "",
  });
  const [isConnected, setIsConnected] = useState(false);

  const progressAccumulator = useRef<S3UploadProgress>({
    processedDirectories: 0,
    totalDirectories: 0,
    currentDirectory: "",
  });

  // Stabilize the processor
  const { processMessage } = useMemo(
    () =>
      createWebSocketMessageProcessor({
        updateTaskLog,
        setUploadStatuses,
        setS3UploadProgress,
        setIsConnected,
        progressAccumulator,
      }),
    [updateTaskLog, setUploadStatuses]
  );

  useEffect(() => {
    const handleOpen = () => setIsConnected(true);
    const handleClose = () => setIsConnected(false);

    webSocketService.addListener(processMessage);
    webSocketService.onOpen(handleOpen);
    webSocketService.onClose(handleClose);
    webSocketService.connect();

    return () => {
      webSocketService.removeListener(processMessage);
      webSocketService.removeOnOpen(handleOpen);
      webSocketService.removeOnClose(handleClose);
    };
  }, [processMessage]);

  return (
    <WebSocketContext.Provider value={{ s3UploadProgress, isConnected }}>
      {children}
    </WebSocketContext.Provider>
  );
};
