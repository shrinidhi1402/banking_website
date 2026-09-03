# bank-api

Express API for the bank site — Supabase Auth for sessions, existing Supabase
tables for data, plus the **Bug Lab** vulnerability endpoints. Part of the
monorepo; see the [root README](../../README.md) for full setup.

## Run

```bash
# from the repo root
npm install
npm run dev:bank-api        # http://localhost:3001  (node --watch)
```

## Env (`apps/bank-api/.env`)

Copy `.env.example` and fill it. Validated by `src/config/env.js` — the server
refuses to start if any required key is missing.

| Key | Notes |
|---|---|
| `PORT` | default `3001` |
| `CORS_ORIGIN` | default `http://localhost:5173` |
| `SUPABASE_URL` | `https://<ref>.supabase.co` (REST form, not `postgres://`) |
| `SUPABASE_ANON_KEY` | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | same page; **server-only**, bypasses RLS |
| `OTP_SECRET` | any random string ≥ 16 chars (HMAC key for login OTP) |
| `EMAILJS_*` | 4 keys from your EmailJS account; sends the OTP email |
| `CRQ_BASE_URL` | default `http://localhost:8000` — where Bug Lab events are sent |
| `CRQ_ORG_ID` | default `1` — the `crq_organizations.id` to attribute events to |
| `SUPABASE_DB_URL` | optional; raw `postgres://` string, only for true SQLi in the bug lab |

## Database contract

Reads/writes the existing `users`, `customer_profiles`, `employee_profiles`,
`manager_profiles`, `accounts`, `beneficiaries`, `transactions`, `requests`,
`login_events`, `security_events`, `audit_logs` tables (`db/bank/schema.sql`).
`POST /api/customer/transfer` calls the atomic Postgres RPC `execute_transfer`
and returns `503` if it's absent rather than doing unsafe multi-step updates.

Roles come from `users.role` (`CUSTOMER` / `EMPLOYEE` / `MANAGER`) — never from
the browser.

## Bug Lab → CRQ

`POST /api/bugs/toggle` flips an in-memory vulnerability flag **and** emits a CRQ
event via `src/services/crqClient.js`:

| Flag | CRQ event (enable / disable) | Target CRQ asset |
|---|---|---|
| `BUG_MFA` | `control.disabled` / `control.enabled` | Customer Banking Web App |
| `BUG_SQLI` | `vuln.detected` / `vuln.resolved` | Core Banking Database |
| `BUG_IDOR` | `vuln.detected` / `vuln.resolved` | Customer Banking Web App |
| `BUG_EXCESSIVE_PRIVILEGES` | `vuln.detected` / `vuln.resolved` | Internal Employee Portal |
| `BUG_SECRET_EXPOSURE` | `vuln.detected` / `vuln.resolved` | Customer Banking Web App |
| `BUG_SUPPLY_CHAIN_COMPROMISE` | `vuln.detected` / `vuln.resolved` | Core Banking Database |
| `BUG_PAM_JUMP_SERVER` | `vuln.detected` / `vuln.resolved` | Internal Employee Portal |

The mapping (asset name, CVE id, CVSS) lives in `CRQ_FLAG_MAP` in
`src/controllers/bugController.js`. Emission is fire-and-forget — CRQ being down
never breaks a banking request; look for `[CRQ] …` lines in the console.

Flags reset to their `flags.json` defaults on restart. Full per-vulnerability
walkthrough: `docs/security-vuln-integration.md`.

## Lint

```bash
npm run lint -w apps/bank-api
```
