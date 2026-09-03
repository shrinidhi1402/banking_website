"use client";

import { AlertCircle, TrendingDown } from "lucide-react";
import { formatINR, formatPercentage } from "@/lib/formatters";

// MOCKED DATA: Backend optimize/remediation endpoints (F2.1.4) are stubs
const MOCK_OPPORTUNITIES = [
  { id: 1, action: "Patch CVE-2023-44487 on Edge Gateways", cost: 250000, reductionEAL: 8500000, rosi: 33 },
  { id: 2, action: "Implement MFA for legacy CRM (Bypass Found)", cost: 1200000, reductionEAL: 14200000, rosi: 10.8 },
  { id: 3, action: "Rotate exposed AWS IAM credentials", cost: 50000, reductionEAL: 2100000, rosi: 41 },
  { id: 4, action: "Fix IDOR in Customer Profile API", cost: 400000, reductionEAL: 6800000, rosi: 16 },
  { id: 5, action: "Update OpenSSL on Internal Payments Switch", cost: 300000, reductionEAL: 3500000, rosi: 10.6 },
];

export default function RiskReductionOpportunities() {
  return (
    <div className="bg-surface border border-surfaceBorder rounded-lg shadow-card flex flex-col h-full relative">
      <div className="absolute top-2 right-2 bg-brand-500/10 text-brand-500 text-[10px] px-2 py-0.5 rounded-full border border-brand-500/20 font-bold uppercase z-10">
        Mocked
      </div>
      <div className="p-5 border-b border-surfaceBorder">
        <h3 className="text-navy font-serif font-medium text-[17px]">Risk Reduction Opportunities</h3>
        <p className="text-[11px] text-muted">Top 10 highest-ROI remediation actions</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-background text-muted text-[9px] uppercase font-bold tracking-[0.7px]">
              <th className="px-4 py-3 border-b border-surfaceBorder">Action / Finding</th>
              <th className="px-4 py-3 border-b border-surfaceBorder text-right">Est. Cost</th>
              <th className="px-4 py-3 border-b border-surfaceBorder text-right">Δ EAL (Reduction)</th>
              <th className="px-4 py-3 border-b border-surfaceBorder text-right">ROSI</th>
            </tr>
          </thead>
          <tbody className="text-[11px]">
            {MOCK_OPPORTUNITIES.map((opp) => (
              <tr key={opp.id} className="border-b border-surfaceBorder hover:bg-background transition-colors">
                <td className="px-4 py-3 text-navy font-medium max-w-[200px] truncate" title={opp.action}>
                  {opp.action}
                </td>
                <td className="px-4 py-3 text-right text-muted tabular-nums">
                  {formatINR(opp.cost)}
                </td>
                <td className="px-4 py-3 text-right font-bold text-riskLow flex justify-end items-center tabular-nums">
                  <TrendingDown className="w-3 h-3 mr-1" />
                  {formatINR(opp.reductionEAL)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  <span className="bg-brand-500/10 text-brand-500 px-2 py-1 rounded-full font-bold">
                    {opp.rosi.toFixed(1)}x
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
