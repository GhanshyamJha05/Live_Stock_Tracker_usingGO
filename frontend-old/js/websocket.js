/**
 * WebSocket Management
 * Handles real-time connection, reconnection logic, and message handling
 */

class WebSocketManager {
    constructor(url = null) {
        this.url = url || this.getWebSocketURL();
        this.ws = null;
        this.isConnecting = false;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.reconnectDelay = 2000; // Start with 2 seconds
        this.maxReconnectDelay = 30000; // Max 30 seconds
        this.messageHandlers = {};
        this.setupHandlers();
    }

    /**
     * Build WebSocket URL from current location
     */
    getWebSocketURL() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        return `${protocol}//${window.location.host}/ws`;
    }

    /**
     * Setup event handlers
     */
    setupHandlers() {
        this.messageHandlers['update'] = [];
        this.messageHandlers['list'] = [];
        this.messageHandlers['error'] = [];
    }

    /**
     * Connect to WebSocket server
     */
    connect() {
        if (this.isConnecting || this.isConnected) {
            console.log('[WebSocket] Already connecting or connected');
            return;
        }

        this.isConnecting = true;
        console.log('[WebSocket] Connecting to', this.url);

        try {
            this.ws = new WebSocket(this.url);

            this.ws.onopen = () => this.onOpen();
            this.ws.onmessage = (event) => this.onMessage(event);
            this.ws.onerror = (error) => this.onError(error);
            this.ws.onclose = () => this.onClose();
        } catch (error) {
            console.error('[WebSocket] Connection error:', error);
            this.onError(error);
        }
    }

    /**
     * Handle WebSocket connection opened
     */
    onOpen() {
        this.isConnecting = false;
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.reconnectDelay = 2000;
        console.log('[WebSocket] Connected');
        
        // Update UI
        document.getElementById('connectionStatus').textContent = '●';
        document.getElementById('connectionStatus').className = 'status-connected';

        // Emit connection event
        this.emit('connected');
    }

    /**
     * Handle incoming WebSocket messages
     */
    onMessage(event) {
        try {
            const message = JSON.parse(event.data);
            console.log('[WebSocket] Message received:', message.type);

            // Call registered handlers for message type
            if (this.messageHandlers[message.type]) {
                this.messageHandlers[message.type].forEach(handler => {
                    try {
                        handler(message.data);
                    } catch (error) {
                        console.error('[WebSocket] Handler error:', error);
                    }
                });
            }
        } catch (error) {
            console.error('[WebSocket] Failed to parse message:', error);
        }
    }

    /**
     * Handle WebSocket errors
     */
    onError(error) {
        console.error('[WebSocket] Error:', error);
        this.emit('error', error);
    }

    /**
     * Handle WebSocket disconnection
     */
    onClose() {
        this.isConnecting = false;
        this.isConnected = false;
        console.log('[WebSocket] Disconnected');

        // Update UI
        document.getElementById('connectionStatus').textContent = '●';
        document.getElementById('connectionStatus').className = 'status-disconnected';

        // Attempt to reconnect
        this.attemptReconnect();
    }

    /**
     * Attempt to reconnect with exponential backoff
     */
    attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('[WebSocket] Max reconnect attempts reached');
            this.emit('reconnect_failed');
            return;
        }

        this.reconnectAttempts++;
        const delay = Math.min(
            this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1),
            this.maxReconnectDelay
        );

        console.log(`[WebSocket] Attempting to reconnect in ${Math.round(delay / 1000)}s (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

        setTimeout(() => {
            if (!this.isConnected) {
                this.connect();
            }
        }, delay);
    }

    /**
     * Subscribe to message type
     */
    on(messageType, handler) {
        if (!this.messageHandlers[messageType]) {
            this.messageHandlers[messageType] = [];
        }
        this.messageHandlers[messageType].push(handler);
    }

    /**
     * Emit custom events
     */
    emit(eventName, data) {
        const event = new CustomEvent(`ws_${eventName}`, { detail: data });
        document.dispatchEvent(event);
    }

    /**
     * Send message to WebSocket server
     */
    send(type, data = {}) {
        if (!this.isConnected) {
            console.warn('[WebSocket] Not connected, message not sent:', type);
            return false;
        }

        try {
            const message = { type, ...data };
            this.ws.send(JSON.stringify(message));
            console.log('[WebSocket] Message sent:', type);
            return true;
        } catch (error) {
            console.error('[WebSocket] Send error:', error);
            return false;
        }
    }

    /**
     * Subscribe to a stock symbol
     */
    subscribe(symbol) {
        return this.send('subscribe', { symbol });
    }

    /**
     * Unsubscribe from a stock symbol
     */
    unsubscribe(symbol) {
        return this.send('unsubscribe', { symbol });
    }

    /**
     * Request list of tracked stocks
     */
    getTrackedStocks() {
        return this.send('list');
    }

    /**
     * Disconnect WebSocket
     */
    disconnect() {
        if (this.ws) {
            this.ws.close();
        }
    }
}

// Export for use in other scripts
window.WebSocketManager = WebSocketManager;
