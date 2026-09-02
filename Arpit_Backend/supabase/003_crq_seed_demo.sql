-- ============================================================
-- CRQ Platform — Demo Data Seeding
-- Provides a realistic banking environment for the demo.
-- ============================================================

-- 1. Create Organization
INSERT INTO public.crq_organizations (name, domain, revenue_annual) 
VALUES ('0xAxiom Bank', '0xaxiom.com', 500000000)
RETURNING id;
-- (Assume ID 1 for subsequent inserts)

-- 2. Create Standard Controls
INSERT INTO public.crq_controls (key, name, description, control_type, family) VALUES
('mfa', 'Multi-Factor Authentication', 'MFA enforced on all logins', 'preventive', 'identity'),
('waf', 'Web Application Firewall', 'WAF protecting public endpoints', 'preventive', 'network'),
('edr', 'Endpoint Detection & Response', 'EDR agents on all servers', 'detective', 'endpoint'),
('patching', 'Patch Management', 'Automated patching within 7 days', 'preventive', 'vulnerability'),
('segmentation', 'Network Segmentation', 'DB isolated from DMZ', 'preventive', 'network'),
('access_control', 'Access Control', 'Strict authorization rules (no IDOR)', 'preventive', 'application');

-- 3. Create Assets (Ready for your scanner to find)
INSERT INTO public.crq_assets (org_id, name, hostname, asset_type, environment, criticality_score, downtime_cost_per_hour) VALUES
(1, 'Customer Banking Web App', 'localhost:3000', 'application', 'production', 9, 250000),
(1, 'Core Banking Database', 'localhost:5432', 'database', 'production', 10, 500000),
(1, 'Internal Employee Portal', 'localhost:3001', 'application', 'production', 6, 20000);

-- 4. Initial Control Assessments (Baseline before your live events change them)
INSERT INTO public.crq_control_assessments (asset_id, control_id, coverage_pct, config_quality, effectiveness) 
SELECT a.id, c.id, 95.0, 1.0, 0.95 
FROM public.crq_assets a
CROSS JOIN public.crq_controls c
WHERE a.name = 'Customer Banking Web App' AND c.key IN ('mfa', 'waf', 'access_control');

-- 5. (Removed manual Vulnerability seeding)
-- Because you have simulated real bugs on the bank website, 
-- those will populate `crq_vulnerabilities` automatically when you ingest the scan!

-- 6. Initial EAL Snapshot (Baseline: ~₹4.2 Cr)
INSERT INTO public.crq_eal_snapshots (org_id, scope, scope_id, eal, var_95, var_99, loss_distribution, calculation_version, inputs_hash)
VALUES (
    1, 
    'org', 
    '00000000-0000-0000-0000-000000000001'::uuid, 
    42000000.00, 
    78000000.00, 
    115000000.00, 
    '{"p10": 15000000, "p50": 38000000, "p90": 65000000}', 
    '1.0', 
    'seed_hash'
);
