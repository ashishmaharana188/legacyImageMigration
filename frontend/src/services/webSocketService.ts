// [FIX] Ensure this path points to where you actually defined the interface
// If it's not in webSocketMessageProcessor, change this to: import { WebSocketMessage } from '../types';
import { WebSocketMessage } from "./webSocketMessageProcessor";

// [FIX] Use the imported type instead of 'any' to resolve the "unused variable" error
type MessageHandler = (message: WebSocketMessage) => void;
type EventHandler = (event: Event) => void;

class WebSocketService {
  private ws: WebSocket | null = null;
  private messageListeners: Set<MessageHandler> = new Set();
  private openHandlers: Set<EventHandler> = new Set();
  private closeHandlers: Set<EventHandler> = new Set();
  private errorHandlers: Set<EventHandler> = new Set();

  public connect() {
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING)
    ) {
      console.log("[WS-DEBUG] Connection already active.");
      return;
    }

    console.log("[WS-DEBUG] Attempting to connect to ws://localhost:3000");
    this.ws = new WebSocket("ws://localhost:3000");

    this.ws.onopen = (event) => {
      console.log("[WS-DEBUG] Connection OPENED.");
      this.openHandlers.forEach((handler) => handler(event));
    };

    this.ws.onmessage = (event) => {
      // RAW LOG: See exactly what the backend sends before parsing
      console.log("[WS-DEBUG] RAW WS FRAME RECEIVED:", event.data);

      try {
        const message = JSON.parse(event.data);

        if (this.messageListeners.size === 0) {
          console.warn(
            "[WS-DEBUG] Message received but NO LISTENERS attached!"
          );
        }

        this.messageListeners.forEach((handler) => handler(message));
      } catch (error) {
        console.error("[WS-DEBUG] Failed to parse message:", event.data);
      }
    };

    this.ws.onclose = (event) => {
      console.log("[WS-DEBUG] Connection CLOSED.");
      this.closeHandlers.forEach((handler) => handler(event));
    };

    this.ws.onerror = (event) => {
      console.error("[WS-DEBUG] Connection ERROR:", event);
      this.errorHandlers.forEach((handler) => handler(event));
    };
  }

  public disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  // [FIX] Updated signature to match the type definition
  public addListener(handler: MessageHandler) {
    console.log(
      "[WS-DEBUG] Listener Added. Total Listeners:",
      this.messageListeners.size + 1
    );
    this.messageListeners.add(handler);
  }

  public removeListener(handler: MessageHandler) {
    this.messageListeners.delete(handler);
    console.log(
      "[WS-DEBUG] Listener Removed. Remaining:",
      this.messageListeners.size
    );
  }

  public onOpen(handler: EventHandler) {
    this.openHandlers.add(handler);
  }
  public removeOnOpen(handler: EventHandler) {
    this.openHandlers.delete(handler);
  }
  public onClose(handler: EventHandler) {
    this.closeHandlers.add(handler);
  }
  public removeOnClose(handler: EventHandler) {
    this.closeHandlers.delete(handler);
  }
  public onError(handler: EventHandler) {
    this.errorHandlers.add(handler);
  }
  public removeOnError(handler: EventHandler) {
    this.errorHandlers.delete(handler);
  }
}

export const webSocketService = new WebSocketService();
