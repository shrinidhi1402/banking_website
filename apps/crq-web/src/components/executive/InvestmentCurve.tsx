"use client";

import { useQuery } from "@tanstack/react-query";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { optimizeBudgetMock } from "@/lib/mock-api";
import { formatINR } from "@/lib/formatters";

export default function InvestmentCurve() {
  // Uses MOCK API until B3.2 is available
  const { data, isLoading } = useQuery({
    queryKey: ["investmentCurve"],
    queryFn: () => optimizeBudgetMock({ budget: 5000000 }), // Request full curve up to 50L
  });

  const chartData = data?.curve_data || [];

  return (
    <div className="bg-surface border border-surfaceBorder rounded-lg p-5 shadow-card">
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-navy">Investment vs. Risk Reduction</h3>
        <p className="text-xs text-muted mt-1">Pareto optimal budget allocation curve</p>
      </div>
      
      {isLoading ? (
        <div className="h-[250px] w-full flex items-center justify-center">
          <div className="animate-pulse bg-surface border border-surfaceBorder w-full h-full rounded-md"></div>
        </div>
      ) : (
        <div className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis 
                dataKey="budget" 
                stroke="#64748b" 
                fontSize={12} 
                tickLine={false} 
                axisLine={false} 
                tickFormatter={(val) => {
                  if (val === 0) return "₹0";
                  if (val >= 10000000) return `₹${(val / 10000000).toFixed(1)}Cr`;
                  if (val >= 100000) return `₹${(val / 100000).toFixed(0)}L`;
                  return `₹${val}`;
                }}
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
                        <p className="font-medium text-navy mb-1">
                          Budget: {formatINR(label as number)}
                        </p>
                        <p className="text-brand-400">
                          Residual EAL: {formatINR(payload[0].value as number)}
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Line 
                type="monotone" 
                dataKey="residual_eal" 
                stroke="#0ea5e9" 
                strokeWidth={3}
                dot={{ r: 4, fill: "#0f172a", stroke: "#0ea5e9", strokeWidth: 2 }}
                activeDot={{ r: 6, fill: "#0ea5e9" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
