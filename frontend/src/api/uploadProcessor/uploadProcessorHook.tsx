import { useState, useEffect } from "react";
import {
  handleFileChange as utilHandleFileChange,
  handleUpload as utilHandleUpload,
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
      // Listen for all excel-related message types
      const isExcelMsg = [
        "progressUpdate",
        "progressComplete",
        "excelProcessingUpdate",
        "excelProcessingComplete",
      ].includes(msg.type);

      if (isExcelMsg) {
        const progress =
          msg.totalRows > 0 ? (msg.processedRows / msg.totalRows) * 100 : 0;

        setUploadStatuses((prev: UploadStatus[]) => {
          // Use "excel_processing" as the unique identifier for UI bars
          const others = prev.filter(
            (s: UploadStatus) => s.fileName !== "excel_processing"
          );
          return [
            ...others,
            {
              fileName: "excel_processing",
              status: msg.type.includes("Complete") ? "Done" : "Processing...",
              progress: progress,
              totalFiles: msg.totalRows,
              processedFiles: msg.processedRows,
              successfulFiles: msg.successfulRows || 0,
              errorFiles: msg.errorRows || 0,
              notFoundFiles: msg.notFound || 0,
            },
          ];
        });

        if (msg.type.includes("Complete")) {
          setUploadMessage("Processing Complete.");
          setLoading(false);
          setIsUploading(false);
        }
      }
    };

    webSocketService.addListener(handleMessage);
    return () => webSocketService.removeListener(handleMessage);
  }, [setUploadStatuses]);

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
  };
};

export const useUploadProgressSummary = ({
  uploadStatuses,
}: {
  uploadStatuses: UploadStatus[];
}) => {
  // Fixed: Look for the stable key used by the WebSocket processor
  const excelProcessingStatus =
    uploadStatuses.find((s) => s.fileName === "excel_processing") || null;
  const s3UploadStatus =
    uploadStatuses.find((s) => s.fileName === "s3_upload_progress") || null;
  return { excelProcessingStatus, s3UploadStatus };
};

// FIX: Added 'export' keyword to resolve SyntaxError
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
