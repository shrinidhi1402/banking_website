"use client";

import { useState } from "react";
import { Search, ShieldCheck, ShieldAlert, ArrowRight, CornerDownLeft } from "lucide-react";
import { queryNlMock, QueryResponse } from "@/lib/mock-api";
import { formatINR } from "@/lib/formatters";

export default function NLQuerySearch() {
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<QueryResponse | null>(null);
  const [error, setError] = useState("");

  const handleSubmit = async (e?: React.FormEvent, presetQuery?: string) => {
    if (e) e.preventDefault();
    const q = presetQuery || query;
    if (!q.trim()) return;

    setIsLoading(true);
    setError("");
    setResponse(null);
    if (presetQuery) setQuery(presetQuery);

    try {
      // Use MOCK API until B4.2 is available
      const res = await queryNlMock({ query: q });
      setResponse(res);
    } catch (err: any) {
      setError("Failed to process query.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-surface border border-surfaceBorder rounded-lg shadow-card flex flex-col overflow-hidden">
      <form onSubmit={handleSubmit} className="relative border-b border-surfaceBorder">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-500" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask a question about your risk posture (e.g. 'I have ₹10 lakh to spend...')"
          className="w-full bg-transparent pl-12 pr-12 py-5 text-navy focus:outline-none placeholder:text-muted text-lg"
          disabled={isLoading}
        />
        <button 
          type="submit"
          disabled={!query.trim() || isLoading}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-brand-400 disabled:opacity-50"
        >
          <CornerDownLeft className="w-5 h-5" />
        </button>
      </form>

      {/* Suggested Queries */}
      {!response && !isLoading && (
        <div className="p-4 bg-surface/30 flex gap-2 overflow-x-auto">
          <button 
            onClick={() => handleSubmit(undefined, "I have ₹10 lakh to spend, which fixes give me the best risk reduction?")}
            className="whitespace-nowrap text-xs bg-surface border border-surfaceBorder text-navy px-3 py-1.5 rounded-full hover:border-brand-500 hover:text-brand-400 transition-colors"
          >
            "I have ₹10 lakh to spend..."
          </button>
          <button 
            onClick={() => handleSubmit(undefined, "What are our top 3 risk drivers?")}
            className="whitespace-nowrap text-xs bg-surface border border-surfaceBorder text-navy px-3 py-1.5 rounded-full hover:border-brand-500 hover:text-brand-400 transition-colors"
          >
            "Top 3 risk drivers"
          </button>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="p-6 flex items-center gap-3 text-brand-500">
          <div className="w-4 h-4 rounded-full border-2 border-brand-500 border-t-transparent animate-spin"></div>
          <span className="text-sm font-medium animate-pulse">Analyzing risk data via FAIR engine...</span>
        </div>
      )}

      {/* Response State */}
      {response && !isLoading && (
        <div className="p-6">
          {/* Grounding Indicator (Architecture §7.6) */}
          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium mb-4 border ${
            response.grounded 
              ? "bg-brand-500/10 border-brand-500/20 text-brand-400" 
              : "bg-riskMedium/10 border-riskMedium/20 text-riskMedium"
          }`}>
            {response.grounded ? <ShieldCheck className="w-3.5 h-3.5" /> : <ShieldAlert className="w-3.5 h-3.5" />}
            {response.grounded ? "Verified against engine data" : "Warning: Unverified"}
          </div>

          {/* Prose Answer */}
          <p className="text-navy leading-relaxed mb-6">
            {response.answer}
          </p>

          {/* Structured Data (Optimizer Output) */}
          {response.structured_data && (
            <div className="mb-6 space-y-3">
              <h4 className="text-sm font-semibold text-navy border-b border-surfaceBorder pb-2">Recommended Actions (Budget: ₹10 Lakh)</h4>
              {response.structured_data.selected_actions.map((action, idx) => (
                <div key={action.id} className="bg-surface border border-surfaceBorder rounded-lg p-3 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="bg-surface text-muted text-xs px-2 py-0.5 rounded border border-surfaceBorder">#{idx + 1}</span>
                      <span className="text-sm font-medium text-navy">{action.description}</span>
                    </div>
                    <div className="text-xs text-muted mt-1 pl-9">Cost: {formatINR(action.cost)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-brand-400">-{formatINR(action.eal_reduction)} EAL</div>
                    <div className="text-xs text-muted">ROSI: {action.rosi.toFixed(1)}x</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Citations */}
          {response.citations && response.citations.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-4 border-t border-surfaceBorder">
              <span className="text-xs text-muted py-1 mr-1">Sources:</span>
              {response.citations.map((cite, i) => (
                <a key={i} href="#" className="inline-flex items-center gap-1 bg-surface border border-surfaceBorder text-muted hover:text-navy text-xs px-2 py-1 rounded transition-colors">
                  {cite.type === "metric" ? "📊" : cite.type === "vuln" ? "🐛" : "🖥️"} {cite.label}
                  <ArrowRight className="w-3 h-3 opacity-50" />
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
