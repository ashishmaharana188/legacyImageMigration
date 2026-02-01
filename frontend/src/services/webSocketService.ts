import { WebSocketMessage } from "./webSocketMessageProcessor";

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
      console.log("WebSocket Connection already active.");
      return;
    }

    console.log("Attempting to connect to WebSocket...");
    this.ws = new WebSocket("ws://localhost:3000");

    this.ws.onopen = (event) => {
      console.log("WebSocket Connection OPENED.");
      this.openHandlers.forEach((handler) => handler(event));
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        if (this.messageListeners.size === 0) {
          console.warn("Message received but NO LISTENERS attached!");
        }

        this.messageListeners.forEach((handler) => handler(message));
      } catch (error) {
        console.error("Failed to parse WebSocket message:", event.data);
      }
    };

    this.ws.onclose = (event) => {
      console.log("WebSocket Connection CLOSED.");
      this.closeHandlers.forEach((handler) => handler(event));
    };

    this.ws.onerror = (event) => {
      console.error("WebSocket Connection ERROR:", event);
      this.errorHandlers.forEach((handler) => handler(event));
    };
  }

  public disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  public addListener(handler: MessageHandler) {
    this.messageListeners.add(handler);
  }

  public removeListener(handler: MessageHandler) {
    this.messageListeners.delete(handler);
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
