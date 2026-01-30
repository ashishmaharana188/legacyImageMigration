import { useState, useEffect } from "react";
import {
  handleFileChange as utilHandleFileChange,
  handleUpload as utilHandleUpload,
  handleFallback as utilHandleFallback, // Import the utility function
} from "./uploadProcessorUtil";
import { webSocketService } from "../../services/webSocketService";
import { UploadStatus } from "../../types/index";

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
      if (msg.type === "excelProcessingComplete") {
        setUploadMessage("Processing Complete.");
        setLoading(false);
        setIsUploading(false);
      }
    };

    webSocketService.addListener(handleMessage);
    return () => webSocketService.removeListener(handleMessage);
  }, []);

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
    // FIX: Added missing handleFallback to the hook return
    handleFallback: () =>
      utilHandleFallback(
        selectedFile,
        updateTaskLog,
        clearTaskLog,
        setUploadMessage,
        setLoading
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
    parsedBadRows: null,
    expandedLogId,
    toggleBadRowsDisplay,
  };
};
