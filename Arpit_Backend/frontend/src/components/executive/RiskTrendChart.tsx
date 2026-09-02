"use client";

import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getRiskHistory } from "@/lib/api";
import { formatINR } from "@/lib/formatters";
import { formatDateShort } from "@/lib/formatters";

export default function RiskTrendChart() {
  const { data, isLoading } = useQuery({
    queryKey: ["riskHistory", "org"],
    queryFn: () => getRiskHistory("org"),
  });

  const chartData = data?.points?.map((p: any) => ({
    date: formatDateShort(p.timestamp),
    rawTimestamp: p.timestamp,
    eal: p.eal,
  })) || [];

  return (
    <div className="bg-surface border border-surfaceBorder rounded-lg p-5 shadow-card">
      <h3 className="text-sm font-semibold text-navy mb-6">90-Day Risk Trend (EAL)</h3>
      
      {isLoading ? (
        <div className="h-[250px] w-full flex items-center justify-center">
          <div className="animate-pulse bg-surface border border-surfaceBorder w-full h-full rounded-md"></div>
        </div>
      ) : (
        <div className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorEal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="date" 
                stroke="#64748b" 
                fontSize={12} 
                tickLine={false} 
                axisLine={false} 
                minTickGap={30}
              />
              <YAxis 
                stroke="#64748b" 
                fontSize={12} 
                tickLine={false} 
                axisLine={false} 
                tickFormatter={(val) => {
                  if (val >= 10000000) return `₹${(val / 10000000).toFixed(0)}Cr`;
                  if (val >= 100000) return `₹${(val / 100000).toFixed(0)}L`;
                  return `₹${val}`;
                }}
                width={65}
              />
              <Tooltip 
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-surface border border-surfaceBorder p-3 rounded-lg shadow-xl text-sm">
                        <p className="text-muted mb-1">{label}</p>
                        <p className="font-semibold text-brand-400">
                          EAL: {formatINR(payload[0].value as number)}
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area 
                type="monotone" 
                dataKey="eal" 
                stroke="#14b8a6" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorEal)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
