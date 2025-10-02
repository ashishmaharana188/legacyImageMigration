import { createRootRoute, Outlet } from '@tanstack/react-router';
import { WebSocketProvider } from '../contexts/WebSocketContext';
import App from '../App';

export const Route = createRootRoute({
  component: () => (
    <WebSocketProvider>
      <App />
    </WebSocketProvider>
  ),
});
