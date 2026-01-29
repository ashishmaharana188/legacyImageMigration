import React, { useEffect } from "react";
import UploadProcessorUI from "../ui/UploadAndScriptUI";
import { useUploadProcessorHook } from "../../api/uploadProcessor/uploadProcessorHook";
import {
  API_BASE_URL,
  configPromise,
} from "../../api/uploadProcessor/uploadProcessorService";
import {
  UploadStatus,
  UploadProgressResponse,
} from "../../api/uploadProcessor/uploadProcessorType";
import axios from "axios";

interface UploadAndScriptTaskProps {
  updateTaskLog: (task: string, log: any) => void;
  clearTaskLog: (task: string) => void;
  setUploadStatuses: React.Dispatch<React.SetStateAction<UploadStatus[]>>;
}

const UploadAndScriptTask: React.FC<UploadAndScriptTaskProps> = ({
  updateTaskLog,
  clearTaskLog,
  setUploadStatuses,
}) => {
  const {
    selectedFile,
    uploadMessage,
    loading,
    isUploading,
    handleFileChange,
    handleUpload,
    handleFallback,
  } = useUploadProcessorHook({
    updateTaskLog,
    clearTaskLog,
    setUploadStatuses,
  });

  // Dedicated progress polling for Excel operations
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isUploading) {
      interval = setInterval(async () => {
        try {
          await configPromise;
          const { data } = await axios.get<UploadProgressResponse>(
            `${API_BASE_URL}/upload-progress`
          );
          setUploadStatuses((prev) =>
            prev.map((s) =>
              s.fileName === "excel_upload_progress"
                ? {
                    ...s,
                    progress:
                      data.totalRows > 0
                        ? (data.processedRows / data.totalRows) * 100
                        : 0,
                    totalFiles: data.totalRows,
                    processedFiles: data.processedRows,
                    successfulFiles: data.successfulRows,
                    errorFiles: data.errors,
                    notFoundFiles: data.notFound,
                  }
                : s
            )
          );
        } catch (error) {
          console.error("Progress fetch failed:", error);
        }
      }, 3000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isUploading, setUploadStatuses]);

  return (
    <UploadProcessorUI
      selectedFile={selectedFile}
      uploadMessage={uploadMessage}
      loading={loading}
      isUploading={isUploading}
      handleFileChange={handleFileChange}
      handleUpload={handleUpload}
      handleFallback={handleFallback}
      // Note: PDF Split and S3 props removed to maintain strict feature isolation
    />
  );
};

export default UploadAndScriptTask;
