import { createFileRoute } from '@tanstack/react-router';
import SplitProcessorUI from '../api/splitProcessor/splitProcessorUI';
import { useTaskLog } from '../contexts/TaskLogContext';
import {useSplitProcessorHook} from "../api/splitProcessor/splitProcessorHook"

const SplitProcessorComponent () {
const { updateTaskLog, onClearLogs, setUploadStatuses } = useTaskLog()
const{splitMessage,loading,handleSplitFiles,handleSplitFilesWithMuPDF} = useSplitProcessorHook({
    updateTaskLog,
    clearTaskLog: onClearLogs,
    setUploadStatuses,
})

    return (

        <SplitProcessorUI
        splitMessage={splitMessage}
        loading={loading}
        handleSplitFiles={handleSplitFiles}
        handleSplitFilesWithMuPDF={handleSplitFilesWithMuPDF}
        />

    )
}

export const Route = createFileRoute('/upload-processor')({
  component: SplitProcessorComponent,
});
