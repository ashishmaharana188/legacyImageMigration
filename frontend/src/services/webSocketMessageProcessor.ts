import { S3UploadProgress, UploadStatus } from '../types';
import { TaskLogContextType } from '../types/index';

interface S3UploadTotalDirectoriesMessage {
  type: "s3-upload-total-directories";
  totalDirectories: number;
}

interface S3DirectoryProgressMessage {
  type: "s3-directory-progress";
  completedDirectories: number;
  totalDirectories: number;
  currentDirectory: string;
}

interface ProgressUpdateMessage {
  type: "progressUpdate" | "progressComplete";
  totalRows?: number;
  processedRows?: number;
  successfulRows?: number;
  errors?: number;
  notFound?: number;
}

export type WebSocketMessage =
  | S3UploadTotalDirectoriesMessage
  | S3DirectoryProgressMessage
  | ProgressUpdateMessage;

interface WebSocketMessageProcessorProps {
  updateTaskLog: TaskLogContextType['updateTaskLog'];
  setUploadStatuses: TaskLogContextType['setUploadStatuses'];
  setS3UploadProgress: React.Dispatch<React.SetStateAction<S3UploadProgress>>;
  setIsConnected: React.Dispatch<React.SetStateAction<boolean>>;
  progressAccumulator: React.MutableRefObject<S3UploadProgress>;
}

export const createWebSocketMessageProcessor = ({
  updateTaskLog,
  setUploadStatuses,
  progressAccumulator
}: WebSocketMessageProcessorProps) => {

  const processMessage = (message: WebSocketMessage) => {
    if (message.type === "s3-upload-total-directories") {
      progressAccumulator.current.totalDirectories = message.totalDirectories;
    } else if (message.type === "s3-directory-progress") {
      progressAccumulator.current.processedDirectories = message.completedDirectories;
      progressAccumulator.current.totalDirectories = message.totalDirectories;
      progressAccumulator.current.currentDirectory = message.currentDirectory;
    } else if (message.type === "progressUpdate" || message.type === "progressComplete") {
      setUploadStatuses((prevStatuses: UploadStatus[]) => {
        const fileName = "excel_processing";
        const existingFileIndex = prevStatuses.findIndex((s) => s.fileName === fileName);
        const totalRows = message.totalRows || 0;
        const processedRows = message.processedRows || 0;
        const progressPercentage = totalRows > 0 ? Math.round((processedRows / totalRows) * 100) : 0;

        const newStatus: UploadStatus = {
          fileName: fileName,
          progress: progressPercentage,
          status: message.type === "progressComplete" ? "Complete" : "Processing",
          totalFiles: totalRows,
          processedFiles: processedRows,
          successfulFiles: message.successfulRows || 0,
          errorFiles: message.errors || 0,
          notFoundFiles: message.notFound || 0,
        };

        if (existingFileIndex > -1) {
          const updatedStatuses = [...prevStatuses];
          updatedStatuses[existingFileIndex] = { ...updatedStatuses[existingFileIndex], ...newStatus };
          return updatedStatuses;
        } else {
          return [...prevStatuses, newStatus];
        }
      });
    } else {
      updateTaskLog("websocket", { id: `websocket-message-${Date.now()}`, message: `Received unhandled message: ${JSON.stringify(message)}`, status: "info" });
    }
  };

  return { processMessage };
};
