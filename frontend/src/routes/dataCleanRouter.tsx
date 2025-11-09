import { createFileRoute } from '@tanstack/react-router';
import SanityCheckUI from '../api/dataClean/sanityCheckUI';
import { useSanityCheckHook } from '../api/dataClean/sanityCheckHook';
import { useTaskLog } from '../hooks/useTaskLog';

function SanityCheckComponent() {
  const { updateTaskLog, onClearLogs: clearTaskLog } = useTaskLog();
  const sanityCheckProps = useSanityCheckHook({ updateTaskLog, clearTaskLog });

  return <SanityCheckUI {...sanityCheckProps} />;
}

export const Route = createFileRoute('/sanity-check')({
  component: SanityCheckComponent,
});
