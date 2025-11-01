import { useState} from "react";
import {useSplitProcessorProps, SplitFile} from "./splitProcessorType"
import {
    handleSplitFiles as utilHandleSplitFiles,
    handleSplitFilesWithMuPDF as utilHandleSplitFilesWithMuPDF
} from "./splitProcessorUtil";


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
