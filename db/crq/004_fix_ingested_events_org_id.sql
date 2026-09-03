-- ============================================================
-- CRQ Platform — Fix crq_ingested_events.org_id type
-- Run this in the Supabase SQL Editor. Migrations 001-003 are already
-- applied; this is the only one you need. Safe to run more than once.
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

DO $$
BEGIN
    -- 1. Convert org_id uuid -> bigint (idempotent: skip if already bigint)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'crq_ingested_events'
          AND column_name = 'org_id'
          AND data_type <> 'bigint'
    ) THEN
        EXECUTE 'ALTER TABLE public.crq_ingested_events ALTER COLUMN org_id DROP DEFAULT';
        EXECUTE 'ALTER TABLE public.crq_ingested_events ALTER COLUMN org_id TYPE bigint USING 1';
        EXECUTE 'ALTER TABLE public.crq_ingested_events ALTER COLUMN org_id SET DEFAULT 1';
    END IF;

    -- 2. Referential integrity to match the rest of the schema (idempotent)
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'crq_ingested_events_org_fk'
    ) THEN
        EXECUTE 'ALTER TABLE public.crq_ingested_events
                 ADD CONSTRAINT crq_ingested_events_org_fk
                 FOREIGN KEY (org_id) REFERENCES public.crq_organizations(id)';
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_crq_ingested_events_org_type
    ON public.crq_ingested_events (org_id, event_type, received_at DESC);
