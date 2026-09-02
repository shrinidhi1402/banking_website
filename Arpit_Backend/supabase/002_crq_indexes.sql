-- ============================================================
-- CRQ Platform — Performance Indexes
-- Run this in the Supabase SQL Editor after 001_crq_tables.sql
-- ============================================================

-- 1. EAL Snapshots
-- Fast lookup of latest risk snapshots by org/scope
CREATE INDEX idx_crq_eal_snapshots_org_scope_time ON public.crq_eal_snapshots (org_id, scope, scope_id, computed_at DESC);

-- 2. Assets
CREATE INDEX idx_crq_assets_org_type ON public.crq_assets (org_id, asset_type);
CREATE INDEX idx_crq_assets_ext_id ON public.crq_assets (external_id);

-- 3. Vulnerabilities
CREATE INDEX idx_crq_vulns_cve ON public.crq_vulnerabilities (cve_id);
CREATE INDEX idx_crq_asset_vulns_asset ON public.crq_asset_vulnerabilities (asset_id, status);

-- 4. Controls
CREATE INDEX idx_crq_controls_key ON public.crq_controls (key);
CREATE INDEX idx_crq_control_assessments_asset ON public.crq_control_assessments (asset_id);
CREATE INDEX idx_crq_control_assessments_composite ON public.crq_control_assessments (asset_id, control_id, assessed_at DESC);

-- 5. Events
CREATE INDEX idx_crq_ingested_events_event_id ON public.crq_ingested_events (event_id);
CREATE INDEX idx_crq_ingested_events_time ON public.crq_ingested_events (received_at DESC);

-- 6. Vector Indexes (HNSW for fast similarity search)
-- Requires pgvector extension enabled. Adjust m (max connections) and ef_construction as needed.
CREATE INDEX idx_crq_knowledge_chunks_embedding 
ON public.crq_knowledge_chunks 
USING hnsw (embedding vector_cosine_ops) 
WITH (m = 16, ef_construction = 64);

CREATE INDEX idx_crq_framework_controls_embedding 
ON public.crq_framework_controls 
USING hnsw (embedding vector_cosine_ops) 
WITH (m = 16, ef_construction = 64);
