import { createFileRoute } from '@tanstack/react-router';
import SplitProcessorUI from '../api/splitProcessor/splitProcessorUI';
import SplitProcessorSummary from '../api/splitProcessor/splitProcessorSummary';
import { useTaskLog } from '../contexts/TaskLogContext';
import {useSplitProcessorHook} from "../api/splitProcessor/splitProcessorHook"
import { useState } from 'react';

const SplitProcessorComponent = () => {
const { updateTaskLog, onClearLogs, setUploadStatuses } = useTaskLog()
const [selectedFile, setSelectedFile] = useState<File | null>(null);
const{splitMessage,loading,handleSplitFiles,handleSplitFilesWithMuPDF, splitFiles} = useSplitProcessorHook({
    updateTaskLog,
    clearTaskLog: onClearLogs,
    setUploadStatuses,
})

    return (
      <>
        <SplitProcessorUI
        loading={loading}
        handleSplitFiles={handleSplitFiles}
        handleSplitFilesWithMuPDF={handleSplitFilesWithMuPDF}
        selectedFile={selectedFile}
        setSelectedFile={setSelectedFile}
        />
        <SplitProcessorSummary
          splitMessage={splitMessage}
          splitFiles={splitFiles}
        />
      </>
    )
}

export const Route = createFileRoute('/splitProcessorRouter')({
  component: SplitProcessorComponent,
});
