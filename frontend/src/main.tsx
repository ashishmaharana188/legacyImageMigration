import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

// [CRITICAL] Import from the UNIFIED file
import { TaskLogProvider } from "./contexts/TaskLogContext";
import { WebSocketProvider } from "./contexts/WebSocketProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
// [FIX] Import Query Client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const router = createRouter({ routeTree });

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {/* 1. The Data Store (Must be Top Level) */}
    <TaskLogProvider>
      {/* 2. The Connection (Must be inside Data Store) */}
      <WebSocketProvider>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </WebSocketProvider>
    </TaskLogProvider>
  </React.StrictMode>
);
