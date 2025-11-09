// src/services/webSocketService.ts

import { WebSocketMessage } from './webSocketMessageProcessor';

type MessageHandler = (message: WebSocketMessage) => void;
type EventHandler = (event: Event) => void;

class WebSocketService {
    private ws: WebSocket | null = null;
    private messageListeners: Set<MessageHandler> = new Set();
    private openHandlers: Set<EventHandler> = new Set();
    private closeHandlers: Set<EventHandler> = new Set();
    private errorHandlers: Set<EventHandler> = new Set();

    constructor() {
        // Do not connect in constructor, let the consumer explicitly call connect.
    }

    public connect() {
        if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
            return;
        }

        this.ws = new WebSocket("ws://localhost:3000");

        this.ws.onopen = (event) => {
            console.log("WebSocket connection opened (Singleton)");
            this.openHandlers.forEach(handler => handler(event));
        };

        this.ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                this.messageListeners.forEach(handler => handler(message));
            } catch {
                console.error("Failed to parse WebSocket message:", event.data);
            }
        };

        this.ws.onclose = (event) => {
            console.log("WebSocket connection closed (Singleton)");
            this.closeHandlers.forEach(handler => handler(event));
        };

        this.ws.onerror = (event) => {
            console.error("WebSocket error (Singleton):", event);
            this.errorHandlers.forEach(handler => handler(event));
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
