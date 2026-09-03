"use client";

import { useQuery } from "@tanstack/react-query";
import { TrendingDown, TrendingUp, AlertTriangle } from "lucide-react";
import { getRiskSummary } from "@/lib/api";
import { formatINR, formatDateShort } from "@/lib/formatters";

export default function EALCard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["riskSummary", "org"],
    queryFn: () => getRiskSummary("org"),
    refetchInterval: 15000, // Real-time pulse
  });

  if (isLoading) {
    return (
      <div className="bg-surface border border-surfaceBorder rounded-lg p-6 h-40 animate-pulse flex flex-col justify-between">
        <div className="h-4 bg-surfaceBorder w-32 rounded"></div>
        <div className="h-10 bg-surfaceBorder w-48 rounded"></div>
        <div className="h-3 bg-surfaceBorder w-24 rounded"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-surface border border-surfaceBorder rounded-lg p-6 h-40 flex items-center justify-center text-riskCritical">
        <AlertTriangle className="w-5 h-5 mr-2" />
        <span className="text-sm">Failed to load risk data</span>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-surfaceBorder rounded-lg p-5 shadow-card">
      <div className="flex items-start justify-between font-semibold text-muted text-[11px] mb-2">
        <h3 className="uppercase tracking-wider">Expected Annual Loss (EAL)</h3>
        <span className="text-[10px] text-brand-500 bg-brand-500/10 px-2 py-0.5 rounded-full border border-brand-500/20">
          Org-wide
        </span>
      </div>

      <div className="flex flex-col mt-3">
        <div className="text-[24px] font-bold text-navy tracking-tight tabular-nums">
          {formatINR(data.eal)}
        </div>
        <div className="flex items-center mt-1 space-x-2">
          <span className="text-muted text-[10px]">VaR 95: <span className="font-bold">{formatINR(data.var_95)}</span></span>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-surfaceBorder flex justify-between text-[10px] text-muted">
        <span>Engine v{data.calculation_version || "2.1.0"}</span>
        <span>Last computed: {data.computed_at ? formatDateShort(data.computed_at) : "Just now"}</span>
      </div>
    </div>
  );
}
