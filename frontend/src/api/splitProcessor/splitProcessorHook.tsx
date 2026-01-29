import { useState, useCallback, useEffect } from "react";
import {
  useSplitProcessorProps,
  SplitProgressMessage,
} from "./splitProcessorType";
import {
  handleSplitFiles as utilHandleSplitFiles,
  handleSplitFilesWithMuPDF as utilHandleSplitFilesWithMuPDF,
} from "./splitProcessorUtil";
import { webSocketService } from "../../services/webSocketService";
import { WebSocketMessage } from "../../services/webSocketMessageProcessor";

export const useSplitProcessorHook = ({
  updateTaskLog,
  clearTaskLog,
  setUploadStatuses,
}: useSplitProcessorProps) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [splitMessage, setSplitMessage] = useState<string>("");
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [totalSplitFilesGenerated, setTotalSplitFilesGenerated] =
    useState<number>(0);
  const [splitFiles, setSplitFiles] = useState<string[]>([]);

  const applyThrottledUpdates = useCallback(
    (message: SplitProgressMessage) => {
      setUploadStatuses((prev) => {
        const newStatuses = prev.filter(
          (s) => s.fileName !== "splitting_progress"
        );
        const isComplete = message.type === "splitProgressComplete";
        const progress = isComplete
          ? 100
          : message.totalExpectedPagesFromCsv &&
            message.totalExpectedPagesFromCsv > 0
          ? (message.totalSplitFilesGenerated /
              message.totalExpectedPagesFromCsv) *
            100
          : 0;

        newStatuses.push({
          fileName: "splitting_progress",
          status: isComplete ? "Done" : message.status || "In Progress",
          progress: progress,
          ...message,
        });
        return newStatuses;
      });

      updateTaskLog("splitFiles", {
        id: "splitting-status",
        splitSummary: message,
      });

      setTotalSplitFilesGenerated(message.totalSplitFilesGenerated);
    },
    [setUploadStatuses, updateTaskLog]
  );

  useEffect(() => {
    const handleMessage = (message: WebSocketMessage) => {
      if (
        message.type === "splitProgressUpdate" ||
        message.type === "splitProgressComplete"
      ) {
        applyThrottledUpdates(message as SplitProgressMessage);
      }
    };

    webSocketService.addListener(handleMessage);
    return () => webSocketService.removeListener(handleMessage);
  }, [applyThrottledUpdates]);

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
    totalSplitFilesGenerated,
    splitFiles,
    setSplitFiles,
  };
};
