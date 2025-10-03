// src/services/webSocketService.ts

type MessageHandler = (message: any) => void;

class WebSocketService {
    private ws: WebSocket | null = null;
    private listeners: Set<MessageHandler> = new Set();

    constructor() {
        this.connect();
    }

    private connect() {
        if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
            return;
        }

        this.ws = new WebSocket("ws://localhost:3000");

        this.ws.onopen = () => {
            console.log("WebSocket connection opened (Singleton)");
        };

        this.ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                this.listeners.forEach(handler => handler(message));
            } catch (error) {
                console.error("Failed to parse WebSocket message:", event.data);
            }
        };

        this.ws.onclose = () => {
            console.log("WebSocket connection closed (Singleton). Reconnecting...");
            setTimeout(() => this.connect(), 1000);
        };

        this.ws.onerror = (error) => {
            console.error("WebSocket error (Singleton):", error);
            this.ws?.close();
        };
    }

    public addListener(handler: MessageHandler) {
        this.listeners.add(handler);
    }

    public removeListener(handler: MessageHandler) {
        this.listeners.delete(handler);
    }
}

export const webSocketService = new WebSocketService();
