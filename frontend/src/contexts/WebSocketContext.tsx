import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';

// Define the types for the messages you expect from the WebSocket
// This should be expanded based on all possible message types
interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

interface WebSocketContextType {
  lastMessage: WebSocketMessage | null;
  // Connection status can be useful for the UI
  isConnected: boolean;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};

interface WebSocketProviderProps {
  children: ReactNode;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ children }) => {
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const reconnectAttempts = useRef(0);
  const ws = useRef<WebSocket | null>(null);
  // Use a ref for the reconnect timeout to avoid issues with state updates in timeouts
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);


  useEffect(() => {
    const connectWebSocket = () => {
      ws.current = new WebSocket("ws://localhost:3000");

      ws.current.onopen = () => {
        console.log("WebSocket connected");
        setIsConnected(true);
        if (reconnectTimeout.current) {
          clearTimeout(reconnectTimeout.current);
          reconnectTimeout.current = null;
        }
        reconnectAttempts.current = 0;
      };

      ws.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          setLastMessage(message);
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
        }
      };

      ws.current.onclose = () => {
        console.log("WebSocket disconnected. Attempting to reconnect...");
        setIsConnected(false);
        if (reconnectTimeout.current) {
          clearTimeout(reconnectTimeout.current);
        }
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
        reconnectTimeout.current = setTimeout(() => {
          reconnectAttempts.current++;
          connectWebSocket();
        }, delay);
      };

      ws.current.onerror = (error) => {
        console.error("WebSocket error:", error);
        ws.current?.close();
      };
    };

    connectWebSocket();

    return () => {
      if (ws.current) {
        ws.current.close();
      }
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
    };
  }, []);

  const value = {
    lastMessage,
    isConnected,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};
