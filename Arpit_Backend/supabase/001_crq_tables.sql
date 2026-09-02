-- ============================================================
-- CRQ Platform — Core Tables
-- Creates all tables for the CyberRisk Quantifier (CRQ) platform.
-- Uses `crq_` prefix to avoid collision with banking demo tables.
-- Run this in the Supabase SQL Editor.
-- ============================================================

-- Ensure pgvector is enabled (TimescaleDB not available on Supabase)
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Organizations & Business Units
CREATE TABLE public.crq_organizations (
    id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    uuid uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    name varchar NOT NULL,
    domain varchar,
    revenue_annual numeric DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.crq_business_units (
    id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    uuid uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    org_id bigint NOT NULL REFERENCES public.crq_organizations(id) ON DELETE CASCADE,
    parent_id bigint REFERENCES public.crq_business_units(id),
    name varchar NOT NULL,
    description text,
    revenue_share_pct numeric DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Assets
CREATE TABLE public.crq_assets (
    id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    uuid uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    org_id bigint NOT NULL REFERENCES public.crq_organizations(id),
    business_unit_id bigint REFERENCES public.crq_business_units(id),
    external_id varchar,
    name varchar NOT NULL,
    hostname varchar,
    asset_type varchar NOT NULL, -- e.g., server, database, application
    environment varchar NOT NULL DEFAULT 'production', -- e.g., prod, dev, staging
    criticality_score int NOT NULL DEFAULT 5, -- 1-10
    criticality_inputs jsonb DEFAULT '{}'::jsonb,
    downtime_cost_per_hour numeric DEFAULT 0,
    data_records_count bigint DEFAULT 0,
    meta_info jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.crq_asset_dependencies (
    id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    source_asset_id bigint NOT NULL REFERENCES public.crq_assets(id) ON DELETE CASCADE,
    target_asset_id bigint NOT NULL REFERENCES public.crq_assets(id) ON DELETE CASCADE,
    dependency_type varchar NOT NULL DEFAULT 'network',
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Vulnerabilities & Threat Intel
CREATE TABLE public.crq_vulnerabilities (
    id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    cve_id varchar NOT NULL UNIQUE,
    title varchar,
    description text,
    cvss_score numeric(3,1),
    epss_score numeric(5,4),
    in_cisa_kev boolean DEFAULT false,
    exploit_available boolean DEFAULT false,
    published_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.crq_asset_vulnerabilities (
    id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    asset_id bigint NOT NULL REFERENCES public.crq_assets(id) ON DELETE CASCADE,
    vulnerability_id bigint NOT NULL REFERENCES public.crq_vulnerabilities(id) ON DELETE CASCADE,
    status varchar NOT NULL DEFAULT 'open', -- open, mitigated, accepted
    first_detected_at timestamptz NOT NULL DEFAULT now(),
    last_seen_at timestamptz NOT NULL DEFAULT now(),
    eal_contribution numeric DEFAULT 0
);

CREATE TABLE public.crq_threat_intel (
    id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    source varchar NOT NULL,
    cve_id varchar NOT NULL REFERENCES public.crq_vulnerabilities(cve_id),
    exploitation_status varchar NOT NULL,
    threat_actors text[],
    sectors_targeted text[],
    meta_info jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Controls
CREATE TABLE public.crq_controls (
    id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    uuid uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    key varchar NOT NULL UNIQUE,
    name varchar NOT NULL,
    description text,
    control_type varchar NOT NULL, -- preventive, detective, corrective
    family varchar,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.crq_control_assessments (
    id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    asset_id bigint NOT NULL REFERENCES public.crq_assets(id) ON DELETE CASCADE,
    control_id bigint NOT NULL REFERENCES public.crq_controls(id),
    coverage_pct numeric NOT NULL DEFAULT 0,
    config_quality numeric NOT NULL DEFAULT 1.0,
    freshness_days int NOT NULL DEFAULT 0,
    effectiveness numeric NOT NULL DEFAULT 0,
    assessed_at timestamptz NOT NULL DEFAULT now()
);

-- 5. FAIR Risk Engine / EAL Snapshots
CREATE TABLE public.crq_eal_snapshots (
    id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    org_id bigint NOT NULL REFERENCES public.crq_organizations(id),
    scope varchar NOT NULL, -- org, bu, asset
    scope_id uuid NOT NULL,
    eal numeric NOT NULL,
    var_95 numeric NOT NULL,
    var_99 numeric NOT NULL,
    loss_distribution jsonb NOT NULL,
    calculation_version varchar NOT NULL,
    inputs_hash varchar NOT NULL,
    source_event_ids uuid[],
    computed_at timestamptz NOT NULL DEFAULT now()
);

-- 6. Events & Audit
CREATE TABLE public.crq_ingested_events (
    id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    event_id uuid NOT NULL UNIQUE,
    event_type varchar NOT NULL,
    org_id uuid NOT NULL,
    source varchar,
    payload jsonb NOT NULL,
    processing_status varchar NOT NULL DEFAULT 'received',
    received_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.crq_audit_log (
    id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    correlation_id varchar,
    org_id bigint REFERENCES public.crq_organizations(id),
    actor_type varchar NOT NULL,
    actor_id varchar NOT NULL,
    action varchar NOT NULL,
    resource_type varchar NOT NULL,
    resource_id varchar NOT NULL,
    before_state jsonb,
    after_state jsonb,
    timestamp timestamptz NOT NULL DEFAULT now()
);

-- 7. Scenarios & Optimizations
CREATE TABLE public.crq_scenarios (
    id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    uuid uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    org_id bigint NOT NULL REFERENCES public.crq_organizations(id),
    name varchar NOT NULL,
    description text,
    baseline_eal numeric,
    projected_eal numeric,
    actions_json jsonb NOT NULL,
    created_by varchar,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.crq_optimization_runs (
    id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    uuid uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    org_id bigint NOT NULL REFERENCES public.crq_organizations(id),
    budget numeric NOT NULL,
    optimal_actions_json jsonb NOT NULL,
    projected_eal_reduction numeric,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 8. AI / RAG

CREATE TABLE public.crq_llm_interactions (
    id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    user_id varchar NOT NULL,
    org_id bigint REFERENCES public.crq_organizations(id),
    prompt text NOT NULL,
    response text NOT NULL,
    intent varchar,
    tokens_used int,
    latency_ms int,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Framework Controls mapping (for Compliance gaps)
CREATE TABLE public.crq_framework_controls (
    id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    framework varchar NOT NULL, -- NIST-CSF, ISO27001, RBI
    control_ref varchar NOT NULL, -- e.g., PR.AC-1
    title varchar NOT NULL,
    description text,
    mapped_crq_control_id bigint REFERENCES public.crq_controls(id),
    embedding vector(1024),
    created_at timestamptz NOT NULL DEFAULT now()
);
