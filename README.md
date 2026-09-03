# 0xAxiom Banking + CRQ Monorepo

A demo retail-banking web app with deliberately toggle-able vulnerabilities, wired
to a **CyberRisk Quantifier (CRQ)** platform that turns those security events into
monetary risk — Expected Annual Loss (EAL) — using FAIR + Monte Carlo.

Flip a vulnerability in the bank site → the CRQ dashboard's risk numbers move,
live, over a WebSocket.

---

## 1. Repo layout

```
apps/
  bank-web/      React 19 + Vite — the bank site (has the CRQ Dashboard tab)   :5173
  bank-api/      Express — bank auth + data + Bug Lab toggle endpoints          :3001
  crq-api/       FastAPI — the CRQ risk engine (FAIR, Monte Carlo, AI gateway)  :8000
  crq-web/       Next.js — standalone CRQ analyst console (optional)            :3000
db/
  bank/          bank site SQL schema (reference)
  crq/           CRQ schema + seed SQL (reference — already applied to the shared project)
infra/           Prometheus / Grafana / Loki / Tempo configs (used by compose)
packages/
  ai-knowledge/  RAG knowledge base for the CRQ AI assistant
scripts/archive/ one-off historical scripts (not needed to run anything)
docs/            deeper guides
docker-compose.dev.yml + Makefile   → the CRQ Docker stack
```

- `bank-web` + `bank-api` are npm workspaces (installed from the repo root).
- `crq-web` is **not** a workspace (its React 18 types clash with bank-web's
  React 19) — install it separately with `npm run install:crq-web`.
- `crq-api` is Python and runs in Docker (or natively with `uv`).

---

## 2. Prerequisites

| Tool | Version | Needed for |
|---|---|---|
| Node.js | ≥ 18 (20+ recommended) | bank-web, bank-api, crq-web |
| Docker Desktop | current | crq-api + Redis + observability |
| A Supabase project | free tier is fine | database + auth for both bank and CRQ |
| Python 3.12 + [uv](https://docs.astral.sh/uv/) | optional | running crq-api without Docker |

Everything talks to **one Supabase Postgres**. The bank tables (`users`,
`accounts`, …) and the CRQ tables (`crq_*`) live side by side in it. That
project is already provisioned and seeded — you only need the env files below.

---

## 3. First-time setup

### 3.1 Clone + install JS deps

```bash
git clone <this-repo> banking_website
cd banking_website
npm install                 # bank-web + bank-api
npm run install:crq-web     # only if you want the standalone CRQ console
```

### 3.2 Environment files

**`apps/crq-api/.env`** — copy from `apps/crq-api/.env.example`, then set:

```env
CRQ_SUPABASE_URL=postgresql+asyncpg://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
CRQ_SUPABASE_SERVICE_KEY=<anon or service key>
CRQ_SUPABASE_JWT_SECRET=<project JWT secret>
CRQ_GROQ_API_KEY=<free key from console.groq.com>   # powers the AI assistant
CRQ_DISABLE_AUTH=true
```

**`apps/bank-api/.env`** — copy from `apps/bank-api/.env.example`, then set:

```env
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_ANON_KEY=<anon public key — Supabase → Project Settings → API>
SUPABASE_SERVICE_ROLE_KEY=<service_role key — same page>
OTP_SECRET=<any random string ≥ 16 chars>
EMAILJS_SERVICE_ID=...        # from your EmailJS account; sends the login OTP
EMAILJS_TEMPLATE_ID=...
EMAILJS_PUBLIC_KEY=...
EMAILJS_PRIVATE_KEY=...
CRQ_BASE_URL=http://localhost:8000     # already defaulted
CRQ_ORG_ID=1
```

**`apps/bank-web/.env`** — optional; only if CRQ isn't on localhost:

```env
VITE_CRQ_API=http://localhost:8000/api/v1
VITE_CRQ_ORG_ID=1
```

---

## 4. Run it

Three terminals from the repo root:

```bash
# 1. CRQ engine + Redis + Grafana/Prometheus/Loki/Tempo
docker compose -f docker-compose.dev.yml up -d --build      # = npm run crq:up

# 2. bank API
npm run dev:bank-api        # http://localhost:3001

# 3. bank site
npm run dev:bank-web        # http://localhost:5173
```

Optional standalone CRQ console: `npm run dev:crq-web` → http://localhost:3000

### Health check before you click around

```bash
curl http://localhost:8000/health
#   {"healthy":true,"checks":{"postgres":{"status":"ok"},"redis":{"status":"ok"}}}

curl "http://localhost:8000/api/v1/risk/summary?scope=org"
#   {"scope":"org","eal":42000000.0, ...}

curl "http://localhost:8000/api/v1/risk/contributors?top=3"
#   3 seeded assets with real % + ₹ contributions
```

---

## 5. Test the integration end to end

Log in to `http://localhost:5173` as a **Manager**
(demo account emails + passwords are listed in `apps/bank-api/scripts/seed.js`).

### Scenario A — the dashboard shows live data

Open **CRQ Dashboard** (Manager nav). You should see:

- **Portfolio Expected Annual Loss** with real 95%/99% VaR, model version,
  "Computed …", and a P10/P50/P90 distribution bar (all from the DB, not hardcoded).
- **Top risk contributors** — the 3 seeded assets, ranked, with real % and ₹.
- **● LIVE** badge if the WebSocket connected.

### Scenario B — submit a manual finding

In the **Report security finding** form:

| Field | Value |
|---|---|
| Affected asset / system | `Core Banking Database` |
| Detection source | Penetration test |
| Finding title | `Unauthenticated SQL injection in statement export` |
| CVE ID | `CVE-2024-38001` |
| CVSS base score | `9.4` |
| Technical description | `account_id query param is concatenated into SQL; UNION payload returned 500 customer records in a controlled test.` |
| Remediation recommendation | `Parameterise the query, add an allowlist validator, deploy a WAF rule, rotate exposed credentials.` |

Submit → within ~2 s: success message, a **"Live recompute"** banner with the new
EAL + Δ%, the **"Most recent asset recompute"** panel updates, and the assistant
thread gets a system line. The first submission trips the 20% threshold, so the
banner is red ("threshold breach").

### Scenario C — Bug Lab toggle drives risk

Open two tabs as Manager: **CRQ Dashboard** and **Security** (or **Bug Lab**).

| Toggle in the Security/Bug Lab tab | CRQ Dashboard reacts (no refresh) |
|---|---|
| **MFA Bypass → ON** | Portfolio EAL headline changes, red live-recompute banner, chat system line |
| **SQL Injection → ON** | a `BANK-SQLI-001 – …` row appears in **Top risk contributors**; EAL rises |
| **IDOR → ON** | another contributor row; EAL rises |
| any of them **→ OFF** | the contributor row disappears; EAL drops back |

### Prove the numbers are real (not cached/hardcoded)

- **bank-api console** logs `[CRQ] control.disabled → received (event <uuid>)` on each toggle.
- **DevTools → Network → WS** (`ws://localhost:8000/ws/updates`) on the dashboard —
  every recompute frame carries `new_eal`, `org_eal`, `previous_eal`, `delta_pct`.
- **Supabase → Table editor**, after one toggle or finding:
  - `crq_ingested_events` — +1 row (your payload, `processing_status = processed`),
  - `crq_eal_snapshots` — +2 rows: one `scope = asset`, one `scope = org`
    (`calculation_version = 1.0-rollup`); `source_event_ids` holds the event UUID,
  - `crq_vulnerabilities` — gains/loses `BANK-…` rows as you toggle SQLI/IDOR.
- **Idempotency:** re-POST an event with a fixed `event_id` via curl → second call
  returns `"status":"duplicate"` and writes no new snapshot.

### Ask the AI assistant

Needs `CRQ_GROQ_API_KEY`. Start with `what is our biggest risk right now?`; if that
answers, try the harder prompts in `docs/`.

---

## 6. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Dashboard: "Cannot reach the CRQ service…" | `crq-api` not up, or you didn't rebuild it after pulling. `curl http://localhost:8000/health`. |
| Form / toggle → 500 on `/events` | `crq-api` container is running stale code — `docker compose -f docker-compose.dev.yml up -d --build crq-api crq-worker`. |
| `POST /events` conflict on container name (`/crq-redis` in use) | `docker compose -f docker-compose.dev.yml down` then `up` again. |
| bank-api won't start, `ZodError` on `SUPABASE_URL` etc. | `apps/bank-api/.env` missing or in the wrong folder (Notepad adds `.txt`). |
| Portfolio EAL stuck at ₹4.2 Cr | expected until the first event fires — then it switches to the live rollup. |
| Toggle changes nothing in CRQ | `CRQ_BASE_URL` missing from `apps/bank-api/.env`, or crq-api down. Check the bank-api console for `[CRQ]` lines. |
| "● OFFLINE" badge | WebSocket blocked — reads still work, only live auto-refresh is lost. |
| `crq-web` build fails with "Shield cannot be used as a JSX component" | you added it to root `workspaces`. It must stay isolated — `npm run install:crq-web`. |

Logs: `docker compose -f docker-compose.dev.yml logs -f crq-api`

---

## 7. More docs

- `docs/crq-platform-setup.md` — CRQ stack, Docker vs native, observability URLs
- `docs/security-vuln-integration.md` — every Bug Lab vulnerability, how to exploit + verify each
- `apps/*/README.md` — per-app specifics
- `packages/ai-knowledge/README.md` — the RAG knowledge base
