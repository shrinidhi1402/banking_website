# CIS Critical Security Controls v8 Mapping

This document maps the Center for Internet Security (CIS) Controls v8 framework to the controls and data structures in the banking database. Source: CIS Controls v8 (Center for Internet Security).

---

## Overview of Implementation Groups (IGs)

CIS Controls v8 organizes 153 Safeguards across 18 Controls into three cumulative Implementation Groups:
- **IG1 (Essential Cyber Hygiene / Basic):** 56 Safeguards — Baseline defense for all organizations against non-targeted attacks.
- **IG2 (Foundational / Moderate):** 130 cumulative Safeguards — For organizations managing IT infrastructure with greater operational complexity.
- **IG3 (Comprehensive / Advanced):** 153 cumulative Safeguards — For mature enterprises and critical infrastructure handling sensitive assets.

---

## Control 01: Inventory and Control of Enterprise Assets
**Official Title:** Inventory and Control of Enterprise Assets
**Description:** Actively manage (inventory, track, and correct) all enterprise assets (end-user devices, network devices, IoT devices, servers) connected to infrastructure physically, virtually, remotely, or in cloud environments.
**Implementation Groups:** IG1, IG2, IG3 (5 Safeguards total).

## Control 02: Inventory and Control of Software Assets
**Official Title:** Inventory and Control of Software Assets
**Description:** Actively manage all software (operating systems and applications) on the network so that only authorized software is installed and can execute, and unauthorized software is found and prevented.
**Implementation Groups:** IG1, IG2, IG3 (7 Safeguards total).

## Control 03: Data Protection
**Official Title:** Data Protection
**Description:** Develop processes and technical controls to identify, classify, securely handle, retain, and dispose of data. Enforce data encryption at rest and in transit, data loss prevention (DLP), and secure deletion.
**Implementation Groups:** IG1, IG2, IG3 (14 Safeguards total).

## Control 04: Secure Configuration of Enterprise Assets and Software
**Official Title:** Secure Configuration of Enterprise Assets and Software
**Description:** Establish and maintain secure configurations of enterprise assets and software (OS and applications) based on hardened baselines (e.g., CIS Benchmarks).
**Implementation Groups:** IG1, IG2, IG3 (12 Safeguards total).

## Control 05: Account Management
**Official Title:** Account Management
**Description:** Use processes and tools to assign and manage authorization to credentials for user accounts, administrator accounts, and service accounts.
**Implementation Groups:** IG1, IG2, IG3 (6 Safeguards total).

## Control 06: Access Control Management
**Official Title:** Access Control Management
**Description:** Create, assign, manage, and revoke access credentials and privileges for user, administrator, and service accounts using role-based and least-privilege principles.
**Implementation Groups:** IG1, IG2, IG3 (8 Safeguards total).

## Control 07: Continuous Vulnerability Management
**Official Title:** Continuous Vulnerability Management
**Description:** Continuously assess and track vulnerabilities on all enterprise assets to remediate and minimize the window of opportunity for attackers. Monitor public and private threat sources.
**Implementation Groups:** IG1, IG2, IG3 (7 Safeguards total).

## Control 08: Audit Log Management
**Official Title:** Audit Log Management
**Description:** Collect, alert, review, and retain audit logs of events that could help detect, understand, or recover from an attack. Ensure NTP time synchronization and log storage integrity.
**Implementation Groups:** IG1, IG2, IG3 (12 Safeguards total).

## Control 09: Email and Web Browser Protections
**Official Title:** Email and Web Browser Protections
**Description:** Improve protections and detections of threats from email and web vectors (anti-phishing, DMARC/SPF/DKIM, DNS filtering).
**Implementation Groups:** IG1, IG2, IG3 (7 Safeguards total).

## Control 10: Malware Defenses
**Official Title:** Malware Defenses
**Description:** Prevent or control the installation, spread, and execution of malicious applications, code, or scripts on enterprise assets (anti-malware, EDR, central management).
**Implementation Groups:** IG1, IG2, IG3 (7 Safeguards total).

## Control 11: Data Recovery
**Official Title:** Data Recovery
**Description:** Establish and maintain data recovery practices sufficient to restore in-scope enterprise assets to a pre-incident and trusted state (automated, isolated backups).
**Implementation Groups:** IG1, IG2, IG3 (4 Safeguards total).

## Control 12: Network Infrastructure Management
**Official Title:** Network Infrastructure Management
**Description:** Establish, implement, and actively manage network devices (switches, routers, firewalls) to prevent attackers from exploiting vulnerable network services.
**Implementation Groups:** IG1, IG2, IG3 (8 Safeguards total).

## Control 13: Network Monitoring and Defense
**Official Title:** Network Monitoring and Defense
**Description:** Operate processes and tooling to establish comprehensive network monitoring and defense against security threats across network infrastructure (IDS/IPS, network flow analysis).
**Implementation Groups:** IG1, IG2, IG3 (11 Safeguards total).

## Control 14: Security Awareness and Skills Training
**Official Title:** Security Awareness and Skills Training
**Description:** Establish and maintain a security awareness program to influence workforce behavior to reduce cybersecurity risks.
**Implementation Groups:** IG1, IG2, IG3 (9 Safeguards total).

## Control 15: Service Provider Management
**Official Title:** Service Provider Management
**Description:** Develop a process to evaluate third-party service providers who hold sensitive data or manage critical IT platforms to ensure appropriate protection.
**Implementation Groups:** IG1, IG2, IG3 (7 Safeguards total).

## Control 16: Application Software Security
**Official Title:** Application Software Security
**Description:** Manage the security life cycle of in-house developed, hosted, or acquired software to prevent, detect, and remediate security weaknesses (SSDLC, SAST/DAST, component inventory).
**Implementation Groups:** IG1, IG2, IG3 (14 Safeguards total).

## Control 17: Incident Response Management
**Official Title:** Incident Response Management
**Description:** Establish a program to develop and maintain incident response capability (policies, plans, procedures, roles, training, communication) to quickly prepare, detect, and respond.
**Implementation Groups:** IG1, IG2, IG3 (9 Safeguards total).

## Control 18: Penetration Testing
**Official Title:** Penetration Testing
**Description:** Test the effectiveness and resiliency of enterprise assets by identifying and exploiting weaknesses in controls through simulated attacker objectives.
**Implementation Groups:** IG2, IG3 only (5 Safeguards total — excluded from IG1 baseline).

---

## Bank Schema Implementation Mapping

### Asset & Account Control (Controls 01, 02, 05, 06)
- Identity and account management (Controls 05, 06) are directly operationalized via the `users` table (`role`, `status`), `customer_profiles`, `employee_profiles`, and `manager_profiles`.
- Privileged authorization is governed by `users.role = 'MANAGER'` and bounded by `manager_profiles.approval_limit`.
- Account status transitions (`users.status = 'LOCKED'`) enforce automated access revoking (Control 06).

### Data Protection & Recovery (Controls 03, 11)
- Confidential credentials use cryptographic hashing (`users.password_hash` with bcrypt).
- MFA challenge hashes stored in `otp_challenges.otp_hash`.
- Data integrity for financial ledgers relies on the append-only nature of `transactions` and `audit_logs`.

### Audit Log & Monitoring (Controls 08, 13)
- Audit log management (Control 08) is supported by `audit_logs` (capturing `user_id`, `role`, `action`, `resource`, `resource_id`, `ip_address`, `created_at`).
- Authentication monitoring is tracked in `login_events` (`ip_address`, `device`, `success`, `failure_reason`).
- Security monitoring and threat detection (Control 13) feed into `security_events` with severity classification (`LOW`/`MEDIUM`/`HIGH`/`CRITICAL`).

### Application Security & Incident Response (Controls 16, 17)
- Incident response management (Control 17) workflows utilize `security_events` for alert triage and `requests` for asset containment/restoration (`status`, `processed_by`).
- Dual control requirements for critical requests demonstrate application-level business logic security controls (Control 16).
