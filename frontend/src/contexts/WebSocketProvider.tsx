import React, {
  createContext,
  useEffect,
  useRef,
  useState,
  useMemo,
  ReactNode,
  useContext,
} from "react";
import { S3UploadProgress } from "../types";
// [FIX] Import from the Unified TaskLogContext
import { useTaskLog } from "./TaskLogContext";
// [FIX] Use the Singleton Service (matching your upload)
import { webSocketService } from "../services/webSocketService";
import { createWebSocketMessageProcessor } from "../services/webSocketMessageProcessor";

// 1. Define the Context Type Locally
interface WebSocketContextType {
  s3UploadProgress: S3UploadProgress;
  isConnected: boolean;
}

// 2. Create the Context Locally (No external dependency)
export const WebSocketContext = createContext<WebSocketContextType | null>(
  null
);

interface WebSocketProviderProps {
  children: ReactNode;
}

// 3. Export the Provider Component
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

    // Attach listeners to the Singleton Service
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

// 4. Export a Hook for easy consumption (Optional but good practice)
export const useWebSocketContext = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error(
      "useWebSocketContext must be used within a WebSocketProvider"
    );
  }
  return context;
};
