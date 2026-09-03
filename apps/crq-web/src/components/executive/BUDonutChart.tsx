"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { formatINR } from "@/lib/formatters";

// MOCKED DATA: Backend doesn't yet support BU breakdown querying (F2.1.5)
const MOCK_DATA = [
  { name: "Retail Banking", value: 45000000, color: "#2864f0" },
  { name: "Corporate Banking", value: 32000000, color: "#1a4dc3" },
  { name: "Wealth Management", value: 18000000, color: "#ef806d" },
  { name: "Digital Channels", value: 55000000, color: "#0e9f72" },
];

export default function BUDonutChart() {
  const total = MOCK_DATA.reduce((acc, curr) => acc + curr.value, 0);

  return (
    <div className="bg-surface border border-surfaceBorder rounded-lg p-5 shadow-card flex flex-col h-full relative">
      <div className="absolute top-2 right-2 bg-brand-500/10 text-brand-500 text-[10px] px-2 py-0.5 rounded-full border border-brand-500/20 font-bold uppercase z-10">
        Mocked
      </div>
      <div className="mb-4">
        <h3 className="text-navy font-serif font-medium text-[17px]">EAL by Business Unit</h3>
        <p className="text-[11px] text-muted">Risk distribution across departments</p>
      </div>
      
      <div className="flex-1 min-h-[220px] relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={MOCK_DATA}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={85}
              paddingAngle={2}
              dataKey="value"
              stroke="none"
            >
              {MOCK_DATA.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => [formatINR(value), "EAL"]}
              contentStyle={{ backgroundColor: "#17243b", border: "none", borderRadius: "8px", color: "#fff", fontSize: "12px" }}
              itemStyle={{ color: "#fff" }}
            />
            <Legend 
              verticalAlign="bottom" 
              height={36} 
              iconType="circle"
              wrapperStyle={{ fontSize: "11px", color: "#7b879d" }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none pb-8">
          <div className="text-center">
            <div className="text-[10px] text-muted font-semibold uppercase tracking-widest">Total EAL</div>
            <div className="font-bold text-navy tabular-nums text-sm">{formatINR(total)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
