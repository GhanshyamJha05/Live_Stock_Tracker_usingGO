package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"stock-tracker/config"
	"stock-tracker/controllers"
	"stock-tracker/models"
	"stock-tracker/routes"
	"stock-tracker/services"
	"stock-tracker/utils"
	ws "stock-tracker/websocket"

	"github.com/gin-gonic/gin"
)

func main() {
	// Load configuration
	cfg := config.Load()

	// Set Gin mode
	if cfg.Env == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	// Initialize API client
	apiClient := utils.NewAPIClient(cfg.APIKey, cfg.APIProvider)

	// Initialize WebSocket hub
	wsHub := ws.NewHub()
	go wsHub.Run()

	// Initialize stock service
	stockService := services.NewStockService(apiClient, 30*time.Second)

	// Setup callback to broadcast updates to WebSocket clients
	stockService.SetUpdateCallback(func(update *models.StockUpdate) {
		wsHub.BroadcastUpdate(update)
	})

	// Start background updates for default stocks
	stockService.StartBackgroundUpdates(cfg.DefaultStocks, time.Duration(cfg.UpdateInterval)*time.Second)

	// Initialize controller
	stockController := controllers.NewStockController(stockService, wsHub)

	// Setup router
	router := gin.Default()
	routes.SetupRoutes(router, stockController)

	// Create HTTP server
	server := &http.Server{
		Addr:           ":" + cfg.Port,
		Handler:        router,
		ReadTimeout:    15 * time.Second,
		WriteTimeout:   15 * time.Second,
		MaxHeaderBytes: 1 << 20,
	}

	// Start server in a goroutine
	go func() {
		log.Printf("[Server] Starting on http://localhost:%s", cfg.Port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("[Server] Fatal error: %v", err)
		}
	}()

	// Wait for interrupt signal
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	<-sigChan

	// Graceful shutdown
	log.Println("[Server] Shutting down gracefully...")

	// Stop background updates
	stockService.StopBackgroundUpdates()

	// Shutdown server with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		log.Printf("[Server] Shutdown error: %v", err)
	}

	log.Println("[Server] Shutdown complete")
}
