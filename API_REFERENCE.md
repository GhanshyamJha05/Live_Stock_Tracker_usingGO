# API Reference - Live Stock Tracker

Complete API documentation for the Live Stock Tracker application.

---

## 🌐 Base URL

```
http://localhost:8080/api
```

or when deployed:

```
https://your-domain.com/api
```

---

## 📡 REST API Endpoints

### 1. Get Single Stock

**Request**
```http
GET /api/stocks/:symbol
```

**Parameters**
- `symbol` (path) - Stock ticker symbol (e.g., AAPL, GOOGL)

**Example**
```bash
curl http://localhost:8080/api/stocks/AAPL
```

**Response (200 OK)**
```json
{
  "success": true,
  "data": {
    "symbol": "AAPL",
    "name": "Apple Inc.",
    "price": 182.45,
    "previous_close": 180.30,
    "change": 2.15,
    "change_percent": 1.19,
    "high": 184.20,
    "low": 180.50,
    "volume": 52345678,
    "market_cap": 2850000000000,
    "pe": 28.5,
    "dividend": 0.92,
    "last_updated": "2024-01-23T14:30:00Z",
    "status": "active",
    "error_message": ""
  }
}
```

**Response (Error)**
```json
{
  "success": false,
  "error": "failed to fetch stock data: API rate limit exceeded"
}
```

---

### 2. Get Multiple Stocks

**Request**
```http
GET /api/stocks?symbols=AAPL,GOOGL,MSFT
```

**Parameters**
- `symbols` (query) - Comma-separated stock symbols

**Example**
```bash
curl "http://localhost:8080/api/stocks?symbols=AAPL,GOOGL,MSFT"
```

**Response (200 OK)**
```json
{
  "success": true,
  "data": [
    {
      "symbol": "AAPL",
      "price": 182.45,
      "change": 2.15,
      ...
    },
    {
      "symbol": "GOOGL",
      "price": 140.23,
      "change": -1.50,
      ...
    },
    {
      "symbol": "MSFT",
      "price": 378.91,
      "change": 3.22,
      ...
    }
  ]
}
```

---

### 3. Search Stocks

**Request**
```http
GET /api/stocks/search?q=AAPL
```

**Parameters**
- `q` (query) - Search query (symbol or name)

**Example**
```bash
curl "http://localhost:8080/api/stocks/search?q=AAPL"
```

**Response (200 OK)**
```json
{
  "success": true,
  "data": [
    {
      "symbol": "AAPL",
      "name": "Apple Inc.",
      "price": 182.45,
      ...
    }
  ]
}
```

---

### 4. Get Default Stocks

**Request**
```http
GET /api/stocks/defaults
```

**Example**
```bash
curl http://localhost:8080/api/stocks/defaults
```

**Response (200 OK)**
```json
{
  "success": true,
  "data": [
    "AAPL",
    "GOOGL",
    "MSFT",
    "AMZN",
    "TSLA",
    "META",
    "NVDA"
  ]
}
```

---

### 5. Health Check

**Request**
```http
GET /api/health
```

**Example**
```bash
curl http://localhost:8080/api/health
```

**Response (200 OK)**
```json
{
  "status": "healthy",
  "clients": 5,
  "tracked": 3
}
```

**Response Fields**
- `status` (string) - Server status ("healthy")
- `clients` (integer) - Number of connected WebSocket clients
- `tracked` (integer) - Number of stocks being tracked

---

### 6. Invalidate Cache

**Request**
```http
POST /api/cache/invalidate
```

**Example**
```bash
curl -X POST http://localhost:8080/api/cache/invalidate
```

**Response (200 OK)**
```json
{
  "success": true,
  "message": "cache invalidated"
}
```

---

## 🔌 WebSocket API

### Connection

**URL**
```
ws://localhost:8080/ws
wss://your-domain.com/ws  (for HTTPS)
```

**JavaScript Example**
```javascript
const ws = new WebSocket('ws://localhost:8080/ws');

ws.onopen = () => {
    console.log('Connected');
};

ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    console.log('Message:', message);
};

ws.onerror = (error) => {
    console.error('Error:', error);
};

ws.onclose = () => {
    console.log('Disconnected');
};
```

---

### Subscribe to Stock

**Send Message**
```json
{
  "type": "subscribe",
  "symbol": "AAPL"
}
```

**Example**
```javascript
ws.send(JSON.stringify({
    type: 'subscribe',
    symbol: 'AAPL'
}));
```

**Server broadcasts updates for AAPL**

---

### Unsubscribe from Stock

**Send Message**
```json
{
  "type": "unsubscribe",
  "symbol": "AAPL"
}
```

**Example**
```javascript
ws.send(JSON.stringify({
    type: 'unsubscribe',
    symbol: 'AAPL'
}));
```

---

### Get Tracked Stocks

**Send Message**
```json
{
  "type": "list"
}
```

**Server Response**
```json
{
  "type": "list",
  "symbols": ["AAPL", "GOOGL", "MSFT"]
}
```

---

### Price Update (Server → Client)

**Message Format**
```json
{
  "type": "update",
  "data": {
    "symbol": "AAPL",
    "price": 182.45,
    "change": 2.15,
    "change_percent": 1.19,
    "last_updated": "2024-01-23T14:30:00Z",
    "status": "active",
    "error_message": ""
  }
}
```

**Example Handler**
```javascript
ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    
    if (message.type === 'update') {
        const update = message.data;
        console.log(`${update.symbol}: $${update.price} (${update.change_percent}%)`);
        
        // Update UI here
        updateStockDisplay(update);
    }
};
```

---

## 📊 Data Models

### Stock Object

```typescript
{
  "symbol": string,           // Ticker symbol (e.g., "AAPL")
  "name": string,             // Company name
  "price": number,            // Current price in USD
  "previous_close": number,   // Previous close price
  "change": number,           // Change in dollars
  "change_percent": number,   // Change as percentage
  "high": number,             // Day's high
  "low": number,              // Day's low
  "volume": number,           // Trading volume
  "market_cap": number,       // Market capitalization
  "pe": number,               // Price-to-earnings ratio
  "dividend": number,         // Dividend yield
  "last_updated": string,     // ISO 8601 timestamp
  "status": string,           // "active", "closed", or "error"
  "error_message": string     // Error details if status is "error"
}
```

### Stock Update Object

```typescript
{
  "symbol": string,           // Ticker symbol
  "price": number,            // Current price
  "change": number,           // Change in dollars
  "change_percent": number,   // Change as percentage
  "last_updated": string,     // ISO 8601 timestamp
  "status": string,           // "active" or "error"
  "error_message": string     // Error details if present
}
```

### API Response Object

```typescript
{
  "success": boolean,         // Request success status
  "data": any,                // Response data
  "message": string,          // Optional message
  "error": string             // Error message if failed
}
```

---

## 🔐 Status Codes

| Code | Meaning | Example |
|------|---------|---------|
| 200 | OK | Stock data retrieved successfully |
| 204 | No Content | Preflight request response |
| 400 | Bad Request | Missing required parameters |
| 404 | Not Found | Stock symbol not found |
| 500 | Internal Server Error | Server error |
| 503 | Service Unavailable | API provider unavailable |

---

## ⏱️ Rate Limiting

Current implementation: **No rate limiting**

For production, consider adding:
- IP-based rate limiting
- User account-based limiting
- Tiered access levels

---

## 🔄 Update Intervals

| Provider | Update Frequency |
|----------|-------------------|
| Mock | 5 seconds |
| Finnhub | Real-time (5 seconds) |
| Alpha Vantage | Every 5 minutes |
| Default | 5 seconds |

---

## 🌍 CORS Headers

The API includes the following CORS headers:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: POST, OPTIONS, GET, PUT, DELETE
Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With
```

---

## 🛠️ Error Handling

### Common Errors

**Missing Symbol Parameter**
```json
{
  "success": false,
  "error": "stock symbol is required"
}
```

**Invalid Symbol**
```json
{
  "success": false,
  "error": "failed to fetch stock data: not found"
}
```

**API Rate Limit**
```json
{
  "success": false,
  "error": "API rate limit exceeded, falling back to cached data"
}
```

**Network Error**
```json
{
  "success": false,
  "error": "network error: connection refused"
}
```

---

## 📝 Example Workflows

### Workflow 1: Fetch and Display Stock

```javascript
// 1. Fetch stock data via REST
fetch('http://localhost:8080/api/stocks/AAPL')
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            console.log(`${data.data.symbol}: $${data.data.price}`);
            displayStock(data.data);
        }
    });

// 2. Subscribe for real-time updates
ws.send(JSON.stringify({
    type: 'subscribe',
    symbol: 'AAPL'
}));

// 3. Handle updates
ws.onmessage = (event) => {
    const { type, data } = JSON.parse(event.data);
    if (type === 'update' && data.symbol === 'AAPL') {
        updateStockDisplay(data);
    }
};
```

### Workflow 2: Build Watchlist

```javascript
// 1. Get default stocks
fetch('http://localhost:8080/api/stocks/defaults')
    .then(res => res.json())
    .then(data => {
        // 2. Fetch all stocks
        const symbols = data.data.join(',');
        return fetch(`http://localhost:8080/api/stocks?symbols=${symbols}`);
    })
    .then(res => res.json())
    .then(data => {
        // 3. Display watchlist
        data.data.forEach(stock => {
            addToWatchlist(stock);
        });
        
        // 4. Subscribe to all for updates
        data.data.forEach(stock => {
            ws.send(JSON.stringify({
                type: 'subscribe',
                symbol: stock.symbol
            }));
        });
    });
```

### Workflow 3: Monitor Health

```javascript
// Health check every 30 seconds
setInterval(async () => {
    try {
        const response = await fetch('http://localhost:8080/api/health');
        const health = await response.json();
        
        console.log(`Clients: ${health.clients}, Tracked: ${health.tracked}`);
        
        if (health.status === 'healthy') {
            updateHealthIndicator('green');
        } else {
            updateHealthIndicator('red');
        }
    } catch (error) {
        console.error('Health check failed:', error);
        updateHealthIndicator('red');
    }
}, 30000);
```

---

## 🔍 Testing with cURL

### Test Connection
```bash
# GET request
curl http://localhost:8080/api/health

# With headers
curl -H "Content-Type: application/json" http://localhost:8080/api/stocks/AAPL

# POST request
curl -X POST http://localhost:8080/api/cache/invalidate

# Multiple stocks
curl "http://localhost:8080/api/stocks?symbols=AAPL,GOOGL,MSFT"
```

### Test WebSocket
```bash
# Using websocat (install: cargo install websocat)
websocat ws://localhost:8080/ws

# Then send:
{"type":"subscribe","symbol":"AAPL"}
```

---

## 📚 Frontend Integration

The provided frontend already includes all necessary API integration:

```javascript
// WebSocket Manager - websocket.js
const wsManager = new WebSocketManager();
wsManager.connect();
wsManager.subscribe('AAPL');

// Stock App - app.js
const app = new StockTrackerApp();
app.fetchStockData('AAPL');
app.displayWatchlist();
```

---

## 🚀 Performance Tips

1. **Batch Requests**: Fetch multiple stocks at once
   ```
   GET /api/stocks?symbols=AAPL,GOOGL,MSFT
   ```

2. **Use WebSocket**: For continuous updates instead of polling
   ```
   ws://localhost:8080/ws
   ```

3. **Cache Results**: Frontend caches data in localStorage
   ```javascript
   localStorage.setItem('watchlist', JSON.stringify(symbols));
   ```

4. **Health Checks**: Use `/api/health` for monitoring
   ```
   GET /api/health
   ```

---

## 🔐 Security Notes

- CORS is currently permissive (`*`)
- No authentication/authorization
- No rate limiting (implement for production)
- Environment variables store API keys

---

**For detailed information, see [README.md](README.md)**
