"use client";

import { useState } from "react";
import { Search, Loader2 } from "lucide-react";

interface SearchBarProps {
    onSearch: (symbol: string) => void;
}

export function SearchBar({ onSearch }: SearchBarProps) {
    const [query, setQuery] = useState("");
    const [isSearching, setIsSearching] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim()) return;

        setIsSearching(true);
        onSearch(query.toUpperCase().trim());
        setQuery("");

        // Reset loading state after a small delay
        setTimeout(() => setIsSearching(false), 500);
    };

    return (
        <form onSubmit={handleSubmit} className="relative w-full max-w-xl">
            <div className="relative group">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-blue-500 transition-colors">
                    <Search size={18} />
                </div>
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search stock symbol (e.g. BTC, AAPL, NVDA)..."
                    className="w-full bg-slate-900/60 border border-slate-700/50 rounded-2xl py-3 pl-12 pr-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all backdrop-blur-md"
                />
                <div className="absolute inset-y-0 right-3 flex items-center">
                    <button
                        type="submit"
                        disabled={isSearching}
                        className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white text-xs font-bold px-4 py-1.5 rounded-xl transition-all shadow-lg shadow-blue-500/20 active:scale-95 flex items-center gap-2"
                    >
                        {isSearching ? <Loader2 size={14} className="animate-spin" /> : "Track"}
                    </button>
                </div>
            </div>
        </form>
    );
}
