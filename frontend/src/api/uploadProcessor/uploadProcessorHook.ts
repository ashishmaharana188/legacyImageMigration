import { useState } from "react";
import {
  handleFileChange as utilHandleFileChange,
  handleUpload as utilHandleUpload,
  handleFallback as utilHandleFallback,
} from "./uploadProcessorUtil";
import { UploadStatus } from "./uploadProcessorType";
import { useTaskLog } from "../../contexts/TaskLogContext"; // Assuming this path is correct

interface UseUploadProcessorProps {
  updateTaskLog: (task: string, log: unknown) => void;
  clearTaskLog: (task: string) => void;
  setUploadStatuses: React.Dispatch<React.SetStateAction<UploadStatus[]>>;
}

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
