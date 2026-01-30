import React, { useState } from "react";
import Sidebar from "./components/ui/Sidebar";
import { SummaryDisplay } from "./components/ui/SummaryDisplay";
import { PanelGroup, Panel, PanelResizeHandle } from "react-resizable-panels";
import { Outlet } from "@tanstack/react-router";

// [CRITICAL FIX] Use relative import. Do not use "../src/"
import { useTaskLog } from "./hooks/useTaskLog";

const App: React.FC = () => {
  const [open, setOpen] = useState(false);

  // Now this hook connects to the SAME context as the WebSocket
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
            {/* This will now receive live updates because it shares the context */}
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
