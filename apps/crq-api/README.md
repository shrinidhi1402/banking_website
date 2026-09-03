# CRQ Backend

FastAPI backend for CyberRisk Quantifier (CRQ) — Phase B0 Foundation.

## Quick Start

### 1. Start the full dev stack

```bash
# From repo root (0xAxiom/)
docker compose -f docker-compose.dev.yml up -d

# Or use Make:
make up
```

Services started:
| Service | URL |
|---|---|
| CRQ API | http://localhost:8000 |
| API Docs | http://localhost:8000/docs |
| Keycloak | http://localhost:8080 |
| MinIO Console | http://localhost:9001 |
| Redpanda Console | http://localhost:8085 |
| Prometheus | http://localhost:9090 |
| Grafana | http://localhost:3002 (admin/admin123) |
| GlitchTip | http://localhost:8090 |

### 2. Run database migrations

```bash
# Inside container (after stack is up):
docker compose -f docker-compose.dev.yml exec crq-api alembic upgrade head

# Or via Make:
make migrate

# Locally (direct DB):
cd backend
CRQ_DATABASE_URL_DIRECT=postgresql+asyncpg://crq_app:crq_app_password@localhost:5433/crq alembic upgrade head
```

### 3. Run the API locally (without Docker)

```bash
cd backend

# Install deps (requires Python 3.12 + uv)
uv venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
uv pip install -e ".[dev]"

# Copy env file
cp .env.example .env   # Edit as needed

# Start server
uvicorn crq.main:app --reload --port 8000
```

### 4. Run tests

```bash
# Unit + property tests only (no docker required):
cd backend
pytest tests/ -m "unit or property" -v

# All tests including integration (requires docker stack):
pytest tests/ -v

# Via Make (inside container):
make test
```

### 5. Check pgvector + TimescaleDB extensions

```bash
make check-extensions
# or:
docker compose -f docker-compose.dev.yml exec postgres psql -U postgres -d crq -c "\dx"
```

Expected output includes `timescaledb` and `vector`.

---

## DISABLE_AUTH Dev Flag

**All auth is disabled by default** (`CRQ_DISABLE_AUTH=true`).

When disabled, every request returns a fake `admin` dev user:
```json
{"sub": "dev-user-...", "email": "dev@crq.local", "role": "admin"}
```

This means teammates can write and test any endpoint **without needing Keycloak running**.

### To enable real Keycloak auth:

1. Ensure Keycloak is healthy: `docker compose -f docker-compose.dev.yml up keycloak`
2. Set in `.env`: `CRQ_DISABLE_AUTH=false`
3. Get a token:
   ```bash
   curl -X POST http://localhost:8080/realms/crq/protocol/openid-connect/token \
     -d "grant_type=password&client_id=crq-api&username=dev-admin&password=admin123&client_secret=change-me-in-production"
   ```
4. Use the `access_token` in requests: `Authorization: Bearer <token>`

---

## Folder Structure

```
backend/
├── src/crq/
│   ├── main.py            # FastAPI app entry point
│   ├── core/              # Config, DB, logging, telemetry, middleware
│   ├── api/v1/            # Thin FastAPI routers (stubs — filled in B1+)
│   ├── auth/              # Keycloak JWT + RBAC (B0.3)
│   ├── models/            # SQLAlchemy ORM models (B1.1+)
│   ├── schemas/           # Pydantic DTOs
│   ├── ingestion/         # Event ingestion + connectors (B2.1)
│   ├── risk_engine/       # FAIR + Monte Carlo (B1.3)
│   ├── optimizer/         # Knapsack + ROSI (B3.2)
│   ├── scenario/          # What-if simulator (B3.1)
│   ├── compliance/        # Framework mapping (B5.1)
│   ├── threat_intel/      # CISA KEV, NVD (B2.4)
│   ├── control_eval/      # Control effectiveness (B1.4)
│   ├── asset_criticality/ # Criticality modeling (B1.2)
│   ├── ai_gateway/        # LLM pipeline (B4)
│   ├── query_engine/      # NL query translation (B4.2)
│   ├── notifications/     # WebSocket + webhooks (B2.6)
│   ├── audit/             # Immutable audit log (B5.5)
│   └── workers/           # Celery tasks (B2.3+)
├── tests/
│   ├── unit/              # No external deps — always run
│   ├── integration/       # Requires docker-compose up
│   └── property/          # Hypothesis FAIR math invariants
├── alembic/               # DB migrations
├── Dockerfile             # Multi-stage, non-root (uid 1001)
└── pyproject.toml
```

## Tech Stack (Phase B0)

| Layer | Choice |
|---|---|
| Language | Python 3.12 |
| Framework | FastAPI + Pydantic v2 |
| ORM | SQLAlchemy 2.0 async |
| Migrations | Alembic |
| Database | PostgreSQL 16 + TimescaleDB + pgvector |
| Cache/Broker | Redis 7 |
| Event bus | Redpanda (Kafka API) |
| Object storage | MinIO |
| Auth | Keycloak (gated by DISABLE_AUTH) |
| Logging | structlog (JSON) |
| Metrics | prometheus-client |
| Tracing | OpenTelemetry → Tempo |
| Testing | pytest + pytest-asyncio + hypothesis |

See `architecture.md` §6 and §12 for the complete rationale.
