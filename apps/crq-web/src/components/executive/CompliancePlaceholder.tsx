"use client";

import { ShieldCheck, Clock } from "lucide-react";

export default function CompliancePlaceholder() {
  return (
    <div className="bg-surface border border-surfaceBorder rounded-lg p-5 shadow-card flex flex-col h-full items-center justify-center text-center relative overflow-hidden">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #17243b 1px, transparent 0)', backgroundSize: '16px 16px' }}></div>
      
      <div className="bg-background rounded-full p-4 mb-4 relative z-10 border border-surfaceBorder">
        <ShieldCheck className="w-8 h-8 text-muted" />
        <div className="absolute -bottom-1 -right-1 bg-brand-500 text-white rounded-full p-1 shadow-md">
          <Clock className="w-3 h-3" />
        </div>
      </div>
      
      <h3 className="text-navy font-serif font-medium text-[17px] mb-2 relative z-10">Compliance Frameworks</h3>
      <p className="text-[11px] text-muted max-w-[200px] mb-5 relative z-10">
        Automated mapping of IT assets and vulnerabilities to ISO 27001, SOC2, and RBI guidelines.
      </p>
      
      <span className="inline-flex items-center gap-1.5 bg-brand-500/10 text-brand-500 text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full border border-brand-500/20 relative z-10">
        Coming Soon
      </span>
    </div>
  );
}
