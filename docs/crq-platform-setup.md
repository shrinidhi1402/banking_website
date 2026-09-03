# Northstar Banking CRQ - Full Stack Setup Guide

This guide explains how to set up the entire architecture: **React Frontend**, **FastAPI Backend**, **Celery Workers**, **Supabase DB**, and the **AI Gateway**.

## 🏗️ 1. Prerequisites
Ensure you have the following installed locally:
- **Node.js** (v18+)
- **Docker & Docker Compose** (for Redis, API, and Celery)
- **Supabase Account** (or a local Supabase CLI setup)
- **Python 3.11+** (if you wish to run the backend natively instead of Docker)

---

## 🗄️ 2. Database (Supabase)
The shared Supabase project already has every table and the demo seed data in
place — you don't need to touch the database to run or test the stack.

The SQL that defines it lives in `db/crq/` (schema, indexes, seed) and
`db/bank/schema.sql`, kept for reference only.

---

## ⚙️ 3. Environment Variables
You need to configure both the Frontend and the Backend to point to your Supabase instance.

### CRQ API (`apps/crq-api/.env`)
Create a `.env` file in the `apps/crq-api` folder.
```env
SUPABASE_URL=https://<YOUR_REF>.supabase.co
SUPABASE_KEY=<YOUR_SERVICE_ROLE_KEY>
SUPABASE_JWT_SECRET=<YOUR_JWT_SECRET>

# Redis for Celery
CRQ_REDIS_URL=redis://redis:6379/0
CRQ_CELERY_BROKER_URL=redis://redis:6379/1
CRQ_CELERY_RESULT_BACKEND=redis://redis:6379/2

# AI Models (Using Groq for Free LLM Hosting)
VLLM_BASE_URL=https://api.groq.com/openai/v1
LLM_MODEL=llama3-8b-8192
GROQ_API_KEY=<YOUR_FREE_GROQ_KEY>

# Observability
CRQ_ENV=development
CRQ_DISABLE_AUTH=true 
```

### Bank web app (`apps/bank-web/.env`)
Create a `.env` file in `apps/bank-web/`.
```env
VITE_SUPABASE_URL=https://<YOUR_REF>.supabase.co
VITE_SUPABASE_ANON_KEY=<YOUR_ANON_KEY>
# Point the CRQ Dashboard tab at the CRQ API (defaults shown)
VITE_CRQ_API=http://localhost:8000/api/v1
VITE_CRQ_ORG_ID=1
```

---

## 🚀 4. Running the CRQ platform (Docker)
The easiest way to start the FastAPI server, Celery worker, Redis, and the
observability stack (Grafana/Prometheus) is Docker Compose.

From the repo root:
```bash
docker compose -f docker-compose.dev.yml up --build -d
# or: npm run crq:up
```
* **FastAPI CRQ Engine** — `http://localhost:8000`
* **Grafana Dashboards** — `http://localhost:3002` (admin / admin123)
* **Redis** — `localhost:6379`

---

## 💻 5. Running the bank app (React/Vite)
From the repo root:
```bash
npm install                 # installs all workspaces
npm run dev:bank-web        # bank site on http://localhost:5173
npm run dev:bank-api        # bank API on http://localhost:3001 (separate terminal)
```
The CRQ Dashboard tab (Manager login) talks directly to the CRQ API on `:8000`.

---

## 🧪 6. How to Test the Integration
Quick version:

1. Open `http://localhost:5173`, log in as a **Manager**.
2. Two tabs: **CRQ Dashboard** and **Security** (or **Bug Lab**).
3. In the Security/Bug Lab tab, toggle **MFA Bypass → ON**.
4. `bank-api` posts a `control.disabled` event to `POST :8000/api/v1/events`;
   the CRQ engine runs a 10,000-iteration Monte Carlo FAIR recompute and pushes
   the new EAL over the WebSocket.
5. The CRQ Dashboard tab updates live — headline EAL moves, red "Live recompute"
   banner, chat system line — with no page refresh. Toggle it OFF to restore.

The full test matrix (manual finding form, contributor rows, DB/WS/console
verification, idempotency) is in the [root README](../README.md) §5.

### Chatting with the AI
In the CRQ Dashboard AI box, ask *"What is our biggest risk right now?"* or
*"What happens if I patch the Web Application Firewall?"*. The AI gateway turns it
into a RAG query over `packages/ai-knowledge` + the live database and answers
with grounded context. Requires `CRQ_GROQ_API_KEY`.
