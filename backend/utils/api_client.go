package utils

import (
	"encoding/json"
	"fmt"
	"io"
	"math"
	"math/rand"
	"net/http"
	"strconv"
	"strings"
	"time"

	"stock-tracker/models"
)

// APIClient handles external API calls for stock data
type APIClient struct {
	ApiKey     string
	Provider   string
	HTTPClient *http.Client
}

// NewAPIClient creates a new API client instance
func NewAPIClient(apiKey, provider string) *APIClient {
	return &APIClient{
		ApiKey:   apiKey,
		Provider: provider,
		HTTPClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// FetchStockData fetches current stock data from the configured API provider
func (ac *APIClient) FetchStockData(symbol string) (*models.Stock, error) {
	symbol = strings.ToUpper(symbol)

	switch ac.Provider {
	case "finnhub":
		return ac.fetchFromFinnhub(symbol)
	case "alpha-vantage":
		return ac.fetchFromAlphaVantage(symbol)
	case "mock":
		return ac.fetchMockData(symbol)
	default:
		return ac.fetchMockData(symbol)
	}
}

// FetchMultipleStocks fetches data for multiple stocks
func (ac *APIClient) FetchMultipleStocks(symbols []string) []*models.Stock {
	stocks := make([]*models.Stock, 0, len(symbols))

	for _, symbol := range symbols {
		if stock, err := ac.FetchStockData(symbol); err == nil {
			stocks = append(stocks, stock)
		}
	}

	return stocks
}

// fetchFromFinnhub fetches stock data from Finnhub API
func (ac *APIClient) fetchFromFinnhub(symbol string) (*models.Stock, error) {
	if ac.ApiKey == "" {
		// Fallback to mock data if API key is not configured
		return ac.fetchMockData(symbol)
	}

	url := fmt.Sprintf("https://finnhub.io/api/v1/quote?symbol=%s&token=%s", symbol, ac.ApiKey)

	resp, err := ac.HTTPClient.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API error: status code %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var data map[string]interface{}
	if err := json.Unmarshal(body, &data); err != nil {
		return nil, err
	}

	// Handle API response
	if _, ok := data["error"]; ok {
		return ac.fetchMockData(symbol) // Fallback to mock
	}

	stock := &models.Stock{
		Symbol:        symbol,
		Name:          symbol,
		Price:         getFloat(data, "c", 0),
		High:          getFloat(data, "h", 0),
		Low:           getFloat(data, "l", 0),
		PreviousClose: getFloat(data, "pc", 0),
		LastUpdated:   time.Now(),
		Status:        "active",
	}

	// Calculate change
	if stock.PreviousClose > 0 {
		stock.Change = stock.Price - stock.PreviousClose
		stock.ChangePercent = (stock.Change / stock.PreviousClose) * 100
	}

	return stock, nil
}

// fetchFromAlphaVantage fetches stock data from Alpha Vantage API
func (ac *APIClient) fetchFromAlphaVantage(symbol string) (*models.Stock, error) {
	if ac.ApiKey == "" {
		return ac.fetchMockData(symbol)
	}

	url := fmt.Sprintf("https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=%s&apikey=%s", symbol, ac.ApiKey)

	resp, err := ac.HTTPClient.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var data map[string]interface{}
	if err := json.Unmarshal(body, &data); err != nil {
		return nil, err
	}

	globalQuote, ok := data["Global Quote"].(map[string]interface{})
	if !ok || len(globalQuote) == 0 {
		return ac.fetchMockData(symbol) // Fallback
	}

	stock := &models.Stock{
		Symbol:        symbol,
		Name:          symbol,
		Price:         parseFloat(globalQuote, "05. price"),
		PreviousClose: parseFloat(globalQuote, "08. previous close"),
		Change:        parseFloat(globalQuote, "09. change"),
		ChangePercent: parseFloat(globalQuote, "10. change percent"),
		LastUpdated:   time.Now(),
		Status:        "active",
	}

	return stock, nil
}

// fetchMockData generates realistic mock stock data for testing/development
func (ac *APIClient) fetchMockData(symbol string) (*models.Stock, error) {
	// Seed with symbol hash for consistent data per symbol
	hashVal := 0
	for _, c := range symbol {
		hashVal = hashVal*31 + int(c)
	}
	rand.Seed(int64(hashVal))

	basePrice := 50.0 + rand.Float64()*200.0
	previousClose := basePrice * (0.95 + rand.Float64()*0.1)
	change := basePrice - previousClose
	changePercent := (change / previousClose) * 100

	stock := &models.Stock{
		Symbol:        strings.ToUpper(symbol),
		Name:          fmt.Sprintf("%s Inc.", symbol),
		Price:         math.Round(basePrice*100) / 100,
		PreviousClose: math.Round(previousClose*100) / 100,
		Change:        math.Round(change*100) / 100,
		ChangePercent: math.Round(changePercent*100) / 100,
		High:          math.Round((basePrice*1.02)*100) / 100,
		Low:           math.Round((basePrice*0.98)*100) / 100,
		Volume:        int64(rand.Intn(50000000) + 1000000),
		MarketCap:     int64(rand.Intn(100000000000) + 1000000000),
		PE:            math.Round((25.0+rand.Float64()*25.0)*100) / 100,
		Dividend:      math.Round(rand.Float64()*3.0*100) / 100,
		LastUpdated:   time.Now(),
		Status:        "active",
	}

	return stock, nil
}

// Helper functions to extract values from maps

func getFloat(data map[string]interface{}, key string, defaultVal float64) float64 {
	if val, ok := data[key]; ok {
		switch v := val.(type) {
		case float64:
			return v
		case string:
			if f, err := strconv.ParseFloat(v, 64); err == nil {
				return f
			}
		}
	}
	return defaultVal
}

func parseFloat(data map[string]interface{}, key string) float64 {
	if val, ok := data[key].(string); ok {
		// Remove percentage symbol if present
		val = strings.TrimSuffix(val, "%")
		if f, err := strconv.ParseFloat(val, 64); err == nil {
			return f
		}
	}
	return 0
}
