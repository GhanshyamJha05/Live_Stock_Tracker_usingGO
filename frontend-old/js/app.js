/**
 * Stock Tracker Application
 * Main application logic for the stock tracking dashboard
 */

class StockTrackerApp {
    constructor() {
        this.stocks = new Map(); // Symbol -> Stock data
        this.watchlist = new Set(); // Tracked stock symbols
        this.wsManager = null;
        this.chartInstance = null;
        this.selectedSymbol = null;
        this.currentChartPeriod = '1m';
        this.apiBaseUrl = '/api';
        this.isDarkMode = true;
        this.init();
    }

    /**
     * Initialize the application
     */
    init() {
        this.setupWebSocket();
        this.attachEventListeners();
        this.loadWatchlist();
        this.loadDefaultStocks();
    }

    /**
     * Setup WebSocket connection
     */
    setupWebSocket() {
        this.wsManager = new WebSocketManager();

        // Handle price updates
        this.wsManager.on('update', (update) => {
            this.handleStockUpdate(update);
        });

        // Handle list responses
        this.wsManager.on('list', (data) => {
            console.log('[App] Tracked stocks:', data);
        });

        // Handle connection events
        document.addEventListener('ws_connected', () => {
            console.log('[App] WebSocket connected');
            this.showToast('Connected to server', 'success');
            this.resubscribeToStocks();
        });

        document.addEventListener('ws_reconnect_failed', () => {
            this.showToast('Failed to reconnect to server', 'error');
        });

        document.addEventListener('ws_error', () => {
            this.showToast('WebSocket error occurred', 'error');
        });

        // Connect
        this.wsManager.connect();
    }

    /**
     * Attach event listeners to DOM elements
     */
    attachEventListeners() {
        // Search button
        document.getElementById('searchBtn').addEventListener('click', () => {
            this.searchStock();
        });

        // Search input (Enter key)
        document.getElementById('searchInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.searchStock();
            }
        });

        // Refresh button
        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.refreshAllPrices();
        });

        // Modal event listeners
        const modal = document.getElementById('addStockModal');
        document.getElementById('closeModal').addEventListener('click', () => {
            this.closeModal();
        });
        document.getElementById('cancelBtn').addEventListener('click', () => {
            this.closeModal();
        });
        document.getElementById('addBtn').addEventListener('click', () => {
            this.addSelectedStock();
        });

        // Modal search input
        document.getElementById('modalSearchInput').addEventListener('input', (e) => {
            this.searchStocksInModal(e.target.value);
        });

        // Chart period buttons
        document.querySelectorAll('.chart-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.changeChartPeriod(e.target.dataset.period);
            });
        });
    }

    /**
     * Load watchlist from local storage
     */
    loadWatchlist() {
        const saved = localStorage.getItem('watchlist');
        if (saved) {
            try {
                const symbols = JSON.parse(saved);
                symbols.forEach(symbol => this.watchlist.add(symbol));
            } catch (error) {
                console.error('Failed to load watchlist:', error);
            }
        }
    }

    /**
     * Save watchlist to local storage
     */
    saveWatchlist() {
        localStorage.setItem('watchlist', JSON.stringify(Array.from(this.watchlist)));
    }

    /**
     * Load default stocks on first load
     */
    loadDefaultStocks() {
        if (this.watchlist.size === 0) {
            // Load default stocks from API
            fetch(`${this.apiBaseUrl}/stocks/defaults`)
                .then(res => res.json())
                .then(data => {
                    if (data.success && data.data) {
                        data.data.slice(0, 4).forEach(symbol => {
                            this.addToWatchlist(symbol);
                        });
                    }
                })
                .catch(error => console.error('Failed to load defaults:', error));
        } else {
            this.displayWatchlist();
        }
    }

    /**
     * Add stock to watchlist
     */
    addToWatchlist(symbol) {
        symbol = symbol.toUpperCase().trim();
        
        if (this.watchlist.has(symbol)) {
            this.showToast(`${symbol} is already in your watchlist`, 'warning');
            return;
        }

        if (this.watchlist.size >= 50) {
            this.showToast('Maximum 50 stocks allowed in watchlist', 'warning');
            return;
        }

        this.watchlist.add(symbol);
        this.saveWatchlist();

        // Subscribe via WebSocket
        if (this.wsManager.isConnected) {
            this.wsManager.subscribe(symbol);
        }

        // Fetch current data
        this.fetchStockData(symbol);

        this.displayWatchlist();
        this.showToast(`Added ${symbol} to watchlist`, 'success');
    }

    /**
     * Remove stock from watchlist
     */
    removeFromWatchlist(symbol) {
        this.watchlist.delete(symbol);
        this.stocks.delete(symbol);
        this.saveWatchlist();

        // Unsubscribe via WebSocket
        if (this.wsManager.isConnected) {
            this.wsManager.unsubscribe(symbol);
        }

        this.displayWatchlist();
        this.showToast(`Removed ${symbol} from watchlist`, 'success');
    }

    /**
     * Fetch stock data from API
     */
    fetchStockData(symbol) {
        fetch(`${this.apiBaseUrl}/stocks/${symbol}`)
            .then(res => res.json())
            .then(data => {
                if (data.success && data.data) {
                    this.stocks.set(symbol, data.data);
                    this.displayWatchlist();
                } else {
                    this.showToast(`Failed to fetch ${symbol}`, 'error');
                }
            })
            .catch(error => {
                console.error(`Failed to fetch ${symbol}:`, error);
                this.showToast(`Error fetching ${symbol}`, 'error');
            });
    }

    /**
     * Handle real-time stock updates from WebSocket
     */
    handleStockUpdate(update) {
        if (!update || !update.symbol) return;

        const symbol = update.symbol.toUpperCase();

        // Get existing stock or create new one
        const stock = this.stocks.get(symbol) || {};

        // Update with new values
        Object.assign(stock, update);
        this.stocks.set(symbol, stock);

        // Update UI
        this.displayWatchlist();

        // Update chart if viewing this stock
        if (this.selectedSymbol === symbol && this.chartInstance) {
            // Chart will be updated on next period change or manual refresh
        }
    }

    /**
     * Display watchlist on the page
     */
    displayWatchlist() {
        const container = document.getElementById('watchlistContainer');
        const noStocksMsg = document.getElementById('noStocksMsg');

        if (this.watchlist.size === 0) {
            container.innerHTML = '';
            noStocksMsg.style.display = 'flex';
            document.getElementById('trackedCount').textContent = '0';
            return;
        }

        noStocksMsg.style.display = 'none';
        container.innerHTML = '';
        document.getElementById('trackedCount').textContent = this.watchlist.size;

        // Create card for each stock
        this.watchlist.forEach(symbol => {
            const stock = this.stocks.get(symbol);
            const card = this.createStockCard(symbol, stock);
            container.appendChild(card);
        });

        this.updateMarketSummary();
    }

    /**
     * Create a stock card element
     */
    createStockCard(symbol, stock) {
        const card = document.createElement('div');
        card.className = 'stock-card';
        if (stock && stock.status === 'error') {
            card.classList.add('error');
        }

        if (!stock) {
            card.innerHTML = `
                <div class="card-header">
                    <div>
                        <div class="stock-symbol">${symbol}</div>
                        <div class="stock-name">Loading...</div>
                    </div>
                    <div class="card-actions">
                        <button class="remove-btn" title="Remove from watchlist">✕</button>
                    </div>
                </div>
                <div class="card-price">
                    <div class="price loading-skeleton" style="min-width: 100px; height: 32px;"></div>
                </div>
                <div class="card-stats">
                    <div class="stat">
                        <span class="stat-label">High</span>
                        <span class="stat-value loading-skeleton" style="height: 20px;"></span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">Low</span>
                        <span class="stat-value loading-skeleton" style="height: 20px;"></span>
                    </div>
                </div>
            `;
        } else {
            const change = stock.change || 0;
            const changePercent = stock.change_percent || 0;
            const isUp = change >= 0;
            const changeClass = isUp ? 'up' : 'down';
            const changeIcon = isUp ? '▲' : '▼';

            const formattedPrice = this.formatCurrency(stock.price);
            const formattedChange = this.formatCurrency(stock.change);
            const formattedPercent = changePercent.toFixed(2);

            card.innerHTML = `
                <div class="card-header">
                    <div>
                        <div class="stock-symbol">${symbol}</div>
                        <div class="stock-name">${stock.name || symbol}</div>
                    </div>
                    <div class="card-actions">
                        <button class="remove-btn" title="Remove from watchlist">✕</button>
                    </div>
                </div>

                <div class="card-price">
                    <span class="price">${formattedPrice}</span>
                    <span class="change ${changeClass}">
                        ${changeIcon} ${formattedChange} (${formattedPercent}%)
                    </span>
                </div>

                <div class="card-stats">
                    <div class="stat">
                        <span class="stat-label">High</span>
                        <span class="stat-value">${this.formatCurrency(stock.high)}</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">Low</span>
                        <span class="stat-value">${this.formatCurrency(stock.low)}</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">Volume</span>
                        <span class="stat-value">${this.formatVolume(stock.volume)}</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">P/E</span>
                        <span class="stat-value">${stock.pe ? stock.pe.toFixed(2) : 'N/A'}</span>
                    </div>
                </div>

                <div class="card-footer">
                    <span>${this.formatTime(stock.last_updated)}</span>
                    <button style="cursor: pointer;">📊 Chart</button>
                </div>
            `;
        }

        // Add event listeners
        const removeBtn = card.querySelector('.remove-btn');
        removeBtn.addEventListener('click', () => {
            this.removeFromWatchlist(symbol);
        });

        const chartBtn = card.querySelector('button[style*="cursor"]');
        if (chartBtn) {
            chartBtn.addEventListener('click', () => {
                this.showChart(symbol);
            });
        }

        return card;
    }

    /**
     * Show chart for a stock
     */
    showChart(symbol) {
        this.selectedSymbol = symbol;
        const chartSection = document.getElementById('chartSection');
        chartSection.style.display = 'block';
        document.getElementById('chartTitle').textContent = `${symbol} Price Chart`;

        // Generate mock data (in production, fetch from API)
        this.loadChartData(symbol, this.currentChartPeriod);

        // Scroll to chart
        chartSection.scrollIntoView({ behavior: 'smooth' });
    }

    /**
     * Load chart data
     */
    loadChartData(symbol, period) {
        // Generate mock historical data
        const dataPoints = this.generateMockChartData(symbol, period);

        const ctx = document.getElementById('priceChart').getContext('2d');

        if (this.chartInstance) {
            this.chartInstance.destroy();
        }

        this.chartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: dataPoints.labels,
                datasets: [
                    {
                        label: `${symbol} Price (${period})`,
                        data: dataPoints.prices,
                        borderColor: '#2563eb',
                        backgroundColor: 'rgba(37, 99, 235, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4,
                        pointRadius: 0,
                        pointHoverRadius: 6,
                        pointBackgroundColor: '#2563eb',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2,
                    },
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        labels: {
                            color: '#f1f5f9',
                            font: { size: 12 },
                        },
                    },
                    filler: {
                        propagate: true,
                    }
                },
                scales: {
                    x: {
                        display: true,
                        grid: {
                            color: 'rgba(71, 85, 105, 0.2)',
                        },
                        ticks: {
                            color: '#cbd5e1',
                            font: { size: 11 },
                        },
                    },
                    y: {
                        display: true,
                        grid: {
                            color: 'rgba(71, 85, 105, 0.2)',
                        },
                        ticks: {
                            color: '#cbd5e1',
                            font: { size: 11 },
                            callback: function(value) {
                                return '$' + value.toFixed(2);
                            }
                        },
                    },
                },
            },
        });
    }

    /**
     * Generate mock chart data
     */
    generateMockChartData(symbol, period) {
        const stock = this.stocks.get(symbol);
        const basePrice = stock ? stock.price : 100;
        const volatility = 0.02; // 2% volatility
        
        let points = 30;
        let labelFormat = 'HH:mm';
        
        switch(period) {
            case '1d': points = 24; labelFormat = 'HH:mm'; break;
            case '1w': points = 7; labelFormat = 'ddd'; break;
            case '1m': points = 30; labelFormat = 'MMM DD'; break;
            case '3m': points = 90; labelFormat = 'MMM DD'; break;
            case '1y': points = 52; labelFormat = 'MMM'; break;
        }

        const labels = [];
        const prices = [];
        let currentPrice = basePrice;

        for (let i = 0; i < points; i++) {
            const change = (Math.random() - 0.5) * volatility * currentPrice;
            currentPrice += change;
            prices.push(Math.max(currentPrice, basePrice * 0.7)); // Prevent going too low

            // Generate label
            const date = new Date();
            date.setDate(date.getDate() - (points - i));
            labels.push(this.formatChartLabel(date, labelFormat));
        }

        return { labels, prices };
    }

    /**
     * Change chart period
     */
    changeChartPeriod(period) {
        this.currentChartPeriod = period;

        // Update button states
        document.querySelectorAll('.chart-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.period === period) {
                btn.classList.add('active');
            }
        });

        if (this.selectedSymbol) {
            this.loadChartData(this.selectedSymbol, period);
        }
    }

    /**
     * Search for a stock
     */
    searchStock() {
        const query = document.getElementById('searchInput').value.trim();
        if (!query) {
            this.showToast('Please enter a stock symbol', 'warning');
            return;
        }

        // Open modal
        document.getElementById('addStockModal').classList.add('active');
        document.getElementById('modalSearchInput').value = query;
        this.searchStocksInModal(query);
    }

    /**
     * Search stocks in modal
     */
    searchStocksInModal(query) {
        const resultsContainer = document.getElementById('searchResults');
        
        if (!query) {
            resultsContainer.innerHTML = '';
            return;
        }

        // Simulate search results (in production, call real API)
        const mockResults = [
            { symbol: query.toUpperCase(), name: `${query} Inc.` },
        ];

        resultsContainer.innerHTML = mockResults.map(result => `
            <div class="search-result-item" data-symbol="${result.symbol}">
                <strong>${result.symbol}</strong> - ${result.name}
            </div>
        `).join('');

        // Add click handlers
        resultsContainer.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', () => {
                const symbol = item.dataset.symbol;
                document.getElementById('modalSearchInput').value = symbol;
                document.getElementById('addBtn').dataset.selectedSymbol = symbol;
                document.getElementById('addBtn').disabled = false;
            });
        });
    }

    /**
     * Add selected stock from modal
     */
    addSelectedStock() {
        const symbol = document.getElementById('addBtn').dataset.selectedSymbol ||
                      document.getElementById('modalSearchInput').value;
        
        if (!symbol) {
            this.showToast('Please select a stock', 'warning');
            return;
        }

        this.addToWatchlist(symbol);
        this.closeModal();
    }

    /**
     * Close modal
     */
    closeModal() {
        document.getElementById('addStockModal').classList.remove('active');
        document.getElementById('modalSearchInput').value = '';
        document.getElementById('searchResults').innerHTML = '';
        document.getElementById('addBtn').disabled = true;
    }

    /**
     * Refresh all prices
     */
    refreshAllPrices() {
        const btn = document.getElementById('refreshBtn');
        btn.disabled = true;
        btn.style.opacity = '0.5';

        const promises = Array.from(this.watchlist).map(symbol =>
            fetch(`${this.apiBaseUrl}/stocks/${symbol}`).then(res => res.json())
        );

        Promise.all(promises)
            .then(results => {
                results.forEach(data => {
                    if (data.success && data.data) {
                        this.stocks.set(data.data.symbol, data.data);
                    }
                });
                this.displayWatchlist();
                this.showToast('Prices refreshed', 'success');
            })
            .catch(error => {
                console.error('Refresh error:', error);
                this.showToast('Failed to refresh prices', 'error');
            })
            .finally(() => {
                btn.disabled = false;
                btn.style.opacity = '1';
            });
    }

    /**
     * Update market summary
     */
    updateMarketSummary() {
        const container = document.getElementById('marketSummary');
        const stocks = Array.from(this.stocks.values());

        if (stocks.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">No data available</p>';
            return;
        }

        const totalUp = stocks.filter(s => (s.change || 0) >= 0).length;
        const totalDown = stocks.filter(s => (s.change || 0) < 0).length;
        const avgChange = stocks.reduce((sum, s) => sum + (s.change_percent || 0), 0) / stocks.length;

        container.innerHTML = `
            <div class="summary-card">
                <div class="summary-label">Stocks Watched</div>
                <div class="summary-value">${stocks.length}</div>
            </div>
            <div class="summary-card">
                <div class="summary-label">Gaining</div>
                <div class="summary-value" style="color: var(--green-up);">${totalUp}</div>
            </div>
            <div class="summary-card">
                <div class="summary-label">Losing</div>
                <div class="summary-value" style="color: var(--red-down);">${totalDown}</div>
            </div>
            <div class="summary-card">
                <div class="summary-label">Avg Change</div>
                <div class="summary-value" style="color: ${avgChange >= 0 ? 'var(--green-up)' : 'var(--red-down)'};">
                    ${avgChange.toFixed(2)}%
                </div>
            </div>
        `;
    }

    /**
     * Resubscribe to all stocks when WebSocket reconnects
     */
    resubscribeToStocks() {
        this.watchlist.forEach(symbol => {
            this.wsManager.subscribe(symbol);
        });
    }

    /**
     * Show toast notification
     */
    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <span class="toast-message">${message}</span>
            <button class="toast-close">×</button>
        `;

        container.appendChild(toast);

        toast.querySelector('.toast-close').addEventListener('click', () => {
            toast.remove();
        });

        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, 4000);
    }

    /**
     * Utility: Format currency
     */
    formatCurrency(value) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(value || 0);
    }

    /**
     * Utility: Format volume
     */
    formatVolume(volume) {
        if (!volume) return '0';
        if (volume >= 1e9) return (volume / 1e9).toFixed(2) + 'B';
        if (volume >= 1e6) return (volume / 1e6).toFixed(2) + 'M';
        if (volume >= 1e3) return (volume / 1e3).toFixed(2) + 'K';
        return volume.toString();
    }

    /**
     * Utility: Format time
     */
    formatTime(timestamp) {
        if (!timestamp) return 'N/A';
        const date = new Date(timestamp);
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });
    }

    /**
     * Utility: Format chart label
     */
    formatChartLabel(date, format) {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const hour = String(date.getHours()).padStart(2, '0');
        const minute = String(date.getMinutes()).padStart(2, '0');

        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

        switch(format) {
            case 'HH:mm': return `${hour}:${minute}`;
            case 'ddd': return days[date.getDay()];
            case 'MMM DD': return `${months[date.getMonth()]} ${day}`;
            case 'MMM': return months[date.getMonth()];
            default: return `${day}/${month}`;
        }
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new StockTrackerApp();
});
