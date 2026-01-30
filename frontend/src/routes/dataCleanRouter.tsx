import { createFileRoute } from "@tanstack/react-router";
import SanityCheckUI from "../api/dataClean/sanityCheckUI";
import { useSanityCheckHook } from "../api/dataClean/sanityCheckHook";
// [FIX] Correct Import Path
import { useTaskLog } from "../contexts/TaskLogContext";

function SanityCheckComponent() {
  const { updateTaskLog, onClearLogs: clearTaskLog } = useTaskLog();
  const sanityCheckProps = useSanityCheckHook({ updateTaskLog, clearTaskLog });

  return <SanityCheckUI {...sanityCheckProps} />;
}

export const Route = createFileRoute("/dataCleanRouter")({
  component: SanityCheckComponent,
});
