package controllers

import (
	"fmt"
	"net/http"
	"strings"

	"stock-tracker/models"
	"stock-tracker/services"
	"stock-tracker/websocket"

	"github.com/gin-gonic/gin"
	gwebsocket "github.com/gorilla/websocket"
)

// StockController handles HTTP requests related to stocks
type StockController struct {
	stockService *services.StockService
	wsHub        *websocket.Hub
}

// NewStockController creates a new stock controller
func NewStockController(stockService *services.StockService, wsHub *websocket.Hub) *StockController {
	return &StockController{
		stockService: stockService,
		wsHub:        wsHub,
	}
}

// GetStock retrieves a single stock's current data
// GET /api/stocks/:symbol
func (sc *StockController) GetStock(c *gin.Context) {
	symbol := strings.ToUpper(c.Param("symbol"))

	if symbol == "" {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Error:   "stock symbol is required",
		})
		return
	}

	stock, err := sc.stockService.GetStock(symbol)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Error:   fmt.Sprintf("failed to fetch stock data: %v", err),
		})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    stock,
	})
}

// GetMultipleStocks retrieves data for multiple stocks
// GET /api/stocks?symbols=AAPL,GOOGL,MSFT
func (sc *StockController) GetMultipleStocks(c *gin.Context) {
	symbolsParam := c.Query("symbols")

	if symbolsParam == "" {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Error:   "symbols query parameter is required",
		})
		return
	}

	// Parse comma-separated symbols
	symbols := strings.Split(symbolsParam, ",")
	for i, sym := range symbols {
		symbols[i] = strings.ToUpper(strings.TrimSpace(sym))
	}

	stocks := sc.stockService.GetMultipleStocks(symbols)

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    stocks,
	})
}

// SearchStocks searches for stocks by symbol or name
// GET /api/stocks/search?q=AAPL
func (sc *StockController) SearchStocks(c *gin.Context) {
	query := strings.ToUpper(c.Query("q"))

	if query == "" {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Error:   "search query is required",
		})
		return
	}

	results := sc.stockService.SearchStocks(query)

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    results,
	})
}

// GetDefaults retrieves default stock symbols
// GET /api/stocks/defaults
func (sc *StockController) GetDefaults(c *gin.Context) {
	// In a real application, these would come from config or database
	defaults := []string{"AAPL", "GOOGL", "MSFT", "AMZN", "TSLA", "META", "NVDA"}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    defaults,
	})
}

// WebSocketHandler handles WebSocket connections
// GET /ws
func (sc *StockController) WebSocketHandler(c *gin.Context) {
	// Upgrade HTTP connection to WebSocket
	upgrader := gwebsocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			// In production, validate origin more carefully
			return true
		},
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
	}

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Error:   fmt.Sprintf("failed to upgrade connection: %v", err),
		})
		return
	}

	// Create client
	clientID := c.RemoteIP() + "-" + fmt.Sprintf("%d", len(sc.wsHub.GetTrackedStocks()))
	client := &websocket.Client{
		Hub:  sc.wsHub,
		Conn: conn,
		Send: make(chan interface{}, 256),
		ID:   clientID,
	}

	// Register client
	sc.wsHub.Register <- client

	// Start reading and writing goroutines
	go client.HandleClient()
	go client.WriteMessages()
}

// GetHealth returns the health status of the API
// GET /api/health
func (sc *StockController) GetHealth(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":  "healthy",
		"clients": sc.wsHub.GetClientCount(),
		"tracked": len(sc.wsHub.GetTrackedStocks()),
	})
}

// InvalidateCache clears the stock cache
// POST /api/cache/invalidate
func (sc *StockController) InvalidateCache(c *gin.Context) {
	sc.stockService.InvalidateCache()
	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: "cache invalidated",
	})
}
