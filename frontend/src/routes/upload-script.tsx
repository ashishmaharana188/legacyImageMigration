import { createFileRoute } from '@tanstack/react-router';
import UploadAndScriptTask from '../components/action/UploadAndScriptTask';

export const Route = createFileRoute('/upload-script')({
  component: UploadAndScriptTask,
});
