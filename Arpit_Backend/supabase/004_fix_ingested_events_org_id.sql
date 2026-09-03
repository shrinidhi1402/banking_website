-- ============================================================
-- CRQ Platform — Fix crq_ingested_events.org_id type
-- Run this in the Supabase SQL Editor after 003_crq_seed_demo.sql
-- ============================================================
--
-- Why: crq_ingested_events.org_id was declared `uuid`, but the risk engine
-- (crq_eal_snapshots.org_id, all /risk/* endpoints, and the event pipeline)
-- treats org_id as a bigint FK to crq_organizations.id. That mismatch made
-- every POST /api/v1/events fail with a 500. This aligns the column with the
-- rest of the schema.
--
-- Existing rows (if any) are re-pointed at org 1 — the only seeded org.
-- ============================================================

ALTER TABLE public.crq_ingested_events
    ALTER COLUMN org_id DROP DEFAULT,
    ALTER COLUMN org_id TYPE bigint USING 1,
    ALTER COLUMN org_id SET DEFAULT 1;

-- Optional: enforce the same referential integrity the rest of the schema uses.
ALTER TABLE public.crq_ingested_events
    ADD CONSTRAINT crq_ingested_events_org_fk
    FOREIGN KEY (org_id) REFERENCES public.crq_organizations(id);

CREATE INDEX IF NOT EXISTS idx_crq_ingested_events_org_type
    ON public.crq_ingested_events (org_id, event_type, received_at DESC);
