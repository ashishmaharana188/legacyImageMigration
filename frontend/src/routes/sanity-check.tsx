import { createFileRoute } from '@tanstack/react-router';
import SanityCheckTask from '../components/action/SanityCheckTask';
import { useTaskLog } from '../contexts/TaskLogContext';

export const Route = createFileRoute('/sanity-check')({
  component: () => {
    const { updateTaskLog, onClearLogs: clearTaskLog } = useTaskLog();
    return <SanityCheckTask updateTaskLog={updateTaskLog} clearTaskLog={clearTaskLog} />;
  },
});
