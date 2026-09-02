/**
 * Real API client connecting to backend endpoints built in Phase B0 and B2.
 */

const API_BASE = "/api/backend"; // Rewrites to 127.0.0.1:8000/api/v1 via next.config.mjs

export interface EventEnvelope {
  event_id: string;
  event_type: string;
  org_id: string;
  source: string;
  payload: Record<string, any>;
  timestamp?: string;
}

export async function submitEvent(envelope: EventEnvelope) {
  const res = await fetch(`${API_BASE}/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(envelope),
  });
  if (!res.ok) throw new Error("Failed to submit event");
  return res.json();
}

export async function getRiskSummary(scope = "org", scopeId?: string) {
  const url = new URL(`${API_BASE}/risk/summary`, window.location.origin);
  url.searchParams.append("scope", scope);
  if (scopeId) url.searchParams.append("id", scopeId);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error("Failed to fetch risk summary");
  return res.json();
}

export async function getRiskContributors(top = 10) {
  const res = await fetch(`${API_BASE}/risk/contributors?top=${top}`);
  if (!res.ok) throw new Error("Failed to fetch risk contributors");
  return res.json();
}

export async function getRiskHistory(scope = "org", scopeId?: string) {
  const url = new URL(`${API_BASE}/risk/history`, window.location.origin);
  url.searchParams.append("scope", scope);
  if (scopeId) url.searchParams.append("id", scopeId);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error("Failed to fetch risk history");
  return res.json();
}

export async function listVulnerabilities(sort = "eal_contribution", order = "desc") {
  const res = await fetch(`${API_BASE}/vulnerabilities?sort=${sort}&order=${order}&page_size=50`);
  if (!res.ok) throw new Error("Failed to list vulnerabilities");
  return res.json();
}
