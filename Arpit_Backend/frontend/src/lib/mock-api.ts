/**
 * MOCK API Client — Fallback for Phase B3/B4 endpoints.
 * 
 * Replace with real calls to POST /api/v1/optimize and POST /api/v1/query
 * once B3.2 and B4.2 land in the backend.
 */

// Contract for B3.2 Optimizer
export interface OptimizerRequest {
  budget: number;
}

export interface OptimizerResponse {
  selected_actions: Array<{
    id: string;
    description: string;
    cost: number;
    eal_reduction: number;
    rosi: number; // Return on Security Investment
  }>;
  total_cost: number;
  total_eal_reduction: number;
  curve_data: Array<{
    budget: number;
    residual_eal: number;
    reduction: number;
  }>;
}

export async function optimizeBudgetMock(req: OptimizerRequest): Promise<OptimizerResponse> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 800));

  return {
    selected_actions: [
      {
        id: "act-1",
        description: "Patch Core Banking DB (CVE-2024-3094)",
        cost: 200000,
        eal_reduction: 4500000,
        rosi: 21.5,
      },
      {
        id: "act-2",
        description: "Enforce MFA on VPN Gateway",
        cost: 500000,
        eal_reduction: 8200000,
        rosi: 15.4,
      },
      {
        id: "act-3",
        description: "Upgrade SWIFT Node Firewall",
        cost: 300000,
        eal_reduction: 1200000,
        rosi: 3.0,
      }
    ],
    total_cost: 1000000,
    total_eal_reduction: 13900000,
    // Pareto frontier curve
    curve_data: [
      { budget: 0, residual_eal: 42000000, reduction: 0 },
      { budget: 500000, residual_eal: 32000000, reduction: 10000000 },
      { budget: 1000000, residual_eal: 28100000, reduction: 13900000 },
      { budget: 2000000, residual_eal: 25000000, reduction: 17000000 },
      { budget: 5000000, residual_eal: 22000000, reduction: 20000000 },
    ],
  };
}

// Contract for B4.2 NL Query
export interface QueryRequest {
  query: string;
  context?: Record<string, any>;
}

export interface QueryResponse {
  answer: string;
  grounded: boolean;
  citations: Array<{
    type: "asset" | "vuln" | "metric";
    id: string;
    label: string;
  }>;
  // If the query was matched to an intent like optimization, return the structured data too
  structured_data?: OptimizerResponse; 
}

export async function queryNlMock(req: QueryRequest): Promise<QueryResponse> {
  await new Promise((resolve) => setTimeout(resolve, 1200));

  const lowerQuery = req.query.toLowerCase();

  // Handle the specific ₹10 lakh budget query requested in prompt
  if (lowerQuery.includes("10 lakh") || lowerQuery.includes("budget") || lowerQuery.includes("1000000")) {
    const optData = await optimizeBudgetMock({ budget: 1000000 });
    return {
      answer: "Based on a ₹10 Lakh budget, the budget optimizer recommends 3 actions that maximize your risk reduction. Implementing these will reduce your Expected Annual Loss (EAL) by ₹1.39 Cr.",
      grounded: true,
      citations: [
        { type: "metric", id: "eal-reduction", label: "₹1.39 Cr EAL Reduction" },
        { type: "vuln", id: "CVE-2024-3094", label: "Core Banking DB" }
      ],
      structured_data: optData,
    };
  }

  // Generic fallback response
  return {
    answer: "Our top risk drivers are currently concentrated in the Core Banking DB Cluster and the public VPN Gateway. Patching these will significantly reduce portfolio EAL.",
    grounded: true,
    citations: [
      { type: "asset", id: "db-cluster", label: "Core Banking DB Cluster" },
      { type: "asset", id: "vpn-gw", label: "VPN Gateway" }
    ]
  };
}
