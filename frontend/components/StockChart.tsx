"use client";

import { useMemo } from "react";
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from "recharts";
import { formatCurrency } from "@/lib/utils";

interface ChartData {
    time: string;
    price: number;
}

interface StockChartProps {
    data: ChartData[];
    symbol: string;
    color?: string;
}

export function StockChart({ data, symbol, color = "#3b82f6" }: StockChartProps) {
    const minPrice = useMemo(() => Math.min(...data.map((d) => d.price)) * 0.99, [data]);
    const maxPrice = useMemo(() => Math.max(...data.map((d) => d.price)) * 1.01, [data]);

    return (
        <div className="h-[400px] w-full bg-slate-900/40 rounded-2xl border border-slate-800 p-6 backdrop-blur-xl">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-xl font-bold text-white">{symbol} Performance</h2>
                    <p className="text-sm text-slate-400">Real-time price history</p>
                </div>
                <div className="flex gap-2">
                    {["1D", "1W", "1M", "3M", "1Y"].map((period) => (
                        <button
                            key={period}
                            className="px-3 py-1 text-xs font-semibold rounded-lg bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
                        >
                            {period}
                        </button>
                    ))}
                </div>
            </div>

            <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data}>
                        <defs>
                            <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                                <stop offset="95%" stopColor={color} stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                        <XAxis
                            dataKey="time"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: "#64748b", fontSize: 10 }}
                            minTickGap={30}
                        />
                        <YAxis
                            domain={[minPrice, maxPrice]}
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: "#64748b", fontSize: 10 }}
                            tickFormatter={(val) => `$${val.toFixed(0)}`}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: "#0f172a",
                                border: "1px solid #1e293b",
                                borderRadius: "12px",
                                fontSize: "12px",
                                color: "#f8fafc",
                            }}
                            formatter={(value: number | any) => [formatCurrency(Number(value) || 0), "Price"] as [string, string]}
                        />
                        <Area
                            type="monotone"
                            dataKey="price"
                            stroke={color}
                            strokeWidth={3}
                            fillOpacity={1}
                            fill="url(#colorPrice)"
                            animationDuration={1500}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
