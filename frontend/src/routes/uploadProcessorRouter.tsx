import { createFileRoute } from '@tanstack/react-router';
import UploadProcessorUI from '../api/uploadProcessor/uploadProcessorUI';
import { useTaskLog } from '../hooks/useTaskLog';
import { useUploadProcessorHook } from '../api/uploadProcessor/uploadProcessorHook';



function UploadProcessorComponent() {
  const { updateTaskLog, onClearLogs, setUploadStatuses } = useTaskLog();
  const { selectedFile, uploadMessage, loading, isUploading, handleFileChange, handleUpload, handleFallback } = useUploadProcessorHook({
    updateTaskLog,
    clearTaskLog: onClearLogs,
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
}

//tanstack setup
export const Route = createFileRoute('/uploadProcessorRouter')({
  component: UploadProcessorComponent,
});
