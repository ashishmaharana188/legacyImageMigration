import { createFileRoute } from '@tanstack/react-router';
import UploadProcessorUI from '../api/uploadProcessor/uploadProcessorUI';
import { useTaskLog } from '../contexts/TaskLogContext';
import { useUploadProcessorHook } from '../api/uploadProcessor/uploadProcessorHook';


export const Route = createFileRoute('/upload-script')({
  component: () => {
    const { updateTaskLog, clearTaskLog, setUploadStatuses } = useTaskLog();
    const { selectedFile, uploadMessage, loading, isUploading, handleFileChange, handleUpload, handleFallback } = useUploadProcessorHook({
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
  },
});
