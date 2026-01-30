import React, { useEffect, useRef, useState, useMemo, ReactNode } from "react";
import { S3UploadProgress } from "../types";
import { WebSocketContext } from "./WebSocketContextDefinition";
import { useTaskLog } from "../hooks/useTaskLog";
import { webSocketService } from "../services/webSocketService";
import { createWebSocketMessageProcessor } from "../services/webSocketMessageProcessor";

interface WebSocketProviderProps {
  children: ReactNode;
}

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

  // [FIX] Memoize the processor so it doesn't change on every render
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
  ); // Dependencies are now stable due to Step 1

  useEffect(() => {
    const handleOpen = () => {
      console.log("[WS-PROVIDER] Connected");
      setIsConnected(true);
      updateTaskLog("websocket", {
        id: "websocket-status",
        message: "Connected",
        status: "success",
      });
    };

    const handleClose = () => {
      console.log("[WS-PROVIDER] Disconnected");
      setIsConnected(false);
    };

    // Attach listeners
    webSocketService.addListener(processMessage);
    webSocketService.onOpen(handleOpen);
    webSocketService.onClose(handleClose);
    webSocketService.connect();

    // Cleanup
    return () => {
      webSocketService.removeListener(processMessage);
      webSocketService.removeOnOpen(handleOpen);
      webSocketService.removeOnClose(handleClose);
    };
  }, [processMessage, updateTaskLog]); // Now stable

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
