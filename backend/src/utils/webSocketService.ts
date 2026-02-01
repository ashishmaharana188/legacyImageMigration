import { WebSocketServer, WebSocket } from "ws";
import { Server } from "http";

let wss: WebSocketServer;

export const initWebSocket = (server: Server) => {
  // [FIX] Assign to the module-level variable
  wss = new WebSocketServer({ server });

  wss.on("connection", (ws: WebSocket) => {
    console.log("Client successfully connected to WebSocket server");
    ws.on("close", () => {
      console.log("Client disconnected");
    });
    ws.on("error", (err) => {
      console.error("WebSocket client error:", err);
    });
  });

  console.log("WebSocket server initialized");

  // [FIX] Return the instance so app.ts can use it
  return wss;
};

export const broadcast = (message: string) => {
  if (!wss) {
    console.error("WebSocket server not initialized");
    return;
  }
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
};
