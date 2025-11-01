import { createFileRoute } from '@tanstack/react-router';
import SplitProcessorUI from '../api/splitProcessor/splitProcessorUI';
import { useTaskLog } from '../contexts/TaskLogContext';
import {useSplitProcessorHook} from "../api/splitProcessor/splitProcessorHook"
import { useState } from 'react';

const SplitProcessorComponent = () => {
const { updateTaskLog, onClearLogs, setUploadStatuses } = useTaskLog()
const [selectedFile, setSelectedFile] = useState<File | null>(null);
const{splitMessage,loading,handleSplitFiles,handleSplitFilesWithMuPDF} = useSplitProcessorHook({
    updateTaskLog,
    clearTaskLog: onClearLogs,
    setUploadStatuses,
    selectedFile,
})

    return (

        <SplitProcessorUI
        splitMessage={splitMessage}
        loading={loading}
        handleSplitFiles={handleSplitFiles}
        handleSplitFilesWithMuPDF={handleSplitFilesWithMuPDF}
        selectedFile={selectedFile}
        setSelectedFile={setSelectedFile}
        />

    )
}

export const Route = createFileRoute('/splitProcessorRouter')({
  component: SplitProcessorComponent,
});
