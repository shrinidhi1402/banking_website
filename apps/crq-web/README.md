# crq-web

Standalone CRQ analyst console — Next.js 14 + React 18 + Tailwind. It renders the
same risk data as the bank site's **CRQ Dashboard** tab, plus a dedicated
"Report finding" page.

**Optional.** The end-to-end demo runs entirely through the bank site
(`apps/bank-web`); this app is a separate, fuller UI onto the same `crq-api`.

## Why it's not an npm workspace

Its React 18 / Next 14 `@types/react` collide with `bank-web`'s React 19 when npm
hoists them (`next build` fails with *"Shield cannot be used as a JSX
component"*). So it keeps its own `node_modules`:

```bash
# from the repo root
npm run install:crq-web
npm run dev:crq-web        # http://localhost:3000
npm run build:crq-web
```

(These proxy to `npm --prefix apps/crq-web …`.)

## Backend connection

`next.config.mjs` rewrites `/api/backend/*` → `http://127.0.0.1:8000/api/v1/*`,
so `crq-api` must be running on `:8000`. No env file is required for local use.

## Pages

| Route | |
|---|---|
| `/` | executive dashboard — EAL card, contributors, trend, investment curve, NL chat |
| `/report-finding` | manual `vuln.detected` submission form |

Some panels (budget optimizer, BU donut, compliance) are still mock-backed and
labelled **Mocked** in the UI — see `walkthrough.md`.
