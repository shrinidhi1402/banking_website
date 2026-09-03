import EALCard from "@/components/executive/EALCard";
import RiskContributorsTable from "@/components/executive/RiskContributorsTable";
import RiskTrendChart from "@/components/executive/RiskTrendChart";
import InvestmentCurve from "@/components/executive/InvestmentCurve";
import NLChatInterface from "@/components/executive/NLChatInterface";
import BUDonutChart from "@/components/executive/BUDonutChart";
import RiskReductionOpportunities from "@/components/executive/RiskReductionOpportunities";
import CompliancePlaceholder from "@/components/executive/CompliancePlaceholder";

export default function ExecutiveDashboard() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-serif text-navy tracking-tight font-medium">Executive Dashboard</h1>
          <p className="text-muted text-sm mt-1">Real-time quantification of cyber risk into financial loss exposure.</p>
        </div>
      </div>

      {/* Top Row: NL Search & EAL Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <NLChatInterface />
        </div>
        <div className="lg:col-span-1 flex flex-col gap-6">
          <EALCard />
          <CompliancePlaceholder />
        </div>
      </div>

      {/* Second Row: Charts & BU Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RiskTrendChart />
        </div>
        <div className="lg:col-span-1">
          <BUDonutChart />
        </div>
      </div>

      {/* Third Row: Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RiskContributorsTable />
        <RiskReductionOpportunities />
      </div>

      {/* Bottom: Investment Curve */}
      <div>
        <InvestmentCurve />
      </div>
    </div>
  );
}
