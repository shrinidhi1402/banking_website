-- ============================================================
-- CRQ Postgres Initialization
-- Runs once when the Postgres container first starts.
-- ============================================================

-- Extensions (requires superuser — this file runs as postgres)
CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;      -- text search
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";  -- uuid_generate_v4()
CREATE EXTENSION IF NOT EXISTS pgcrypto;     -- gen_random_uuid()

-- ============================================================
-- Application schema (all app objects live here)
-- ============================================================
CREATE SCHEMA IF NOT EXISTS crq;

-- ============================================================
-- Non-superuser application role (architecture ss10.2 least-privilege)
-- The FastAPI app connects as crq_app — NOT as postgres superuser.
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'crq_app') THEN
    CREATE ROLE crq_app WITH LOGIN PASSWORD 'crq_app_password';
  END IF;
END
$$;

-- Grant schema access
GRANT USAGE ON SCHEMA crq TO crq_app;
GRANT CREATE ON SCHEMA crq TO crq_app;

-- Default privileges: any table created in crq schema is accessible to crq_app
ALTER DEFAULT PRIVILEGES IN SCHEMA crq
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO crq_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA crq
  GRANT USAGE, SELECT ON SEQUENCES TO crq_app;

-- ============================================================
-- Row-Level Security (RLS) scaffold
-- Architecture ss10.2: BU-scoped role assignments use RLS.
-- Full RLS policies are implemented in B1.1.12.
-- The pattern is documented here so teammates know the mechanism.
--
-- Pattern for each tenant-scoped table:
--   ALTER TABLE crq.<table> ENABLE ROW LEVEL SECURITY;
--   ALTER TABLE crq.<table> FORCE ROW LEVEL SECURITY;
--   CREATE POLICY <table>_org_isolation ON crq.<table>
--     USING (org_id = current_setting('app.current_org_id')::uuid);
--
-- The FastAPI app sets app.current_org_id per request:
--   await session.execute(text("SET LOCAL app.current_org_id = :org_id"), {"org_id": ...})
-- ============================================================

-- Set crq_app as the owner of the crq schema objects
ALTER SCHEMA crq OWNER TO crq_app;
