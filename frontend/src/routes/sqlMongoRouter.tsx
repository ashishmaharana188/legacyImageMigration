import { createFileRoute } from '@tanstack/react-router';
import { useTaskLog } from '../contexts/TaskLogContext';
import SQLTaskUI from '../api/imageDataTransfer/sqlTaskUI';
import MongoTaskUI from '../api/imageDataTransfer/mongoTaskUI';
import { useSQLTaskHook } from '../api/imageDataTransfer/sqlTaskHook';
import { useMongoTaskHook } from '../api/imageDataTransfer/mongoTaskHook';

export const Route = createFileRoute('/sqlMongoRouter')({
  component: ImageDataTransferComponent,
});

function ImageDataTransferComponent() {
  const { updateTaskLog, onClearLogs: clearTaskLog } = useTaskLog();
  const sqlTaskProps = useSQLTaskHook({ updateTaskLog, clearTaskLog });
  const mongoTaskProps = useMongoTaskHook({ updateTaskLog, clearTaskLog });

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-bold text-black">Image Data Transfer Operations</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SQLTaskUI {...sqlTaskProps} />
        <MongoTaskUI {...mongoTaskProps} />
      </div>
    </div>
  );
}
