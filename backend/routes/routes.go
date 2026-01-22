package routes

import (
	"stock-tracker/controllers"
	"stock-tracker/middleware"

	"github.com/gin-gonic/gin"
)

// SetupRoutes configures all API routes
func SetupRoutes(router *gin.Engine, stockController *controllers.StockController) {
	// Apply middleware
	router.Use(middleware.CORS(nil))
	router.Use(middleware.ErrorHandler())

	// Static files serving
	router.Static("/", "./frontend")

	// API endpoints
	api := router.Group("/api")
	{
		// Stock endpoints
		stocks := api.Group("/stocks")
		{
			stocks.GET("/:symbol", stockController.GetStock)
			stocks.GET("", stockController.GetMultipleStocks)
			stocks.GET("/search", stockController.SearchStocks)
			stocks.GET("/defaults", stockController.GetDefaults)
		}

		// Cache endpoints
		cache := api.Group("/cache")
		{
			cache.POST("/invalidate", stockController.InvalidateCache)
		}

		// Health check
		api.GET("/health", stockController.GetHealth)
	}

	// WebSocket endpoint
	router.GET("/ws", stockController.WebSocketHandler)

	// Catch-all for serving index.html
	router.NoRoute(func(c *gin.Context) {
		c.File("./frontend/index.html")
	})
}
