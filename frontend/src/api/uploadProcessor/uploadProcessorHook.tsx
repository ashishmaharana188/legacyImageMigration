import { useState, useEffect} from "react";
import {
  handleFileChange as utilHandleFileChange,
  handleUpload as utilHandleUpload,
  handleFallback as utilHandleFallback,
} from "./uploadProcessorUtil";
import { UploadStatus } from "./uploadProcessorType";
import { useUploadProcessorProps, useUploadProgressSummaryProps} from "./uploadProcessorType";

export const useUploadProcessorHook = ({
  updateTaskLog,
  clearTaskLog,
  setUploadStatuses,
}: useUploadProcessorProps) => {
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

export const useUploadProgressSummary = ({
  uploadStatuses,
  taskLogs,
}: useUploadProgressSummaryProps) => {
  const [excelProcessingStatus, setExcelProcessingStatus] =
    useState<UploadStatus | null>(null);
  const [s3UploadStatus, setS3UploadStatus] = useState<UploadStatus | null>(null);

  useEffect(() => {
    const excelStatus = uploadStatuses.find(
      (s) => s.fileName === "excel_upload_progress"
    );
    setExcelProcessingStatus(excelStatus || null);

    const s3Status = uploadStatuses.find(
      (s) => s.fileName === "s3_upload_progress"
    );
    setS3UploadStatus(s3Status || null);

  }, [uploadStatuses, taskLogs]);

  return {
    excelProcessingStatus,
    s3UploadStatus,
  };
};
