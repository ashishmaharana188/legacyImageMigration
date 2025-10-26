import { useState, useEffect} from "react";
import {useSplitProcessorProps} from "./splitProcessorType"


export const useSplitProcessorHook = ({
    updateTaskLog,
    clearTaskLog,
    setUploadStatuses
}: useSplitProcessorProps) => {
    const [loading, setLoading] = useState<boolean>(false);
    const [splitMessage, setSplitMessage] = useState<string>("");
    const [isUploading, setIsUploading] = useState<boolean>(false);


    const handleSplitFiles = async () => {
        await utilHandleSplitFiles(
            setLoading: setLoading,
            setSplitMessage: setLoading,
            setIsUploading: setIsUploading,
        )
    };

    const handleSplitFilesWithMuPDF = async () => {

    };

    return {
        loading,
        splitMessage,
        isUploading,
        handleSplitFiles,
        handleSplitFilesWithMuPDF

    }
};
