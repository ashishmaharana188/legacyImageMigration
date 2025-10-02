import { createFileRoute } from '@tanstack/react-router';
import S3BrowserTask from '../components/action/S3BrowserTask';

export const Route = createFileRoute('/s3-browser')({
  component: S3BrowserTask,
});
