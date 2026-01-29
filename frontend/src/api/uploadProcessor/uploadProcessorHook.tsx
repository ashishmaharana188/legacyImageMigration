import { useState, useEffect } from "react";
import {
  handleFileChange as utilHandleFileChange,
  handleUpload as utilHandleUpload,
} from "./uploadProcessorUtil";
import { webSocketService } from "../../services/webSocketService";
import { UploadStatus, LogEntry } from "../../types/index";

// Internal interface for props
interface useUploadProcessorProps {
  updateTaskLog: (task: string, log: any) => void;
  clearTaskLog: (task: string) => void;
  setUploadStatuses: React.Dispatch<React.SetStateAction<UploadStatus[]>>;
}

export const useUploadProcessorHook = ({
  updateTaskLog,
  clearTaskLog,
  setUploadStatuses,
}: useUploadProcessorProps) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadMessage, setUploadMessage] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  useEffect(() => {
    const handleMessage = (msg: any) => {
      // Aligned with Backend Controller 'excelProcessingUpdate'
      if (
        msg.type === "excelProcessingUpdate" ||
        msg.type === "excelProcessingComplete"
      ) {
        const progress =
          msg.totalRows > 0 ? (msg.processedRows / msg.totalRows) * 100 : 0;

        setUploadStatuses((prev: UploadStatus[]) => {
          const others = prev.filter(
            (s: UploadStatus) => s.fileName !== "excel_processing"
          );
          return [
            ...others,
            {
              fileName: "excel_processing",
              status: msg.status || "Processing...",
              progress: progress,
              totalFiles: msg.totalRows,
              processedFiles: msg.processedRows,
              successfulFiles: msg.successfulRows || 0,
              errorFiles: msg.errorRows || 0,
            },
          ];
        });

        if (msg.type === "excelProcessingComplete") {
          setUploadMessage("Processing Complete.");
          setLoading(false);
          setIsUploading(false);
        }
      }
    };

    webSocketService.addListener(handleMessage);
    return () => webSocketService.removeListener(handleMessage);
  }, [setUploadStatuses]);

  return {
    selectedFile,
    uploadMessage,
    loading,
    isUploading,
    handleFileChange: (e: any) =>
      utilHandleFileChange(e, setSelectedFile, setUploadMessage),
    handleUpload: () =>
      utilHandleUpload(
        selectedFile,
        updateTaskLog,
        clearTaskLog,
        setUploadMessage,
        setLoading,
        setIsUploading,
        setUploadStatuses
      ),
  };
};

export const useUploadProgressSummary = ({
  uploadStatuses,
}: {
  uploadStatuses: UploadStatus[];
}) => {
  const excelProcessingStatus =
    uploadStatuses.find((s) => s.fileName === "excel_processing") || null;
  const s3UploadStatus =
    uploadStatuses.find((s) => s.fileName === "s3_upload_progress") || null;
  return { excelProcessingStatus, s3UploadStatus };
};

export const useBadRowsDisplay = ({ logKey: _logKey }: { logKey: string }) => {
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const toggleBadRowsDisplay = (_filePath: string, logId: string) => {
    setExpandedLogId((prev) => (prev === logId ? null : logId));
  };

  return {
    parsedBadRows: null, // Logic for parsing rows can be added here if needed
    expandedLogId,
    toggleBadRowsDisplay,
  };
};
