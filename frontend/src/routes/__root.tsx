import { createRootRoute } from "@tanstack/react-router";
import { TaskLogProvider } from "../contexts/TaskLogContext";
import App from "../App";

export const Route = createRootRoute({
  component: () => (
    <TaskLogProvider>
      <App />
    </TaskLogProvider>
  ),
});
