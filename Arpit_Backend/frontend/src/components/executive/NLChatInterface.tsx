"use client";

import { useState } from "react";
import { Search, Send, ShieldCheck, AlertTriangle, MessageSquare, History } from "lucide-react";
import { formatINR } from "@/lib/formatters";
import { askQuery } from "@/lib/api";

// Mock citations
const CITATIONS: Record<string, string> = {
  "c1": "Source: Database eal_snapshots (Row ID: 94a2-11bc) - Latest EAL Record",
  "c2": "Source: Vulnerability Scanner (CVE-2023-44487) - Critical severity on Edge Gateways",
  "c3": "Source: Threat Intel Feed (APT29) - Increased frequency in finance sector"
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  grounded?: boolean;
  grounding_issues?: string;
  citations?: string[];
};

const SUGGESTIONS = [
  "What is our current EAL?",
  "Which BU has the highest risk?",
  "Impact of fixing CVE-2023-44487?",
];

export default function NLChatInterface() {
  const [query, setQuery] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "m1",
      role: "assistant",
      content: "Hello. I am the CRQ AI assistant. You can ask me about your current risk posture, expected annual loss, and specific vulnerabilities.",
      grounded: true,
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isLoading) return;

    const userMsg = query;
    setQuery("");
    setMessages(prev => [...prev, { id: Date.now().toString(), role: "user", content: userMsg }]);
    setIsLoading(true);

    askQuery(userMsg)
      .then((res) => {
        // Grounded = backend returned real context data from EAL snapshots
        const isGrounded = res.context && Object.keys(res.context).length > 0;
        const responseMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: res.answer,
          grounded: isGrounded,
          grounding_issues: isGrounded
            ? undefined
            : "Response could not be fully verified against EAL snapshot data.",
        };
        setMessages(prev => [...prev, responseMsg]);
      })
      .catch((err: Error) => {
        setMessages(prev => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: "I was unable to process your query. Please check that the CRQ backend is running.",
            grounded: false,
            grounding_issues: err.message,
          },
        ]);
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  const handleCitationClick = (ref: string) => {
    alert(CITATIONS[ref] || "Source data not found.");
  };

  // Extract text and citations from content
  const renderContent = (content: string) => {
    const parts = content.split(/(\[c\d+\])/g);
    return parts.map((part, i) => {
      if (part.match(/\[c\d+\]/)) {
        const ref = part.replace(/[\[\]]/g, "");
        return (
          <button 
            key={i} 
            onClick={() => handleCitationClick(ref)}
            className="inline-flex items-center justify-center bg-blue-100 text-brand-600 text-[9px] font-bold px-1.5 py-0.5 rounded cursor-pointer hover:bg-blue-200 align-text-top mx-1 border border-blue-200"
            title="Click to view source"
          >
            {ref.toUpperCase()}
          </button>
        );
      }
      // Simple bold parsing
      const boldParts = part.split(/\*\*(.*?)\*\*/g);
      return boldParts.map((bp, j) => 
        j % 2 === 1 ? <strong key={`${i}-${j}`} className="text-navy">{bp}</strong> : bp
      );
    });
  };

  return (
    <div className="bg-surface border border-surfaceBorder rounded-lg shadow-card flex flex-col h-full min-h-[400px]">
      <div className="p-4 border-b border-surfaceBorder flex justify-between items-center bg-background rounded-t-lg">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-brand-500/10 text-brand-500 flex items-center justify-center">
            <Search className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-semibold text-navy text-[14px]">Ask CRQ</h3>
            <p className="text-[10px] text-muted">Natural language queries backed by real EAL data</p>
          </div>
        </div>
        <button 
          onClick={() => setHistoryOpen(!historyOpen)}
          className="text-muted hover:text-navy p-2 rounded transition-colors"
          title="Toggle History"
        >
          <History className="w-4 h-4" />
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col h-full min-h-[350px]">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-lg p-3 ${
                  msg.role === "user" 
                    ? "bg-brand-500 text-white shadow-sm" 
                    : "bg-background border border-surfaceBorder text-navy text-[13px] leading-relaxed"
                }`}>
                  {msg.role === "user" ? (
                    <div className="text-[13px]">{msg.content}</div>
                  ) : (
                    <div>
                      <div>{renderContent(msg.content)}</div>
                      
                      {/* Grounding Indicator for Assistant */}
                      <div className="mt-3 pt-2 border-t border-surfaceBorder flex items-start gap-2">
                        {msg.grounded ? (
                          <div className="flex items-center text-[10px] text-riskLow font-medium bg-riskLow/10 px-2 py-1 rounded border border-riskLow/20">
                            <ShieldCheck className="w-3 h-3 mr-1" /> Grounded in CRQ Data
                          </div>
                        ) : (
                          <div className="flex flex-col text-[10px] text-riskHigh font-medium bg-riskHigh/10 px-2 py-1.5 rounded border border-riskHigh/20 w-full">
                            <div className="flex items-center mb-1">
                              <AlertTriangle className="w-3 h-3 mr-1" /> Unverified Claim
                            </div>
                            <span className="text-muted text-[9px] font-normal leading-tight">{msg.grounding_issues}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-background border border-surfaceBorder rounded-lg p-3 text-muted text-xs flex gap-1">
                  <span className="animate-bounce">●</span><span className="animate-bounce delay-100">●</span><span className="animate-bounce delay-200">●</span>
                </div>
              </div>
            )}
          </div>

          <div className="p-3 border-t border-surfaceBorder bg-white rounded-b-lg">
            <div className="flex flex-wrap gap-2 mb-3">
              {SUGGESTIONS.map((sug, i) => (
                <button
                  key={i}
                  onClick={() => setQuery(sug)}
                  className="text-[10px] bg-background text-muted border border-surfaceBorder rounded-full px-3 py-1 hover:bg-brand-500 hover:text-white hover:border-brand-500 transition-colors"
                >
                  {sug}
                </button>
              ))}
            </div>
            <form onSubmit={handleSubmit} className="flex gap-2 relative">
              <input 
                type="text" 
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask about risk exposure, compliance, or specific assets..."
                className="w-full bg-background border border-surfaceBorder rounded-md pl-4 pr-10 py-2.5 text-sm text-navy focus:outline-none focus:border-brand-500 placeholder:text-muted/60 transition-colors"
              />
              <button 
                type="submit" 
                disabled={!query.trim() || isLoading}
                className="absolute right-1 top-1 bottom-1 bg-brand-500 text-white px-3 rounded flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:bg-brand-600 transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>

        {/* Query History Sidebar */}
        {historyOpen && (
          <div className="w-64 border-l border-surfaceBorder bg-background/50 flex flex-col">
            <div className="p-3 border-b border-surfaceBorder font-semibold text-navy text-xs uppercase tracking-wider">
              Recent Queries
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {messages.filter(m => m.role === "user").length === 0 ? (
                <div className="text-[11px] text-muted text-center p-4">No recent queries</div>
              ) : (
                messages.filter(m => m.role === "user").map(m => (
                  <button 
                    key={m.id}
                    onClick={() => setQuery(m.content)}
                    className="w-full text-left text-[11px] text-navy hover:bg-surface border border-transparent hover:border-surfaceBorder p-2 rounded truncate transition-colors"
                  >
                    <MessageSquare className="w-3 h-3 inline mr-1.5 text-muted" />
                    {m.content}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
