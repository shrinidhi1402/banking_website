import VulnerabilityReportForm from "@/components/analyst/VulnerabilityReportForm";
import { ShieldAlert } from "lucide-react";

export default function ReportFindingPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3 border-b border-surfaceBorder pb-4 mb-6">
        <div className="p-2 bg-riskCritical/10 text-riskCritical rounded-lg">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-3xl font-serif text-navy tracking-tight font-medium">Manual Finding Entry</h1>
          <p className="text-muted text-sm mt-1">
            Record a real vulnerability or threat intelligence finding into the CRQ system.
          </p>
        </div>
      </div>

      <div className="bg-background border border-brand-500/20 rounded-lg p-4 mb-8 text-sm text-navy">
        <strong className="text-brand-500 font-semibold">Note:</strong> Findings submitted here bypass automated scanners and are injected directly into the Redpanda event bus as <code className="text-navy bg-surface border border-surfaceBorder px-1.5 py-0.5 rounded text-xs mx-1">vuln.detected</code> events. The risk engine will evaluate them immediately.
      </div>

      <VulnerabilityReportForm />
    </div>
  );
}
