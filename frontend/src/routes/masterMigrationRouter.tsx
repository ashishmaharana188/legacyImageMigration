import { createFileRoute } from "@tanstack/react-router";
import MasterMigrationUI from "../api/masterMigration/masterMigrationUI";
import { useMasterMigrationHook } from "../api/masterMigration/masterMigrationHook";
import { useTaskLog } from "../contexts/TaskLogContext";

function MasterMigrationComponent() {
  const { updateTaskLog, onClearLogs: clearTaskLog } = useTaskLog();
  const masterMigrationUIProps = useMasterMigrationHook({
    updateTaskLog,
    clearTaskLog,
  });

  return <MasterMigrationUI {...masterMigrationUIProps} />;
}

export const Route = createFileRoute("/masterMigrationRouter")({
  component: MasterMigrationComponent,
});
