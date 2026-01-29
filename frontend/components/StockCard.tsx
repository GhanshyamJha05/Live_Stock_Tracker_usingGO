"use client";

import { StockUpdate } from "@/hooks/useStockData";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";
import { TrendingDown, TrendingUp, X } from "lucide-react";
import { motion } from "framer-motion";

interface StockCardProps {
    stock: StockUpdate;
    onRemove: (symbol: string) => void;
    isActive?: boolean;
    onClick?: (symbol: string) => void;
}

export function StockCard({ stock, onRemove, isActive, onClick }: StockCardProps) {
    const isPositive = stock.change >= 0;

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            whileHover={{ y: -4 }}
            onClick={() => onClick?.(stock.symbol)}
            className={cn(
                "relative group cursor-pointer p-4 rounded-xl border transition-all duration-300",
                "bg-slate-900/50 backdrop-blur-sm border-slate-800",
                isActive ? "ring-2 ring-blue-500 border-transparent shadow-lg shadow-blue-500/20" : "hover:border-slate-700",
            )}
        >
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    onRemove(stock.symbol);
                }}
                className="absolute top-2 right-2 p-1 rounded-full bg-slate-800 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/20 hover:text-red-500"
            >
                <X size={14} />
            </button>

            <div className="flex justify-between items-start mb-3">
                <div>
                    <h3 className="text-lg font-bold text-white tracking-tight">{stock.symbol}</h3>
                    <p className="text-xs text-slate-400 truncate max-w-[120px]">{stock.name}</p>
                </div>
                <div className={cn(
                    "flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold",
                    isPositive ? "text-emerald-400 bg-emerald-400/10" : "text-rose-400 bg-rose-400/10"
                )}>
                    {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {isPositive ? "+" : ""}{formatNumber(stock.changePercent)}%
                </div>
            </div>

            <div className="flex items-end justify-between">
                <div>
                    <div className="text-2xl font-bold text-white tracking-tighter">
                        {formatCurrency(stock.price)}
                    </div>
                    <p className={cn(
                        "text-xs font-medium",
                        isPositive ? "text-emerald-500" : "text-rose-500"
                    )}>
                        {isPositive ? "+" : ""}{formatNumber(stock.change)} Today
                    </p>
                </div>
                <div className="text-right text-[10px] text-slate-500 font-mono">
                    Vol: {formatNumber(stock.volume)}
                </div>
            </div>

            {/* Mini animation stripe for active updates */}
            <motion.div
                key={stock.price}
                initial={{ opacity: 0.5, scaleX: 0 }}
                animate={{ opacity: 0, scaleX: 1 }}
                transition={{ duration: 0.5 }}
                className={cn(
                    "absolute inset-x-0 bottom-0 h-0.5 rounded-full origin-left",
                    isPositive ? "bg-emerald-500" : "bg-rose-500"
                )}
            />
        </motion.div>
    );
}
