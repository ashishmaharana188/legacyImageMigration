import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

// [CRITICAL] Import from the UNIFIED file
import { TaskLogProvider } from "./contexts/TaskLogContext";
import { WebSocketProvider } from "./contexts/WebSocketProvider";

const router = createRouter({ routeTree });

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {/* 1. The Data Store (Must be Top Level) */}
    <TaskLogProvider>
      {/* 2. The Connection (Must be inside Data Store) */}
      <WebSocketProvider>
        <RouterProvider router={router} />
      </WebSocketProvider>
    </TaskLogProvider>
  </React.StrictMode>
);
