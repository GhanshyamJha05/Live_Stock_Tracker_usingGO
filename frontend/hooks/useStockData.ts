"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export interface StockUpdate {
    symbol: string;
    name: string;
    price: number;
    change: number;
    changePercent: number;
    high: number;
    low: number;
    open: number;
    volume: number;
    timestamp: string;
}

export function useStockData() {
    const [stocks, setStocks] = useState<Record<string, StockUpdate>>({});
    const [isConnected, setIsConnected] = useState(false);
    const [watchlist, setWatchlist] = useState<string[]>([]);
    const ws = useRef<WebSocket | null>(null);
    const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);

    // Load watchlist from localStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem("watchlist");
        if (saved) {
            setWatchlist(JSON.parse(saved));
        } else {
            // Default stocks
            const defaults = ["AAPL", "GOOGL", "MSFT", "AMZN", "TSLA"];
            setWatchlist(defaults);
            localStorage.setItem("watchlist", JSON.stringify(defaults));
        }
    }, []);

    const connect = useCallback(() => {
        if (ws.current?.readyState === WebSocket.OPEN) return;

        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        // For local dev, we might need to point to localhost:8080 specifically if not proxied
        const wsUrl = process.env.NEXT_PUBLIC_WS_URL || `${protocol}//${window.location.host}/ws`;

        console.log("Connecting to WebSocket:", wsUrl);
        const socket = new WebSocket(wsUrl);

        socket.onopen = () => {
            console.log("WebSocket Connected");
            setIsConnected(true);
            // Subscribe to all stocks in watchlist
            watchlist.forEach(symbol => {
                socket.send(JSON.stringify({ type: "subscribe", symbol }));
            });
        };

        socket.onmessage = (event) => {
            const message = JSON.parse(event.data);
            if (message.type === "update") {
                setStocks((prev) => ({
                    ...prev,
                    [message.data.symbol]: message.data,
                }));
            }
        };

        socket.onclose = () => {
            console.log("WebSocket Disconnected");
            setIsConnected(false);
            // Reconnect after 3 seconds
            reconnectTimeout.current = setTimeout(connect, 3000);
        };

        socket.onerror = (error) => {
            console.error("WebSocket Error:", error);
            socket.close();
        };

        ws.current = socket;
    }, [watchlist]);

    useEffect(() => {
        connect();
        return () => {
            if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
            ws.current?.close();
        };
    }, [connect]);

    const addToWatchlist = (symbol: string) => {
        if (watchlist.includes(symbol)) return;
        const newWatchlist = [...watchlist, symbol];
        setWatchlist(newWatchlist);
        localStorage.setItem("watchlist", JSON.stringify(newWatchlist));
        if (ws.current?.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({ type: "subscribe", symbol }));
        }
    };

    const removeFromWatchlist = (symbol: string) => {
        const newWatchlist = watchlist.filter((s) => s !== symbol);
        setWatchlist(newWatchlist);
        localStorage.setItem("watchlist", JSON.stringify(newWatchlist));
        if (ws.current?.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({ type: "unsubscribe", symbol }));
        }
        setStocks((prev) => {
            const next = { ...prev };
            delete next[symbol];
            return next;
        });
    };

    return {
        stocks,
        isConnected,
        watchlist,
        addToWatchlist,
        removeFromWatchlist,
    };
}
