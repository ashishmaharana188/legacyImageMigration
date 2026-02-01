import { useState, useEffect, useRef, useCallback } from "react";

// Define the return type explicitly so the Provider knows what it gets
interface UseWebSocketReturn {
  isConnected: boolean;
  sendMessage: (message: any) => void;
  lastMessage: any;
  setIsConnected: React.Dispatch<React.SetStateAction<boolean>>;
}

export const useWebSocket = (
  url: string = "ws://localhost:3000"
): UseWebSocketReturn => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<any>(null);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const socket = new WebSocket(url);
    socketRef.current = socket;

    socket.onopen = () => {
      console.log("WebSocket Connected");
      setIsConnected(true);
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setLastMessage(data);
      } catch (e) {
        console.error("Failed to parse WebSocket message", e);
      }
    };

    socket.onclose = () => {
      console.log("WebSocket Disconnected");
      setIsConnected(false);
    };

    return () => {
      socket.close();
    };
  }, [url]);

  const sendMessage = useCallback((message: any) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message));
    }
  }, []);

  return { isConnected, sendMessage, lastMessage, setIsConnected };
};
