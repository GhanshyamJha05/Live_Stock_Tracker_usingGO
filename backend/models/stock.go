package models

import "time"

// Stock represents a single stock with its current data
type Stock struct {
	Symbol        string    `json:"symbol"`
	Name          string    `json:"name"`
	Price         float64   `json:"price"`
	PreviousClose float64   `json:"previous_close"`
	Change        float64   `json:"change"`
	ChangePercent float64   `json:"change_percent"`
	High          float64   `json:"high"`
	Low           float64   `json:"low"`
	Volume        int64     `json:"volume"`
	MarketCap     int64     `json:"market_cap"`
	PE            float64   `json:"pe"`
	Dividend      float64   `json:"dividend"`
	LastUpdated   time.Time `json:"last_updated"`
	Status        string    `json:"status"` // "active", "closed", "error"
	ErrorMessage  string    `json:"error_message,omitempty"`
}

// StockUpdate represents a real-time price update for WebSocket broadcast
type StockUpdate struct {
	Symbol        string    `json:"symbol"`
	Price         float64   `json:"price"`
	Change        float64   `json:"change"`
	ChangePercent float64   `json:"change_percent"`
	LastUpdated   time.Time `json:"last_updated"`
	Status        string    `json:"status"`
	ErrorMessage  string    `json:"error_message,omitempty"`
}

// StockChart represents historical data for charting
type StockChart struct {
	Symbol   string       `json:"symbol"`
	Interval string       `json:"interval"`  // "1m", "5m", "15m", "1h", "1d"
	DataType string       `json:"data_type"` // "intraday", "daily", "weekly"
	Prices   []PricePoint `json:"prices"`
}

// PricePoint represents a single price point on a chart
type PricePoint struct {
	Timestamp time.Time `json:"timestamp"`
	Open      float64   `json:"open"`
	High      float64   `json:"high"`
	Low       float64   `json:"low"`
	Close     float64   `json:"close"`
	Volume    int64     `json:"volume"`
}

// APIResponse represents the structure of API responses
type APIResponse struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Message string      `json:"message,omitempty"`
	Error   string      `json:"error,omitempty"`
}

// ErrorResponse represents an error response
type ErrorResponse struct {
	Error      string `json:"error"`
	StatusCode int    `json:"status_code"`
	Timestamp  string `json:"timestamp"`
}
