# crq-api

FastAPI service for the CyberRisk Quantifier — converts security events into
Expected Annual Loss (EAL) via FAIR + a 10,000-iteration Monte Carlo, exposes a
risk API + WebSocket, and runs the AI assistant (RAG over `packages/ai-knowledge`).

Part of the monorepo — see the [root README](../../README.md) for the full
setup + end-to-end test. The shared Supabase project is already provisioned.

## Run (Docker — recommended)

From the repo root:

```bash
docker compose -f docker-compose.dev.yml up -d --build      # = npm run crq:up
```

| Service | URL |
|---|---|
| CRQ API | http://localhost:8000 |
| API docs (Swagger) | http://localhost:8000/docs |
| Health | http://localhost:8000/health |
| Grafana | http://localhost:3002 (admin / admin123) |
| Prometheus | http://localhost:9090 |
| Redis | localhost:6379 |

After editing anything under `src/`, rebuild so the container picks it up:

```bash
docker compose -f docker-compose.dev.yml up -d --build crq-api crq-worker
```

Logs: `docker compose -f docker-compose.dev.yml logs -f crq-api`

## Run (native, no Docker)

Requires Python 3.12 + [uv](https://docs.astral.sh/uv/):

```bash
cd apps/crq-api
uv venv .venv && source .venv/bin/activate     # Windows: .venv\Scripts\activate
uv pip install -e ".[dev]"
cp .env.example .env                            # then fill it (see below)
uvicorn crq.main:app --reload --port 8000
```

Native mode can't reach the Docker `redis` hostname — set
`CRQ_REDIS_URL=redis://localhost:6379/0` (and the two Celery URLs) in `.env`.

## Env (`apps/crq-api/.env`)

`CRQ_`-prefixed, read by `src/crq/core/config.py`.

| Key | Notes |
|---|---|
| `CRQ_SUPABASE_URL` | `postgresql+asyncpg://postgres.<ref>:<pw>@aws-0-<region>.pooler.supabase.com:5432/postgres` — URL-encode the password |
| `CRQ_SUPABASE_SERVICE_KEY` | project API key |
| `CRQ_SUPABASE_JWT_SECRET` | project JWT secret (used when auth is on) |
| `CRQ_GROQ_API_KEY` | free key from console.groq.com — powers `/api/v1/query` |
| `CRQ_DISABLE_AUTH` | `true` in dev — every request runs as a dev admin, no token needed |
| `CRQ_REDIS_URL` / `CRQ_CELERY_*` | `redis://redis:6379/*` in Docker, `redis://localhost:6379/*` native |

## Key endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/risk/summary?scope=org\|asset` | latest EAL snapshot for a scope |
| GET | `/api/v1/risk/contributors?top=N` | ranked assets + vulnerabilities |
| GET | `/api/v1/risk/history?scope=org` | EAL snapshots over time |
| GET | `/api/v1/vulnerabilities` | vulnerability backlog |
| POST | `/api/v1/events` | ingest a `control.*` / `vuln.*` event (idempotent on `event_id`) |
| POST | `/api/v1/query` | natural-language question → grounded answer |
| WS | `/ws/updates?org_id=1` | live `eal.updated` / `risk.alert` pushes |

## Event pipeline (`src/crq/ingestion/pipeline.py`)

`POST /api/v1/events` runs synchronously:

- **`control.disabled`** (e.g. bank site turns MFA bypass ON) → drops that
  control's effectiveness for the asset → recompute. `control.enabled` restores it.
- **`vuln.detected`** → upserts a `crq_vulnerabilities` row + asset link (so it
  appears in `/risk/contributors`) → recompute at higher exposure.
  `vuln.resolved` deletes the row and recomputes lower.
- Every recompute writes a per-asset EAL snapshot **and** an org-scope rollup
  snapshot (sum of the latest per-asset EAL), then broadcasts the new figures
  over the WebSocket. A ±20% swing is flagged as `risk.alert`.

## Tests

```bash
cd apps/crq-api
pytest tests/ -m "unit or property" -v      # no external deps
```

## Layout

```
src/crq/
  main.py            FastAPI app factory + /health
  core/              config, async DB engine, logging, telemetry, middleware
  api/v1/            routers: risk, vulnerabilities, events, query, scenarios, …
  api/ws.py          WebSocket /ws/updates
  ingestion/         event pipeline + scanner connectors
  risk_engine/       FAIR + Monte Carlo (fair.py, monte_carlo.py)
  ai_gateway/        LLM client + RAG pipeline + prompts
  query_engine/      NL → structured query translation + retrieval
  optimizer/ scenario/ compliance/ threat_intel/ control_eval/ asset_criticality/
  notifications/     ws_manager, webhooks
  models/ schemas/   SQLAlchemy models + Pydantic DTOs
  workers/           Celery tasks
Dockerfile           multi-stage, non-root (uid 1001)
```
