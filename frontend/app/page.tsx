"use client";

import { useState, useMemo } from "react";
import { useStockData } from "@/hooks/useStockData";
import { StockCard } from "@/components/StockCard";
import { StockChart } from "@/components/StockChart";
import { SearchBar } from "@/components/SearchBar";
import { cn, formatNumber } from "@/lib/utils";
import {
  BarChart3,
  LayoutDashboard,
  TrendingUp,
  Activity,
  Bell,
  Settings,
  Circle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function Dashboard() {
  const { stocks, isConnected, watchlist, addToWatchlist, removeFromWatchlist } = useStockData();
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);

  // Generate mock history for the selected stock
  const chartData = useMemo(() => {
    if (!selectedSymbol || !stocks[selectedSymbol]) return [];

    const stock = stocks[selectedSymbol];
    const basePrice = stock.price;
    return Array.from({ length: 20 }).map((_, i) => ({
      time: `${10 + i}:00`,
      price: basePrice * (0.98 + Math.random() * 0.04),
    }));
  }, [selectedSymbol, stocks]);

  const activeStock = selectedSymbol ? stocks[selectedSymbol] : null;

  const marketSummary = useMemo(() => {
    const values = Object.values(stocks);
    if (values.length === 0) return { up: 0, down: 0, avg: 0 };

    const up = values.filter(s => s.change >= 0).length;
    const down = values.length - up;
    const avg = values.reduce((acc, s) => acc + s.changePercent, 0) / values.length;

    return { up, down, avg };
  }, [stocks]);

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 selection:bg-blue-500/30">
      {/* Sidebar - Desktop */}
      <aside className="fixed left-0 top-0 bottom-0 w-64 border-r border-slate-800 bg-[#020617]/80 backdrop-blur-xl z-50 hidden lg:flex flex-col">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/20">
              <TrendingUp className="text-white" size={24} />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white italic">PRO<span className="text-blue-500">TRACK</span></h1>
          </div>

          <nav className="space-y-1">
            <NavItem icon={<LayoutDashboard size={18} />} label="Dashboard" active />
            <NavItem icon={<BarChart3 size={18} />} label="Portfolio" />
            <NavItem icon={<Activity size={18} />} label="Market News" />
            <NavItem icon={<Bell size={18} />} label="Alerts" />
            <NavItem icon={<Settings size={18} />} label="Settings" />
          </nav>
        </div>

        <div className="mt-auto p-6 border-t border-slate-800">
          <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-800">
            <p className="text-xs text-slate-500 mb-1">Connection</p>
            <div className="flex items-center gap-2">
              <Circle size={8} className={cn("fill-current", isConnected ? "text-emerald-500" : "text-rose-500")} />
              <span className="text-sm font-medium">{isConnected ? "Live Data" : "Disconnected"}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-64 p-4 md:p-8 lg:p-12">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div>
            <h2 className="text-3xl font-bold text-white tracking-tight mb-2">Market Overview</h2>
            <p className="text-slate-400">Track your favorite assets in real-time.</p>
          </div>
          <SearchBar onSearch={addToWatchlist} />
        </header>

        {/* Market Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-12">
          <SummaryCard
            label="Tracked Assets"
            value={watchlist.length.toString()}
            subValue="Real-time updates"
          />
          <SummaryCard
            label="Market Sentiment"
            value={`${marketSummary.up}/${watchlist.length}`}
            subValue="Gaining vs Total"
            color={marketSummary.up > marketSummary.down ? "text-emerald-500" : "text-rose-500"}
          />
          <SummaryCard
            label="Avg. Day Change"
            value={`${formatNumber(marketSummary.avg)}%`}
            subValue="Portfolio performance"
            color={marketSummary.avg >= 0 ? "text-emerald-500" : "text-rose-500"}
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Watchlist Column */}
          <div className="xl:col-span-1 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-bold text-white">Watchlist</h3>
              <span className="text-xs text-slate-500 font-medium">Auto-refreshing</span>
            </div>

            <div className="grid grid-cols-1 gap-4 max-h-[700px] overflow-y-auto pr-2 scrollbar-hide">
              <AnimatePresence mode="popLayout">
                {watchlist.map((symbol) => (
                  stocks[symbol] ? (
                    <StockCard
                      key={symbol}
                      stock={stocks[symbol]}
                      onRemove={removeFromWatchlist}
                      isActive={selectedSymbol === symbol}
                      onClick={setSelectedSymbol}
                    />
                  ) : (
                    <div key={symbol} className="h-28 rounded-xl bg-slate-900/50 border border-slate-800 animate-pulse" />
                  )
                ))}
              </AnimatePresence>
              {watchlist.length === 0 && (
                <div className="py-20 text-center border-2 border-dashed border-slate-800 rounded-2xl">
                  <p className="text-slate-500">No stocks in watchlist</p>
                </div>
              )}
            </div>
          </div>

          {/* Chart/Details Column */}
          <div className="xl:col-span-2 space-y-8">
            {selectedSymbol && stocks[selectedSymbol] ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                key={selectedSymbol}
                className="space-y-8"
              >
                <StockChart
                  data={chartData}
                  symbol={selectedSymbol}
                  color={stocks[selectedSymbol].change >= 0 ? "#10b981" : "#ef4444"}
                />

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <DetailBox label="Open" value={formatNumber(activeStock?.open || 0)} />
                  <DetailBox label="High" value={formatNumber(activeStock?.high || 0)} />
                  <DetailBox label="Low" value={formatNumber(activeStock?.low || 0)} />
                  <DetailBox label="Volume" value={formatNumber(activeStock?.volume || 0)} />
                </div>
              </motion.div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center py-32 bg-slate-900/20 border border-slate-800 rounded-3xl border-dashed">
                <div className="w-16 h-16 rounded-full bg-slate-900 flex items-center justify-center mb-4">
                  <BarChart3 className="text-slate-700" size={32} />
                </div>
                <h3 className="text-lg font-medium text-slate-400">Select an asset to view details</h3>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function NavItem({ icon, label, active = false }: { icon: React.ReactNode; label: string; active?: boolean }) {
  return (
    <button className={cn(
      "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all",
      active
        ? "bg-blue-600/10 text-blue-500 font-bold border border-blue-500/20 shadow-lg shadow-blue-500/5"
        : "text-slate-400 hover:text-white hover:bg-slate-900"
    )}>
      {icon}
      <span className="text-sm">{label}</span>
    </button>
  );
}

function SummaryCard({ label, value, subValue, color = "text-white" }: { label: string; value: string; subValue: string; color?: string }) {
  return (
    <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:scale-110 transition-transform">
        <Activity size={48} />
      </div>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{label}</p>
      <div className={cn("text-3xl font-bold tracking-tight mb-1", color)}>{value}</div>
      <p className="text-xs text-slate-500">{subValue}</p>
    </div>
  );
}

function DetailBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">{label}</p>
      <p className="text-lg font-bold text-white">{value}</p>
    </div>
  );
}
