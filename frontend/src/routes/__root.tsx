import { createRootRoute } from '@tanstack/react-router';
import { WebSocketProvider } from '../contexts/WebSocketProvider';
import { TaskLogProvider } from '../contexts/TaskLogContext';
import App from '../App';

export const Route = createRootRoute({
  component: () => (
    <WebSocketProvider>
      <TaskLogProvider>
        <App />
      </TaskLogProvider>
    </WebSocketProvider>
  ),
});
