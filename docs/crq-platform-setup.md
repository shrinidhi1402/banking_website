# Northstar Banking CRQ - Full Stack Setup Guide

This guide explains how to set up the entire architecture: **React Frontend**, **FastAPI Backend**, **Celery Workers**, **Supabase DB**, and the **AI Gateway**.

## 🏗️ 1. Prerequisites
Ensure you have the following installed locally:
- **Node.js** (v18+)
- **Docker & Docker Compose** (for Redis, API, and Celery)
- **Supabase Account** (or a local Supabase CLI setup)
- **Python 3.11+** (if you wish to run the backend natively instead of Docker)

---

## 🗄️ 2. Database Setup (Supabase)
This project uses Supabase as the central database and identity provider. 
1. Create a new Supabase project (or use your existing one).
2. Go to the SQL Editor in your Supabase dashboard.
3. Run the following migration files located in `db/crq/` in this exact order:
   - `001_crq_tables.sql` (Creates the FAIR risk tables and pgvector schema)
   - `002_crq_indexes.sql` (Applies performance indexes)
   - `003_crq_seed_demo.sql` (Seeds mock vulnerabilities and frameworks)
   - `004_fix_ingested_events_org_id.sql` (Aligns `crq_ingested_events.org_id` with the risk engine)

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
1. Open the Banking App (`http://localhost:5173`).
2. Log in as a **Manager**.
3. Open two browser windows side-by-side:
   - Window 1: Navigate to the **CRQ Dashboard** tab.
   - Window 2: Navigate to the **Bug Lab** tab.
4. **Trigger a Live Risk Event:** In the Bug Lab, toggle `MFA Bypass` to ON.
5. **Watch the Magic:** 
   - The React app sends a `control.disabled` webhook to the FastAPI backend.
   - FastAPI triggers the Celery worker to run 10,000 Monte Carlo FAIR simulations.
   - The new Expected Annual Loss (EAL) is pushed over WebSockets.
   - Window 1 (CRQ Dashboard) will turn red and update the Financial Risk live on screen without a page refresh!

### Chatting with the AI
In the CRQ Dashboard, use the AI Chat box to ask:
> *"What is our biggest risk right now?"* or *"What happens if I patch the Web Application Firewall?"*

The AI Gateway will intercept this, convert it to a `pgvector` RAG query, pull the framework context, and respond intelligently based on your live database!
