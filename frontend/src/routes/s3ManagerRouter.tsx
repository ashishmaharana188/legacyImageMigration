import { createFileRoute } from '@tanstack/react-router';
import S3BrowserUI from '../api/s3Manager/s3BrowserUI';
import S3UploadUI from '../api/s3Manager/s3UploadUI';
import { useS3BrowserHook, useS3UploadHook } from '../api/s3Manager/s3ManagerHook';
import { useTaskLog } from '../hooks/useTaskLog';

export const Route = createFileRoute('/s3ManagerRouter')({
  component: S3BrowserComponent,
});

function S3BrowserComponent() {
    const { updateTaskLog, onClearLogs: clearTaskLog, setUploadStatuses } = useTaskLog();
    const s3BrowserUIProps = useS3BrowserHook({ updateTaskLog, clearTaskLog });
    const s3UploadUIProps = useS3UploadHook({ updateTaskLog, clearTaskLog, setUploadStatuses });
    return (
      <div className="flex flex-col gap-4">
        <S3BrowserUI {...s3BrowserUIProps} />
        <S3UploadUI {...s3UploadUIProps} />
      </div>
    );
  }
