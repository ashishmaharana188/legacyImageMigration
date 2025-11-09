import { createFileRoute } from '@tanstack/react-router';
import SanityCheckTask from '../components/action/SanityCheckTask';
import { useTaskLog } from '../hooks/useTaskLog';

function SanityCheckComponent() {
  const { updateTaskLog, onClearLogs: clearTaskLog } = useTaskLog();
  return <SanityCheckTask updateTaskLog={updateTaskLog} clearTaskLog={clearTaskLog} />;
}

export const Route = createFileRoute('/sanity-check')({
  component: SanityCheckComponent,
});
