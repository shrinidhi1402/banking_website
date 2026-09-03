# bank-web

The 0xAxiom demo bank site — React 19 + Vite. Part of the monorepo; see the
[root README](../../README.md) for full setup and the end-to-end test walkthrough.

## Run

```bash
# from the repo root
npm install
npm run dev:bank-web        # http://localhost:5173
```

Needs `bank-api` running on `:3001` (login/data) and, for the CRQ Dashboard tab,
`crq-api` on `:8000`.

## Env (`apps/bank-web/.env`, optional)

```env
VITE_CRQ_API=http://localhost:8000/api/v1   # default
VITE_CRQ_ORG_ID=1                            # default
```

Only needed if the CRQ engine isn't on localhost. Supabase auth config is read by
`bank-api`, not here.

## What's where

| Path | |
|---|---|
| `src/App.jsx` | the whole app — login, role dashboards, nav |
| `src/CRQDashboard.jsx` | the **CRQ Dashboard** tab (Manager only): live risk summary, contributors, EAL history, "Report security finding" form, AI assistant. Talks directly to `crq-api` on `:8000` + a WebSocket to `/ws/updates`. |
| `src/buglabSecret.js` | client-side artefact for the secret-exposure vulnerability demo |

The **Security** / **Bug Lab** panels (Manager) toggle backend vulnerability
flags; each toggle makes `bank-api` emit an event to CRQ and the CRQ Dashboard
updates live. See root README §5, Scenario C.

## Build

```bash
npm run build:bank-web      # → apps/bank-web/dist
```
