import { createFileRoute } from '@tanstack/react-router';
import SplitProcessorUI from '../api/splitProcessor/splitProcessorUI';
import SplitProcessorSummaryUI from '../api/splitProcessor/splitProcessorSummaryUI';
import { useTaskLog } from '../contexts/TaskLogContext';
import {useSplitProcessorHook} from "../api/splitProcessor/splitProcessorHook"

const SplitProcessorComponent = () => {
const { updateTaskLog, onClearLogs, setUploadStatuses } = useTaskLog()
const{splitMessage,loading,handleSplitFiles,handleSplitFilesWithMuPDF, totalSplitFilesGenerated} = useSplitProcessorHook({
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
        />
        <SplitProcessorSummaryUI
          splitMessage={splitMessage}
          totalSplitFilesGenerated={totalSplitFilesGenerated}
        />
      </>
    )
}

export const Route = createFileRoute('/splitProcessorRouter')({
  component: SplitProcessorComponent,
});
