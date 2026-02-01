import { createFileRoute } from "@tanstack/react-router";
import SQLTaskUI from "../api/imageDataTransfer/sqlTaskUI";
import MongoTaskUI from "../api/imageDataTransfer/mongoTaskUI";
import SQLAndMongoUI from "@/components/ui/SQLAndMongoUI";
// [FIX] Import the renamed hooks
import { useSqlTask } from "../api/imageDataTransfer/sqlTaskHook";
import { useMongoTask } from "../api/imageDataTransfer/mongoTaskHook";

export const Route = createFileRoute("/sqlMongoRouter")({
  component: ImageDataTransferComponent,
});

function ImageDataTransferComponent() {
  // [FIX] Hooks now self-manage context, no args needed
  const sqlTaskProps = useSqlTask();
  const mongoTaskProps = useMongoTask();

  return (
    <div className="flex flex-col gap-4 p-4">
      <h2 className="text-xl font-bold text-black mb-2">
        Image Data Transfer Operations
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SQLTaskUI {...sqlTaskProps} />
        <MongoTaskUI {...mongoTaskProps} />
      </div>
    </div>
  );
}
