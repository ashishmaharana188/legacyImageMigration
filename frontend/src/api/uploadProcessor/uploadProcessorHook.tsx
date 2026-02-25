import { useState, useEffect } from "react";
import {
  handleFileChange as utilHandleFileChange,
  handleUpload as utilHandleUpload,
  handleFallback as utilHandleFallback,
  handleRunAthena as utilHandleRunAthena, // [NEW] Import the Athena utility
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

  // [NEW] Athena States
  const [athenaQuery, setAthenaQuery] = useState<string>('SELECT * FROM "your_database"."your_table" LIMIT 10;');
    const [athenaResults, setAthenaResults] = useState<string | null>(null);
    const [athenaError, setAthenaError] = useState<string | null>(null);

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

  // [NEW] Download CSV Helper (Kept in the hook as it interacts with DOM directly)
  // [NEW] Download CSV Helper and Auto-Select
  const downloadAthenaCsv = () => {
      if (!athenaResults) return;

      // 1. Create the CSV Blob
      const blob = new Blob([athenaResults], { type: "text/csv;charset=utf-8;" });
      const fileName = `athena_results_${Date.now()}.csv`;

      // 2. Trigger the browser download
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.click();

      // 3. Auto-Queue the file into the Upload Processor
      const generatedFile = new File([blob], fileName, { type: "text/csv" });
      setSelectedFile(generatedFile); // This immediately enables the "Upload and Process" button

      setUploadMessage(`Success! Automatically queued: ${fileName}`);
      setAthenaResults(null); // Optional: Clear results so the user knows they moved to the next step
    };

  return {
      selectedFile,
      uploadMessage,
      loading,
      isUploading,
      // Athena returns
      athenaQuery,
      athenaResults,
      athenaError,
      setAthenaQuery,
      downloadAthenaCsv,
      handleRunAthena: () =>
        utilHandleRunAthena(athenaQuery, setLoading, setAthenaResults, setAthenaError, setUploadMessage),
      // Existing returns
      handleFileChange: (e: any) =>
        utilHandleFileChange(e, setSelectedFile, setUploadMessage),
      handleUpload: () =>
        utilHandleUpload(selectedFile, updateTaskLog, clearTaskLog, setUploadMessage, setLoading, setIsUploading, setUploadStatuses),
      handleFallback: () =>
        utilHandleFallback(selectedFile, updateTaskLog, clearTaskLog, setUploadMessage, setLoading),
    };
};

// --- Your existing helper hooks remain completely untouched below ---

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
