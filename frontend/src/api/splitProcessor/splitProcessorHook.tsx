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

  // [CLEANUP] Removed manual socket listeners.
  // State updates now flow via Context -> SummaryDisplay

  const handleSplitFiles = async () => {
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
