# NIST Cybersecurity Framework (CSF) 2.0 Mapping

This document maps the NIST CSF 2.0 core functions and categories to the controls and data structures in the banking database. Source: NIST CSWP 29, February 2024 (public domain, U.S. government work).

---

## Govern (GV)

**Function Description:** "The organization's cybersecurity risk management strategy, expectations, and policy are established, communicated, and monitored."

Govern is the foundational, cross-cutting function introduced in CSF 2.0 that informs and connects with all other five functions.

### GV.OC — Organizational Context
The circumstances — mission, stakeholder expectations, dependencies, and legal, regulatory, and contractual requirements — surrounding the organization's cybersecurity risk management decisions are understood.

### GV.RM — Risk Management Strategy
The organization's priorities, constraints, risk tolerance and appetite statements, and assumptions are established, communicated, and used to support operational risk decisions.

### GV.RR — Roles, Responsibilities, and Authorities
Cybersecurity roles, responsibilities, and authorities to foster accountability, performance assessment, and continuous improvement are established and communicated.

### GV.PO — Policy
Organizational cybersecurity policy is established, communicated, and enforced.

### GV.OV — Oversight
Results of organization-wide cybersecurity risk management activities and performance are used to inform, improve, and adjust the risk management strategy.

### GV.SC — Cybersecurity Supply Chain Risk Management
Cyber supply chain risk management processes are identified, established, managed, monitored, and improved by organizational stakeholders.

**Bank Implementation:**
- Organizational policies and roles are enforced via the `users.role` enum (CUSTOMER, EMPLOYEE, MANAGER).
- Segregation of duties is explicitly managed through `manager_profiles.approval_limit` and dual-control workflows in the `requests` table where `user_id` (requester) must differ from `processed_by` (approver).
- Supply chain risk is partially addressed through the `beneficiaries` table requiring MFA (`otp_challenges`) for adding external payment recipients.

---

## Identify (ID)

**Function Description:** "The organization's current cybersecurity risks are understood."

### ID.AM — Asset Management
Assets (e.g., data, hardware, software, systems, facilities, services, people) that enable the organization to achieve business purposes are identified and managed consistent with their relative importance to organizational objectives and the organization's risk strategy.

### ID.RA — Risk Assessment
The cybersecurity risk to the organization, assets, and individuals is understood by the organization.

### ID.IM — Improvement
Improvements to organizational cybersecurity risk management processes, procedures, and activities are identified across all CSF Functions.

**Bank Implementation:**
- Asset management and inventory are implicitly tracked through relational mapping of users to assets (`accounts`, `customer_profiles`).
- Criticality definitions are applied to tables holding PII (`customer_profiles`) versus transactional data (`transactions`).
- Risk assessment data is derived from `security_events` severity distributions and `login_events` failure patterns.

---

## Protect (PR)

**Function Description:** "Safeguards to manage the organization's cybersecurity risks are used."

### PR.AA — Identity Management, Authentication, and Access Control
Access to physical and logical assets is limited to authorized users, services, and hardware and managed commensurate with the assessed risk of unauthorized access.

### PR.AT — Awareness and Training
The organization's personnel and partners are provided cybersecurity awareness and training so that they can perform their cybersecurity-related tasks.

### PR.DS — Data Security
Data are managed consistent with the organization's risk strategy to protect the confidentiality, integrity, and availability of information.

### PR.PS — Platform Security
The hardware, software (e.g., firmware, operating systems, applications), and services of physical and virtual platforms are managed consistent with the organization's risk strategy.

### PR.IR — Technology Infrastructure Resilience
Security architectures are managed with the organization's risk strategy to protect asset confidentiality, integrity, and availability, and organizational resilience.

**Bank Implementation:**
- Identity Management and Authentication (PR.AA) are enforced by `users.password_hash` and `otp_challenges` (MFA).
- Access Control is maintained by `users.status` (preventing inactive/locked access) and role-based validation before writing to `audit_logs` or `transactions`.
- Data Security (PR.DS) is evidenced by encrypted credential storage (`users.password_hash`), OTP hashing (`otp_challenges.otp_hash`), and PII isolation in `customer_profiles`.

---

## Detect (DE)

**Function Description:** "Possible cybersecurity attacks and compromises are found and analyzed."

### DE.CM — Continuous Monitoring
Assets are monitored to find anomalies, indicators of compromise, and other potentially adverse events.

### DE.AE — Adverse Event Analysis
Anomalies, indicators of compromise, and other potentially adverse events are analyzed to characterize the events and detect cybersecurity incidents.

**Bank Implementation:**
- Continuous monitoring is supported by the `security_events` table, functioning as an internal alert feed with severity-based triage (LOW/MEDIUM/HIGH/CRITICAL).
- Anomalies in access are recorded in `login_events` (tracking IP addresses and devices for impossible-travel and credential-stuffing detection).
- Adverse event analysis correlates `security_events.event_type` with `login_events` patterns to characterize attacks.

---

## Respond (RS)

**Function Description:** "Actions regarding a detected cybersecurity incident are taken."

### RS.MA — Incident Management
Responses to detected cybersecurity incidents are managed.

### RS.AN — Incident Analysis
Investigations are conducted to ensure effective response and support forensics and recovery activities.

### RS.CO — Incident Response Reporting and Communication
Response activities are coordinated with internal and external stakeholders.

### RS.MI — Incident Mitigation
Activities are performed to prevent expansion of an event and mitigate its effects.

**Bank Implementation:**
- Automated mitigation involves transitioning `users.status` to 'LOCKED' or `accounts.status` to 'FROZEN'.
- The `requests` table manages the workflow for containment and subsequent unfreezing of assets, requiring manager approval.
- Incident analysis leverages `audit_logs` (action, resource, resource_id) correlated with `login_events` (IP, device) and `transactions` (amount, timing).

---

## Recover (RC)

**Function Description:** "Assets and operations affected by a cybersecurity incident are restored."

### RC.RP — Incident Recovery Plan Execution
Restoration activities are performed to ensure operational availability of systems and services affected by cybersecurity incidents.

### RC.CO — Incident Recovery Communication
Restoration activities are coordinated with internal and external parties.

**Bank Implementation:**
- Data integrity for recovery is ensured by the append-only nature of `transactions` and `audit_logs`.
- Status fields across entities (`accounts`, `users`) allow for phased restoration of services following an incident.
- Recovery workflows use the `requests` table (request type: account unlock/unfreeze) with full audit trail in `audit_logs`.
