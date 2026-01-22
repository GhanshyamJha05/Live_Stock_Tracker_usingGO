package services

import (
	"sync"
	"time"

	"stock-tracker/models"
	"stock-tracker/utils"
)

// StockService handles business logic for stock operations
type StockService struct {
	apiClient    *utils.APIClient
	stockCache   map[string]*models.Stock
	cacheMutex   sync.RWMutex
	cacheTTL     time.Duration
	updateTicker *time.Ticker
	done         chan bool
	onUpdate     func(*models.StockUpdate)
}

// NewStockService creates a new stock service instance
func NewStockService(apiClient *utils.APIClient, cacheTTL time.Duration) *StockService {
	return &StockService{
		apiClient:  apiClient,
		stockCache: make(map[string]*models.Stock),
		cacheMutex: sync.RWMutex{},
		cacheTTL:   cacheTTL,
		done:       make(chan bool),
		onUpdate:   func(*models.StockUpdate) {}, // default no-op
	}
}

// GetStock retrieves stock data, either from cache or by fetching
func (ss *StockService) GetStock(symbol string) (*models.Stock, error) {
	// Check cache first
	ss.cacheMutex.RLock()
	if stock, exists := ss.stockCache[symbol]; exists {
		if time.Since(stock.LastUpdated) < ss.cacheTTL {
			ss.cacheMutex.RUnlock()
			return stock, nil
		}
	}
	ss.cacheMutex.RUnlock()

	// Fetch fresh data
	stock, err := ss.apiClient.FetchStockData(symbol)
	if err != nil {
		return nil, err
	}

	// Update cache
	ss.cacheMutex.Lock()
	ss.stockCache[symbol] = stock
	ss.cacheMutex.Unlock()

	return stock, nil
}

// GetMultipleStocks retrieves data for multiple stocks
func (ss *StockService) GetMultipleStocks(symbols []string) []*models.Stock {
	stocks := make([]*models.Stock, 0, len(symbols))

	for _, symbol := range symbols {
		if stock, err := ss.GetStock(symbol); err == nil {
			stocks = append(stocks, stock)
		}
	}

	return stocks
}

// SetUpdateCallback sets the callback function for stock updates
func (ss *StockService) SetUpdateCallback(fn func(*models.StockUpdate)) {
	ss.onUpdate = fn
}

// StartBackgroundUpdates starts a goroutine that periodically updates stock prices
func (ss *StockService) StartBackgroundUpdates(symbols []string, interval time.Duration) {
	ss.updateTicker = time.NewTicker(interval)

	go func() {
		for {
			select {
			case <-ss.updateTicker.C:
				ss.updatePrices(symbols)
			case <-ss.done:
				ss.updateTicker.Stop()
				return
			}
		}
	}()
}

// updatePrices fetches and broadcasts updates for all tracked symbols
func (ss *StockService) updatePrices(symbols []string) {
	for _, symbol := range symbols {
		go func(sym string) {
			stock, err := ss.GetStock(sym)
			if err != nil {
				ss.onUpdate(&models.StockUpdate{
					Symbol:       sym,
					Status:       "error",
					ErrorMessage: err.Error(),
					LastUpdated:  time.Now(),
				})
				return
			}

			// Broadcast update via callback
			ss.onUpdate(&models.StockUpdate{
				Symbol:        stock.Symbol,
				Price:         stock.Price,
				Change:        stock.Change,
				ChangePercent: stock.ChangePercent,
				Status:        stock.Status,
				LastUpdated:   stock.LastUpdated,
			})
		}(symbol)
	}
}

// StopBackgroundUpdates stops the background update goroutine
func (ss *StockService) StopBackgroundUpdates() {
	select {
	case ss.done <- true:
	default:
	}
}

// InvalidateCache clears the stock cache
func (ss *StockService) InvalidateCache() {
	ss.cacheMutex.Lock()
	defer ss.cacheMutex.Unlock()
	ss.stockCache = make(map[string]*models.Stock)
}

// InvalidateCacheForSymbol clears cache for a specific symbol
func (ss *StockService) InvalidateCacheForSymbol(symbol string) {
	ss.cacheMutex.Lock()
	defer ss.cacheMutex.Unlock()
	delete(ss.stockCache, symbol)
}

// SearchStocks performs a simple search (in production, use a dedicated search API)
func (ss *StockService) SearchStocks(query string) []*models.Stock {
	// This is a simplified search. In production, you'd use a dedicated API
	// For now, just try to get the exact symbol
	if stock, err := ss.GetStock(query); err == nil {
		return []*models.Stock{stock}
	}
	return []*models.Stock{}
}
