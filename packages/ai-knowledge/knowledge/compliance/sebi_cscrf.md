# SEBI Cyber Security and Cyber Resilience Framework (CSCRF) Mapping

This document maps the Securities and Exchange Board of India (SEBI) Cyber Security and Cyber Resilience Framework (CSCRF) guidelines to the banking/financial application's schema and security controls. Source: SEBI Circular SEBI/HO/ITD-1/ITD_CSC_EXT/P/CIR/2024/113, August 2024 (public circular from sebi.gov.in).

---

## Framework Structure and Applicability

The SEBI CSCRF serves as the consolidated regulatory standard for cybersecurity across Indian securities market regulated entities (REs). It unifies earlier circulars into an audit-grade framework built upon global standards including NIST CSF 2.0 and ISO/IEC standards.

The framework mandates a **5-tier risk-proportionate model**, scaling regulatory intensity based on systemic importance and operational volume:
1. **Market Infrastructure Institutions (MIIs):** Stock exchanges, depositories, clearing corporations (most stringent: 24/7 SOC, frequent red teaming, board oversight).
2. **Qualified Regulated Entities (QREs):** Large stockbrokers, major Asset Management Companies (AMCs).
3. **Mid-size REs:** Mid-tier brokers, Registrars and Transfer Agents (RTAs), KYC Registration Agencies (KRAs).
4. **Small-size REs:** Small stockbrokers, portfolio managers.
5. **Self-certification REs:** Research analysts, investment advisers (baseline controls).

---

## Core Regulatory Requirements

### 1. Governance
Regulated entities must establish a Board-approved Cybersecurity Policy, appoint a designated Chief Information Security Officer (CISO) with direct board access, and form a Cybersecurity Committee. The framework emphasizes "audit-grade" compliance where all control implementations must maintain verifiable evidence.

### 2. Identification & Asset Management
Entities must maintain a comprehensive inventory of all critical IT assets, classify data based on sensitivity (PII, financial, operational), and conduct periodic cyber risk assessments. Software Bill of Materials (SBOM) must be maintained for all software components.

### 3. Protection & Access Controls
Mandates robust access controls incorporating Multi-Factor Authentication (MFA), role-based access controls (RBAC), least-privilege principles, strong data encryption (at rest and in transit), secure baseline configurations, and mandatory annual cybersecurity awareness training for all workforce members.

### 4. Continuous Detection & Security Operations Centre (SOC)
Entities must establish continuous 24/7 security monitoring through a Security Operations Centre (SOC)—in-house, group-level, or via a qualified third-party Managed Security Service Provider (MSSP). Real-time event correlation and anomaly detection are required.

### 5. Incident Response, Containment & Reporting
Entities must maintain and test Incident Response Plans (IRP) and Disaster Recovery (DR) readiness. Cyber incidents must be reported to SEBI's Cybercell within **6 hours** of detection, following standardized reporting formats, alongside reporting to CERT-In.

### 6. Vulnerability Assessment & Penetration Testing (VAPT)
Mandatory periodic VAPT assessments, including after major software releases or structural changes. MIIs and QREs must undergo advanced adversarial simulation / red teaming exercises.

### 7. Data Localization
All regulatory data, financial records, transaction logs, IT system data, and cybersecurity telemetry must reside strictly within the legal boundaries of India.

---

## Bank Schema Implementation Mapping

### Governance & Access Control (SEBI Protection Standards)
- User role hierarchy (`users.role`: CUSTOMER, EMPLOYEE, MANAGER) instantiates RBAC governance.
- Segregation of duties is explicitly managed through `manager_profiles.approval_limit` and dual-control workflows in the `requests` table (`user_id` != `processed_by`).
- MFA enforcement via `otp_challenges` satisfies SEBI strong authentication mandates.

### Data Protection & Localization
- Customer PII (`customer_profiles`) and financial balances (`accounts`, `transactions`) are strictly protected with encrypted authentication (`users.password_hash`).
- All data stored in Supabase Postgres resides in specified regional database clusters, complying with Indian data localization requirements.

### Surveillance, Detection & SOC Feeds
- Continuous monitoring requirements align with `security_events` (functioning as internal SIEM/SOC alert feed with `LOW`/`MEDIUM`/`HIGH`/`CRITICAL` severity).
- Authentication telemetry is recorded in `login_events` (`ip_address`, `device`, `success`, `failure_reason`).

### Incident Handling & Auditability
- 6-hour incident reporting readiness is backed by real-time logging into `security_events` with `created_at` timestamps.
- Asset containment actions transition `accounts.status` to 'FROZEN' or `users.status` to 'LOCKED'.
- Auditability standards are fulfilled by immutable `audit_logs` (capturing `user_id`, `role`, `action`, `resource`, `resource_id`, `ip_address`).
