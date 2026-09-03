# 0xAxiom Banking + CRQ Monorepo

Two things live here: a **demo retail-banking web app** (with deliberately
toggle-able vulnerabilities for security training) and a **CyberRisk Quantifier
(CRQ) platform** that turns security telemetry into monetary risk (Expected
Annual Loss) using FAIR + Monte Carlo.

## Layout

```
apps/
  bank-web/      React + Vite bank site            → http://localhost:5173
  bank-api/      Express API for the bank site     → http://localhost:3001
  crq-api/       FastAPI CRQ engine (Python)       → http://localhost:8000
  crq-web/       Next.js CRQ analyst console       → http://localhost:3000
db/
  bank/          bank site SQL schema
  crq/           CRQ Supabase migrations (run in order: 001 → 004)
infra/           Prometheus / Grafana / Loki / Tempo configs
packages/
  ai-knowledge/  RAG knowledge base for the CRQ AI gateway
scripts/archive/ one-off migration/patch scripts kept for history
docs/            setup + feature guides
```

`docker-compose.dev.yml` and `Makefile` at the root drive the CRQ stack.

## Quick start

```bash
# 1. JS workspaces (bank-web, bank-api, crq-web)
npm install

# 2. CRQ engine + Redis + observability
docker compose -f docker-compose.dev.yml up -d --build     # npm run crq:up
#    then apply db/crq/001..004*.sql in the Supabase SQL editor

# 3. Bank app (two terminals)
npm run dev:bank-api      # :3001
npm run dev:bank-web      # :5173
```

Log in as a **Manager** → **CRQ Dashboard** tab. It reads live risk data from the
CRQ API and the "Report security finding" form posts real `vuln.detected` events
that trigger an EAL recompute.

Config for the bank site's CRQ tab lives in `apps/bank-web/.env`
(`VITE_CRQ_API`, `VITE_CRQ_ORG_ID`).

## More docs

- `docs/crq-platform-setup.md` — full CRQ stack setup
- `docs/security-vuln-integration.md` — the toggle-able bank vulnerabilities
- `apps/*/README.md` — per-app notes
