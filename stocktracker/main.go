package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/gorilla/websocket"
)

const (
	// Finnhub API key (replace if needed)
	apiKey = "d2eb0h1r01qr1ro92pd0d2eb0h1r01qr1ro92pdg"

	// Rate: be mindful of Finnhub free-tier limits
	livePollInterval = 5 * time.Second
	serverAddr       = ":8080"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true }, // same-origin in practice
}

// Finnhub REST responses
type quoteResp struct {
	Current   float64 `json:"c"`
	High      float64 `json:"h"`
	Low       float64 `json:"l"`
	Open      float64 `json:"o"`
	PrevClose float64 `json:"pc"`
}

type candleResp struct {
	Close  []float64 `json:"c"`
	High   []float64 `json:"h"`
	Low    []float64 `json:"l"`
	Open   []float64 `json:"o"`
	Time   []int64   `json:"t"` // UNIX seconds
	Volume []float64 `json:"v"`
	S      string    `json:"s"` // "ok" or "no_data"
}

// ---------------- HTTP Helpers ----------------

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func badRequest(w http.ResponseWriter, msg string) {
	writeJSON(w, http.StatusBadRequest, map[string]string{"error": msg})
}

func serverError(w http.ResponseWriter, err error) {
	log.Println("server error:", err)
	writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal_error"})
}

// ---------------- Finnhub Calls ----------------

var httpClient = &http.Client{Timeout: 10 * time.Second}

func fetchQuote(symbol string) (*quoteResp, error) {
	url := fmt.Sprintf("https://finnhub.io/api/v1/quote?symbol=%s&token=%s", symbol, apiKey)
	resp, err := httpClient.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("quote status %s", resp.Status)
	}

	var q quoteResp
	if err := json.NewDecoder(resp.Body).Decode(&q); err != nil {
		return nil, err
	}
	return &q, nil
}

func fetchCandles(symbol string, minutes int) (*candleResp, error) {
	if minutes <= 0 {
		minutes = 60
	}
	to := time.Now().Unix()
	from := time.Now().Add(-time.Duration(minutes) * time.Minute).Unix()
	url := fmt.Sprintf("https://finnhub.io/api/v1/stock/candle?symbol=%s&resolution=1&from=%d&to=%d&token=%s",
		symbol, from, to, apiKey)

	resp, err := httpClient.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("candle status %s", resp.Status)
	}

	var c candleResp
	if err := json.NewDecoder(resp.Body).Decode(&c); err != nil {
		return nil, err
	}
	return &c, nil
}

// ---------------- HTTP Handlers ----------------

// Serves the static frontend
func handleStatic(w http.ResponseWriter, r *http.Request) {
	// default route -> index.html
	if r.URL.Path == "/" {
		http.ServeFile(w, r, "static/index.html")
		return
	}
	http.FileServer(http.Dir("./static")).ServeHTTP(w, r)
}

// GET /api/candles?symbol=TSLA&minutes=60
func handleCandles(w http.ResponseWriter, r *http.Request) {
	symbol := r.URL.Query().Get("symbol")
	if symbol == "" {
		badRequest(w, "symbol is required")
		return
	}

	minStr := r.URL.Query().Get("minutes")
	minutes := 60
	if minStr != "" {
		if v, err := strconv.Atoi(minStr); err == nil && v > 0 && v <= 5000 {
			minutes = v
		}
	}

	c, err := fetchCandles(symbol, minutes)
	if err != nil {
		serverError(w, err)
		return
	}
	if c.S != "ok" || len(c.Time) == 0 {
		writeJSON(w, http.StatusOK, map[string]any{
			"symbol":  symbol,
			"status":  c.S,
			"candles": []any{},
		})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"symbol": symbol,
		"status": c.S,
		"t":      c.Time,
		"o":      c.Open,
		"h":      c.High,
		"l":      c.Low,
		"c":      c.Close,
		"v":      c.Volume,
	})
}

// WS /ws?symbol=TSLA
// Streams the latest quote periodically (JSON with time + price)
func handleWS(w http.ResponseWriter, r *http.Request) {
	symbol := r.URL.Query().Get("symbol")
	if symbol == "" {
		symbol = "AAPL"
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("ws upgrade:", err)
		return
	}
	defer conn.Close()

	ticker := time.NewTicker(livePollInterval)
	defer ticker.Stop()

	// First tick immediately
	sendQuote := func() error {
		q, err := fetchQuote(symbol)
		if err != nil {
			return err
		}
		payload := map[string]any{
			"symbol": symbol,
			"price":  q.Current,
			"time":   time.Now().UnixMilli(),
		}
		conn.SetWriteDeadline(time.Now().Add(5 * time.Second))
		return conn.WriteJSON(payload)
	}

	if err := sendQuote(); err != nil {
		log.Println("ws first send:", err)
		return
	}

	for range ticker.C {
		if err := sendQuote(); err != nil {
			log.Println("ws send:", err)
			return
		}
	}
}

func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("/", handleStatic)
	mux.HandleFunc("/api/candles", handleCandles)
	mux.HandleFunc("/ws", handleWS)

	log.Printf("Server running at http://localhost%s\n", serverAddr)
	log.Fatal(http.ListenAndServe(serverAddr, mux))
}
