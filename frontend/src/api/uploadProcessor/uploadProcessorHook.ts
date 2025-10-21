import { useState, useEffect, useCallback } from "react";
import {
  handleFileChange as utilHandleFileChange,
  handleUpload as utilHandleUpload,
  handleFallback as utilHandleFallback,
} from "./uploadProcessorUtil";
import { UploadStatus } from "./uploadProcessorType";
import { parseBadRowsCsv } from "./uploadProcessorSumamry";
import axios from "axios";
import { TaskLogEntry, UseUploadProcessorProps, BadRow } from "./uploadProcessorType";

export const useUploadProcessorHook = ({
  updateTaskLog,
  clearTaskLog,
  setUploadStatuses,
}: UseUploadProcessorProps) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadMessage, setUploadMessage] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    utilHandleFileChange(event, setSelectedFile, setUploadMessage);
  };

  const handleUpload = async () => {
    await utilHandleUpload(
      selectedFile,
      updateTaskLog,
      clearTaskLog,
      setUploadMessage,
      setLoading,
      setIsUploading,
      setUploadStatuses
    );
  };

  const handleFallback = async () => {
    await utilHandleFallback(
      selectedFile,
      updateTaskLog,
      clearTaskLog,
      setUploadMessage,
      setLoading
    );
  };

  return {
    selectedFile,
    uploadMessage,
    loading,
    isUploading,
    handleFileChange,
    handleUpload,
    handleFallback,
  };
};

interface UseUploadProgressSummaryProps {
  uploadStatuses: UploadStatus[];
  taskLogs: { [key: string]: TaskLogEntry[] };
}

export const useUploadProgressSummary = ({
  uploadStatuses,
  taskLogs,
}: UseUploadProgressSummaryProps) => {
  const [excelProcessingStatus, setExcelProcessingStatus] =
    useState<UploadStatus | null>(null);

  useEffect(() => {
    const excelStatus = uploadStatuses.find(
      (s) => s.fileName === "excel_upload_progress"
    );
    setExcelProcessingStatus(excelStatus || null);

  }, [uploadStatuses, taskLogs]);

  return {
    excelProcessingStatus,
  };
};


export const useBadRowsDisplay = () => {
  const [parsedBadRows, setParsedBadRows] = useState<BadRow[] | null>([]);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const toggleBadRowsDisplay = useCallback(async (filePath: string, currentLogId: string) => {
    if (expandedLogId === currentLogId) {
      setParsedBadRows(null);
      setExpandedLogId(null);
    } else {
      try {
        const res = await axios.get(`http://localhost:3000/download-generated-file/${filePath}`);
        setParsedBadRows(parseBadRowsCsv(res.data));
        setExpandedLogId(currentLogId);
      } catch (error) {
        console.error("Failed to fetch bad rows content:", error);
        setParsedBadRows(null);
        setExpandedLogId(currentLogId);
      }
    }
  }, [expandedLogId]);

  return {
    parsedBadRows,
    expandedLogId,
    toggleBadRowsDisplay,
  };
};
