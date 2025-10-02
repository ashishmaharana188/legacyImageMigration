import { createFileRoute } from '@tanstack/react-router';
import SanityCheckTask from '../components/action/SanityCheckTask';

export const Route = createFileRoute('/sanity-check')({
  component: SanityCheckTask,
});
