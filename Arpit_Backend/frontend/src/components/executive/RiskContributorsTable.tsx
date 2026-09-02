"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, ShieldAlert } from "lucide-react";
import { getRiskContributors } from "@/lib/api";
import { formatINR, formatPercentage } from "@/lib/formatters";

export default function RiskContributorsTable() {
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["riskContributors"],
    queryFn: () => getRiskContributors(15),
    refetchInterval: 30000,
  });

  const filteredData = useMemo(() => {
    if (!data?.top_contributors) return [];
    if (!search) return data.top_contributors;
    
    const lowerSearch = search.toLowerCase();
    return data.top_contributors.filter((c: any) => 
      c.name.toLowerCase().includes(lowerSearch) || 
      (c.cve_id && c.cve_id.toLowerCase().includes(lowerSearch))
    );
  }, [data, search]);

  return (
    <div className="bg-surface border border-surfaceBorder rounded-lg shadow-card flex flex-col">
      <div className="p-5 border-b border-surfaceBorder flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-navy">Top Risk Contributors</h3>
          <p className="text-xs text-muted mt-1">Unresolved problems driving portfolio EAL</p>
        </div>
        <div className="relative relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input 
            type="text"
            placeholder="Search CVE, asset..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-surface border border-surfaceBorder rounded-md pl-9 pr-3 py-1.5 text-sm text-navy focus:outline-none focus:border-brand-500 placeholder:text-muted/70 transition-colors"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-surfaceBorder bg-background text-muted text-xs uppercase tracking-wider">
              <th className="px-5 py-3 font-medium">Driver / Asset</th>
              <th className="px-5 py-3 font-medium text-right">EAL Contribution</th>
              <th className="px-5 py-3 font-medium text-right">% of Total Risk</th>
              <th className="px-5 py-3 font-medium text-center">CVSS</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {isLoading ? (
              Array(5).fill(0).map((_, i) => (
                <tr key={i} className="border-b border-surfaceBorder/50 animate-pulse">
                  <td className="px-5 py-4"><div className="h-4 bg-surfaceBorder rounded w-48"></div></td>
                  <td className="px-5 py-4"><div className="h-4 bg-surfaceBorder rounded w-24 ml-auto"></div></td>
                  <td className="px-5 py-4"><div className="h-4 bg-surfaceBorder rounded w-16 ml-auto"></div></td>
                  <td className="px-5 py-4"><div className="h-4 bg-surfaceBorder rounded w-8 mx-auto"></div></td>
                </tr>
              ))
            ) : filteredData.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-12 text-center text-muted">
                  <ShieldAlert className="w-8 h-8 mx-auto mb-3 opacity-50" />
                  <p>No risk contributors found matching "{search}"</p>
                </td>
              </tr>
            ) : (
              filteredData.map((item: any, idx: number) => (
                <tr key={idx} className="border-b border-surfaceBorder/50 hover:bg-background transition-colors">
                  <td className="px-5 py-4">
                    <div className="font-medium text-navy flex items-center">
                      {item.cve_id ? (
                        <span className="text-riskHigh mr-2">{item.cve_id}</span>
                      ) : null}
                      {item.name}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-right font-medium text-navy">
                    {formatINR(item.eal_contribution)}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-muted">{formatPercentage(item.percentage_of_total)}</span>
                      <div className="w-16 h-1.5 bg-surfaceBorder rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-brand-500" 
                          style={{ width: `${Math.min(100, item.percentage_of_total)}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-center">
                    {item.cvss_score ? (
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        item.cvss_score >= 9.0 ? "bg-riskCritical/20 text-riskCritical" :
                        item.cvss_score >= 7.0 ? "bg-riskHigh/20 text-riskHigh" :
                        "bg-riskMedium/20 text-riskMedium"
                      }`}>
                        {item.cvss_score.toFixed(1)}
                      </span>
                    ) : (
                      <span className="text-muted/70">-</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
