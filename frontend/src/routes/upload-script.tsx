import { createFileRoute } from '@tanstack/react-router';
import UploadAndScriptTask from '../components/action/UploadAndScriptTask';
import { useTaskLog } from '../contexts/TaskLogContext';

export const Route = createFileRoute('/upload-script')({
  component: () => {
    const { updateTaskLog, onClearLogs: clearTaskLog, setSummaryData, setUploadStatuses } = useTaskLog();
    return (
      <UploadAndScriptTask
        updateTaskLog={updateTaskLog}
        clearTaskLog={clearTaskLog}
        setSummaryData={setSummaryData}
        setUploadStatuses={setUploadStatuses}
      />
    );
  },
});
