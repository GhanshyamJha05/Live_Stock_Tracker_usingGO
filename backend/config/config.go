package config

import (
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

// Config holds all application configuration
type Config struct {
	Port            string
	Env             string
	APIKey          string
	APIProvider     string
	UpdateInterval  int // seconds
	MaxConnections  int
	DefaultStocks   []string
	CORSOrigins     []string
	ReadBufferSize  int
	WriteBufferSize int
}

// Load loads configuration from environment variables
func Load() *Config {
	// Load .env file if it exists (optional)
	_ = godotenv.Load()

	stocks := []string{"AAPL", "GOOGL", "MSFT", "AMZN", "TSLA", "META", "NVDA"}
	if envStocks := os.Getenv("DEFAULT_STOCKS"); envStocks != "" {
		// Could parse from comma-separated values if needed
	}

	origins := []string{"http://localhost:3000", "http://localhost:8080"}
	if envOrigins := os.Getenv("CORS_ORIGINS"); envOrigins != "" {
		// Could parse from comma-separated values if needed
	}

	return &Config{
		Port:            getEnv("PORT", "8080"),
		Env:             getEnv("ENV", "development"),
		APIKey:          getEnv("STOCK_API_KEY", ""),
		APIProvider:     getEnv("API_PROVIDER", "finnhub"), // finnhub, alpha-vantage, or mock
		UpdateInterval:  getEnvInt("UPDATE_INTERVAL", 5),
		MaxConnections:  getEnvInt("MAX_CONNECTIONS", 1000),
		DefaultStocks:   stocks,
		CORSOrigins:     origins,
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
	}
}

// getEnv retrieves an environment variable with a default value
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// getEnvInt retrieves an environment variable as an integer
func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intVal, err := strconv.Atoi(value); err == nil {
			return intVal
		}
	}
	return defaultValue
}
