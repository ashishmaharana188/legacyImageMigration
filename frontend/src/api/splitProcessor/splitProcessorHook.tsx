import { useState } from "react";
import { useSplitProcessorProps } from "./splitProcessorType";
import {
  handleSplitFiles as utilHandleSplitFiles,
  handleSplitFilesWithMuPDF as utilHandleSplitFilesWithMuPDF,
} from "./splitProcessorUtil";

export const useSplitProcessorHook = ({
  updateTaskLog,
  clearTaskLog,
  setUploadStatuses,
}: useSplitProcessorProps) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [splitMessage, setSplitMessage] = useState<string>("");
  const [isUploading, setIsUploading] = useState<boolean>(false);

  const handleSplitFiles = async () => {
    clearTaskLog("splitFiles");

    // 2. [FIX] Manually initialize the state immediately (Optimistic UI)
    updateTaskLog("splitFiles", {
      type: "splitProgressUpdate",
      status: "Starting...",
      totalExpectedPagesFromCsv: 0,
      totalSplitFilesGenerated: 0,
      splitErrors: 0,
      progress: 0,
      message: "Initiating split process...",
      timestamp: new Date().toISOString(),
    });

    // 3. Call Utility with ALL required arguments
    await utilHandleSplitFiles(
      updateTaskLog,
      clearTaskLog,
      setSplitMessage,
      setLoading,
      setIsUploading,
      setUploadStatuses
    );
  };

  const handleSplitFilesWithMuPDF = async () => {
    // 1. Clear old logs
    clearTaskLog("splitFiles");

    // 2. [FIX] Manually initialize the state immediately (Optimistic UI)
    updateTaskLog("splitFiles", {
      type: "splitProgressUpdate",
      status: "Starting (MuPDF)...",
      totalExpectedPagesFromCsv: 0,
      totalSplitFilesGenerated: 0,
      splitErrors: 0,
      progress: 0,
      message: "Initiating MuPDF split process...",
      timestamp: new Date().toISOString(),
    });

    // 3. Call Utility with ALL required arguments
    await utilHandleSplitFilesWithMuPDF(
      updateTaskLog,
      clearTaskLog,
      setSplitMessage,
      setLoading,
      setIsUploading,
      setUploadStatuses
    );
  };

  return {
    loading,
    splitMessage,
    isUploading,
    handleSplitFiles,
    handleSplitFilesWithMuPDF,
  };
};
