import { createFileRoute } from "@tanstack/react-router";
import UploadProcessorUI from "../api/uploadProcessor/uploadProcessorUI";
import { useTaskLog } from "../contexts/TaskLogContext";
import { useUploadProcessorHook } from "../api/uploadProcessor/uploadProcessorHook";

function UploadProcessorComponent() {
  const { updateTaskLog, onClearLogs, setUploadStatuses } = useTaskLog();

  const {
    selectedFile,
    uploadMessage,
    loading,
    isUploading,
    handleFileChange,
    handleUpload,
    handleFallback,
    // Athena Extract
    athenaQuery,
    athenaResults,
    athenaError, // <-- [FIX] Added missing athenaError here
    setAthenaQuery,
    handleRunAthena,
    downloadAthenaCsv,
  } = useUploadProcessorHook({
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
      // Athena Pass Down
      athenaQuery={athenaQuery}
      athenaResults={athenaResults}
      athenaError={athenaError} // <-- [FIX] Passed it to the UI here
      setAthenaQuery={setAthenaQuery}
      handleRunAthena={handleRunAthena}
      downloadAthenaCsv={downloadAthenaCsv}
    />
  );
}

export const Route = createFileRoute("/uploadProcessorRouter")({
  component: UploadProcessorComponent,
});
