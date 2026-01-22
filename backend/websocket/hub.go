package websocket

import (
	"encoding/json"
	"log"
	"sync"

	"stock-tracker/models"

	"github.com/gorilla/websocket"
)

// Hub manages WebSocket connections and broadcasts stock updates
type Hub struct {
	clients       map[*Client]bool // Registered clients
	broadcast     chan interface{} // Inbound messages from clients
	register      chan *Client     // Register requests from clients
	unregister    chan *Client     // Unregister requests from clients
	mutex         sync.RWMutex     // Protects clients map
	trackedStocks map[string]bool  // Symbols being tracked
	stockMutex    sync.RWMutex     // Protects trackedStocks
}

// Client represents a WebSocket client connection
type Client struct {
	Hub  *Hub
	Conn *websocket.Conn
	Send chan interface{} // Outbound messages
	ID   string           // Client ID
	mu   sync.Mutex
}

// Message represents a WebSocket message
type Message struct {
	Type    string      `json:"type"`    // "update", "subscribe", "unsubscribe", "list"
	Symbol  string      `json:"symbol"`  // Stock symbol
	Data    interface{} `json:"data"`    // Payload
	Symbols []string    `json:"symbols"` // For list messages
}

// NewHub creates a new WebSocket hub
func NewHub() *Hub {
	return &Hub{
		clients:       make(map[*Client]bool),
		broadcast:     make(chan interface{}, 256),
		register:      make(chan *Client),
		unregister:    make(chan *Client),
		trackedStocks: make(map[string]bool),
	}
}

// Run starts the hub event loop
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.registerClient(client)
			log.Printf("[Hub] Client registered: %s (Total: %d)", client.ID, len(h.clients))

		case client := <-h.unregister:
			h.unregisterClient(client)
			log.Printf("[Hub] Client unregistered: %s (Total: %d)", client.ID, len(h.clients))

		case message := <-h.broadcast:
			h.broadcastMessage(message)
		}
	}
}

// registerClient adds a client to the hub
func (h *Hub) registerClient(client *Client) {
	h.mutex.Lock()
	defer h.mutex.Unlock()
	h.clients[client] = true
}

// unregisterClient removes a client from the hub
func (h *Hub) unregisterClient(client *Client) {
	h.mutex.Lock()
	defer h.mutex.Unlock()

	if _, ok := h.clients[client]; ok {
		delete(h.clients, client)
		close(client.Send)
	}
}

// broadcastMessage sends a message to all connected clients
func (h *Hub) broadcastMessage(message interface{}) {
	h.mutex.RLock()
	defer h.mutex.RUnlock()

	for client := range h.clients {
		select {
		case client.Send <- message:
		default:
			// Client's send channel is full, skip to prevent blocking
			log.Printf("[Hub] Dropped message for client %s (channel full)", client.ID)
		}
	}
}

// BroadcastUpdate broadcasts a stock update to all clients
func (h *Hub) BroadcastUpdate(update *models.StockUpdate) {
	h.broadcast <- map[string]interface{}{
		"type": "update",
		"data": update,
	}
}

// BroadcastMessage broadcasts a custom message to all clients
func (h *Hub) BroadcastMessage(messageType string, data interface{}) {
	h.broadcast <- map[string]interface{}{
		"type": messageType,
		"data": data,
	}
}

// GetTrackedStocks returns a list of currently tracked stock symbols
func (h *Hub) GetTrackedStocks() []string {
	h.stockMutex.RLock()
	defer h.stockMutex.RUnlock()

	symbols := make([]string, 0, len(h.trackedStocks))
	for symbol := range h.trackedStocks {
		symbols = append(symbols, symbol)
	}
	return symbols
}

// AddTrackedStock adds a symbol to the tracked list
func (h *Hub) AddTrackedStock(symbol string) {
	h.stockMutex.Lock()
	defer h.stockMutex.Unlock()
	h.trackedStocks[symbol] = true
}

// RemoveTrackedStock removes a symbol from the tracked list
func (h *Hub) RemoveTrackedStock(symbol string) {
	h.stockMutex.Lock()
	defer h.stockMutex.Unlock()
	delete(h.trackedStocks, symbol)
}

// GetClientCount returns the number of connected clients
func (h *Hub) GetClientCount() int {
	h.mutex.RLock()
	defer h.mutex.RUnlock()
	return len(h.clients)
}

// HandleClient manages incoming and outgoing messages for a client
func (c *Client) HandleClient() {
	defer func() {
		c.Hub.unregister <- c
		c.Conn.Close()
	}()

	c.Conn.SetReadLimit(512000) // Max message size: 512KB

	for {
		// Read incoming messages
		_, rawMessage, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("[Client %s] WebSocket error: %v", c.ID, err)
			}
			break
		}

		// Parse message
		var msg Message
		if err := json.Unmarshal(rawMessage, &msg); err != nil {
			log.Printf("[Client %s] Failed to parse message: %v", c.ID, err)
			continue
		}

		// Handle based on message type
		c.handleMessage(&msg)
	}
}

// handleMessage processes incoming client messages
func (c *Client) handleMessage(msg *Message) {
	switch msg.Type {
	case "subscribe":
		if msg.Symbol != "" {
			c.Hub.AddTrackedStock(msg.Symbol)
			log.Printf("[Client %s] Subscribed to %s", c.ID, msg.Symbol)
		}

	case "unsubscribe":
		if msg.Symbol != "" {
			c.Hub.RemoveTrackedStock(msg.Symbol)
			log.Printf("[Client %s] Unsubscribed from %s", c.ID, msg.Symbol)
		}

	case "list":
		// Return list of tracked stocks
		symbols := c.Hub.GetTrackedStocks()
		c.Send <- map[string]interface{}{
			"type":    "list",
			"symbols": symbols,
		}

	default:
		log.Printf("[Client %s] Unknown message type: %s", c.ID, msg.Type)
	}
}

// SendMessage sends a message to the client
func (c *Client) SendMessage(data interface{}) {
	c.mu.Lock()
	defer c.mu.Unlock()

	select {
	case c.Send <- data:
	default:
		// Channel full, don't block
	}
}

// WriteMessages handles writing messages to the WebSocket connection
func (c *Client) WriteMessages() {
	defer c.Conn.Close()

	for message := range c.Send {
		c.Conn.SetWriteDeadline(nil) // No deadline for writes

		if err := c.Conn.WriteJSON(message); err != nil {
			log.Printf("[Client %s] Write error: %v", c.ID, err)
			return
		}
	}
}
