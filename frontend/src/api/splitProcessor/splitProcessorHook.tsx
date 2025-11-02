import { useState, useCallback, useEffect, useRef } from "react";
import {useSplitProcessorProps, SplitFile, SplitProgressMessage} from "./splitProcessorType"
import {
    handleSplitFiles as utilHandleSplitFiles,
    handleSplitFilesWithMuPDF as utilHandleSplitFilesWithMuPDF
} from "./splitProcessorUtil";
import { webSocketService } from "../../services/webSocketService";


export const useSplitProcessorHook = ({
    updateTaskLog,
    clearTaskLog,
    setUploadStatuses
}: useSplitProcessorProps) => {
    const [loading, setLoading] = useState<boolean>(false);
    const [splitMessage, setSplitMessage] = useState<string>("");
    const [isUploading, setIsUploading] = useState<boolean>(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [splitFiles, setSplitFiles] = useState<SplitFile[]>([]);

    // Refs for throttling
    const splitProgressLatestRef = useRef<SplitProgressMessage | null>(null);
    const throttleTimerRef = useRef<number | null>(null);
    const THROTTLE_INTERVAL = 200; // Update UI every 200ms

    const applyThrottledUpdates = useCallback(() => {
        // Apply latest split progress
        const latestSplitMessage = splitProgressLatestRef.current;
        if (latestSplitMessage) {
            setUploadStatuses((prev) => {
                const newStatuses = prev.filter(
                    (s) => s.fileName !== "splitting_progress"
                );
                const isComplete = latestSplitMessage.type === "splitProgressComplete";
                const progress = isComplete
                    ? 100
                    : latestSplitMessage.totalExpectedSplits > 0
                        ? (latestSplitMessage.totalSplitFilesGenerated /
                            latestSplitMessage.totalExpectedSplits) *
                        100
                        : 0;

                newStatuses.push({
                    fileName: "splitting_progress",
                    status: isComplete
                        ? "Done"
                        : latestSplitMessage.status || "In Progress",
                    progress: progress,
                    ...latestSplitMessage,
                });
                return newStatuses;
            });
            updateTaskLog("splitFiles", { splitSummary: latestSplitMessage });
            splitProgressLatestRef.current = null;
        }

        throttleTimerRef.current = null;
    }, [setUploadStatuses, updateTaskLog]);

    useEffect(() => {
        const handleMessage = (message: SplitProgressMessage) => {
            let needsUpdate = false;

            if (
                message.type === "splitProgressUpdate" ||
                message.type === "splitProgressComplete"
            ) {
                splitProgressLatestRef.current = message;
                needsUpdate = true;
            }

            if (needsUpdate && !throttleTimerRef.current) {
                throttleTimerRef.current = window.setTimeout(
                    applyThrottledUpdates,
                    THROTTLE_INTERVAL
                );
            }
        };

        webSocketService.addListener(handleMessage);

        return () => {
            webSocketService.removeListener(handleMessage);
            if (throttleTimerRef.current) {
                window.clearTimeout(throttleTimerRef.current);
            }
        };
    }, [applyThrottledUpdates]);


    const handleSplitFiles = async () => {
        await utilHandleSplitFiles(
            selectedFile,
            updateTaskLog,
            clearTaskLog,
            setSplitMessage,
            setLoading,
            setIsUploading,
            setUploadStatuses,
            setSplitFiles
        )
    };

    const handleSplitFilesWithMuPDF = async () => {
        await utilHandleSplitFilesWithMuPDF(
            selectedFile,
            updateTaskLog,
            clearTaskLog,
            setSplitMessage,
            setLoading,
            setIsUploading,
            setUploadStatuses,
            setSplitFiles
        )
    };

    return {
        loading,
        splitMessage,
        isUploading,
        handleSplitFiles,
        handleSplitFilesWithMuPDF,
        selectedFile,
        setSelectedFile,
        splitFiles

    }
};
