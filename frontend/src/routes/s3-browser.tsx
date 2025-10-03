import { createFileRoute } from '@tanstack/react-router';
import S3BrowserTask from '../components/action/S3BrowserTask';
import { useTaskLog } from '../contexts/TaskLogContext';

export const Route = createFileRoute('/s3-browser')({
  component: () => {
    const { updateTaskLog, onClearLogs: clearTaskLog } = useTaskLog();
    return <S3BrowserTask updateTaskLog={updateTaskLog} clearTaskLog={clearTaskLog} />;
  },
});
