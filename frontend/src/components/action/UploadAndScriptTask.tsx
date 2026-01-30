import React from "react"; // Removed useEffect
import UploadProcessorUI from "../ui/UploadAndScriptUI";
import { useUploadProcessorHook } from "../../api/uploadProcessor/uploadProcessorHook";
import { UploadStatus } from "../../api/uploadProcessor/uploadProcessorType";

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

  return (
    <UploadProcessorUI
      selectedFile={selectedFile}
      uploadMessage={uploadMessage}
      loading={loading}
      isUploading={isUploading}
      handleFileChange={handleFileChange}
      handleUpload={handleUpload}
      handleFallback={handleFallback}
    />
  );
};

export default UploadAndScriptTask;
