import { useState } from "react";
import Sidebar from "./components/ui/Sidebar";
import { SummaryDisplay } from "./api/Global/summaryDisplay";
import { PanelGroup, Panel, PanelResizeHandle } from "react-resizable-panels";
import { Outlet } from "@tanstack/react-router";
import { useTaskLog } from "../src/hooks/useTaskLog";

const App: React.FC = () => {
  const [open, setOpen] = useState(false);
  const { taskLogs, uploadStatuses, onClearLogs } = useTaskLog();

  const handleDrawerOpen = () => {
    setOpen(true);
  };

  const handleDrawerClose = () => {
    setOpen(false);
  };

  return (
    <div
      className="flex min-h-screen"
      style={{ backgroundColor: "whitesmoke" }}
    >
      <Sidebar
        open={open}
        handleDrawerOpen={handleDrawerOpen}
        handleDrawerClose={handleDrawerClose}
        onSelectTask={() => setOpen(false)}
      />
      <PanelGroup direction="horizontal" className="flex-grow">
        <Panel defaultSize={67} minSize={10}>
          <div className="p-4 border-r border-gray-300 h-full overflow-y-auto">
            <SummaryDisplay
              taskLogs={taskLogs}
              uploadStatuses={uploadStatuses}
              onClearLogs={onClearLogs}
            />
          </div>
        </Panel>
        <PanelResizeHandle className="w-2 h-250 bg-gray-300 hover:bg-gray-400 cursor-ew-resize" />
        <Panel defaultSize={67} minSize={20}>
          <main className="flex-grow p-4 w-full h-full">
            <Outlet />
          </main>
        </Panel>
      </PanelGroup>
    </div>
  );
};

export default App;
