import { createFileRoute } from '@tanstack/react-router';
import SQLAndMongoTask from '../components/action/SQLAndMongoTask';
import { useTaskLog } from '../contexts/TaskLogContext';

export const Route = createFileRoute('/sql-mongo')({
  component: () => {
    const { updateTaskLog, onClearLogs: clearTaskLog } = useTaskLog();
    return <SQLAndMongoTask updateTaskLog={updateTaskLog} clearTaskLog={clearTaskLog} />;
  },
});
