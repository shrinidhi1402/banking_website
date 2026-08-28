# RBI Cyber Security Framework Mapping

This document maps the Reserve Bank of India (RBI) Cyber Security Framework requirements to the banking application's schema and security controls. Source: RBI Circular RBI/2015-16/418 DBS.CO/CSITE/BC.11/33.01.001/2015-16, "Cyber Security Framework in Banks," June 2, 2016 (public circular from rbi.org.in).

---

## Baseline Cyber Security and Resilience Requirements

The RBI mandates that banks put in place a dedicated, Board-approved Cyber Security Policy distinct from their general IT/Information Security policies. The framework stipulates that baseline security is an enterprise-wide imperative commensurate with the size, digital footprint, complexity, and risk profile of the institution.

Annex 1 of the circular prescribes mandatory baseline controls across critical operational areas including: inventory management of IT assets, prevention of unauthorized software execution, environmental controls for data centres, network management and segmentation, secure configuration and hardening, anti-virus and patch management, user access control, secure mail and messaging, removable media controls, advanced real-time threat defence (IDS/IPS, WAF, Anti-DDoS), vulnerability assessment and penetration testing (VAPT), continuous surveillance via C-SOC, incident response and management, audit log requirements, cybersecurity awareness training, and risk-based transaction monitoring.

**Bank Implementation:**
- Asset inventory is implicitly tracked through the relational schema mapping users to accounts, profiles, and transactions.
- Network context is captured via `ip_address` fields in `login_events`, `security_events`, `transactions`, and `audit_logs`.
- Environmental and infrastructure controls are operational concerns outside the database schema.

---

## Access Control / User ID and Password Management

Access rights to bank systems, core banking applications, databases, and networks must be provisioned strictly based on role-based access control (RBAC), granting only the minimum permissions necessary to perform assigned duties. The RBI requires:

- **Principle of Least Privilege and Need-to-Know:** Strict RBAC with minimum necessary permissions.
- **Separation of Duties and Dual Control:** Segregation between operational, administrative, development, and security management roles. High-value transactions and critical system modifications require dual control (maker-checker validation).
- **Password Governance:** Strong password policies with minimum length, character complexity, enforced periodic expiration, and restriction against password reuse. Prohibition against default, hardcoded, or trivial passwords.
- **Automatic Account Lockout:** Enforced lockout after a predefined threshold of consecutive failed login attempts.
- **Multi-Factor Authentication (MFA):** Mandatory for all administrative and privileged access, remote connections, and sensitive customer transaction channels.
- **Privileged Access Management:** Complete segregation of privileged administrative accounts from ordinary user accounts. Prohibition of shared/generic administrative accounts — all actions must be uniquely attributable to an identifiable individual. Privileged sessions must be monitored and logged.
- **Immediate Access Revocation:** Immediate de-provisioning upon employee termination, transfer, or vendor contract completion, with periodic user access reviews.

**Bank Implementation:**
- RBAC enforcement via `users.role` (CUSTOMER/EMPLOYEE/MANAGER) with validated permissions per role.
- Strong authentication tracked via `users.password_hash` (bcrypt) and MFA via `otp_challenges`.
- Account lockout reflected by `users.status` transitioning to 'LOCKED' after consecutive failed `login_events` where `success = FALSE`.
- Dual control enforced through `requests` table where `user_id` (requester) must differ from `processed_by` (approver).
- All administrative actions uniquely attributable via `audit_logs.user_id`.

---

## Continuous Surveillance and Monitoring

Banks are required to establish and operationalize a 24x7x365 dedicated Cyber Security Operations Centre (C-SOC) to maintain uninterrupted visibility across the bank's digital footprint. Requirements include:

- **Centralized SIEM:** Aggregation of security telemetry, event logs, network flow data, and system alerts into a centralized Security Information and Event Management (SIEM) platform.
- **Real-Time Correlation:** Real-time or near-real-time correlation of events across endpoints, perimeter firewalls, network switches, core databases, and payment systems to identify anomalous, malicious, or unauthorized behavior.
- **Threat Intelligence Integration:** Integration of proactive cyber threat intelligence feeds (TTPs, IOCs) from industry bodies, CERT-In, RBI CSITE, and global sources.
- **Proactive Threat Hunting:** Continuous monitoring of system availability, unauthorized configuration drifts, and rogue connections. Routine threat hunting exercises to uncover hidden or persistent threats.

**Bank Implementation:**
- The `security_events` table aggregates anomalies with `event_type` categorization and `severity` levels (LOW/MEDIUM/HIGH/CRITICAL), functioning as the internal alert feed.
- The `login_events` table captures detailed network and device context (`ip_address`, `device`) required for continuous monitoring of authentication boundaries.
- Cross-correlation is possible between `security_events`, `login_events`, and `transactions` by `user_id` and timestamp to detect coordinated attacks.

---

## Incident Response and Management

Banks must formulate, document, and test a formal Board-approved Cyber Crisis Management Plan (CCMP) addressing four critical phases:

1. **Detection:** Rapid identification and classification of anomalous security events.
2. **Response:** Activation of the Incident Response Team (IRT/CSIRT) with pre-designated roles and standard operating procedures.
3. **Containment:** Swift isolation of infected systems, network segmentation, credential revocation, and perimeter blockades to prevent lateral movement.
4. **Recovery and Restoration:** Secure restoration of business systems from clean, verified backups with integrity validation.

Banks are required to report all unusual cyber security incidents (ransomware, DDoS, unauthorized fund transfers, data breaches, system outages, compromised credentials) to the RBI CSITE cell within 2 to 6 hours of detection using the standardized CSIR reporting template. Banks must maintain digital forensic capability for root cause analysis and evidence chain of custody. Mandatory periodic tabletop exercises and cyber crisis simulation drills are required.

**Bank Implementation:**
- Incidents are logged in `security_events` with severity-based classification driving response SLAs.
- Containment actions are evidenced by updates to `accounts.status` ('FROZEN') and `users.status` ('LOCKED').
- Recovery workflows use the `requests` table for controlled asset restoration with manager approval via `processed_by`.
- Forensic analysis leverages `audit_logs`, `login_events`, and `transactions` for timeline reconstruction.

---

## Audit Logs

The RBI mandates comprehensive audit trail generation across all layers of the IT ecosystem. Requirements include:

- **Comprehensive Log Generation:** Mandatory across operating systems, core banking systems, databases, web servers, firewalls, routers, switches, proxies, VPN gateways, and antivirus/EDR agents.
- **Mandatory Log Attributes:** Every audit log entry must capture: precise date and timestamp (NTP-synchronized), source and destination IP addresses, specific User ID/Account Identifier, event/activity type (login, privilege escalation, transaction, file modification, policy change), event outcome (success/failure/blocked), and complete details of changes to master data, user permissions, and database tables.
- **Log Integrity and Tamper-Resistance:** Logs must be forwarded in real time to a centralized, tamper-evident storage repository. Direct modification, deletion, or disabling of audit logging must be strictly prevented and alerted upon immediately.
- **Log Retention:** Audit logs must be retained for the minimum statutory period (typically at least 6 months online and up to 1–5 years in secure archives).
- **Automated Monitoring:** Regular automated analytical monitoring of audit logs to detect privilege abuse, unauthorized database changes, and policy violations.

**Bank Implementation:**
- The `audit_logs` table provides a tamper-evident record of all administrative actions, recording `user_id`, `role`, `action`, `resource`, `resource_id`, and `ip_address`.
- Financial audit trails are maintained in the immutable `transactions` table.
- Authentication audit trails are maintained in `login_events` with `user_id`, `ip_address`, `device`, `success`, and `failure_reason`.
- All three log tables include `created_at` timestamps for NTP-synchronized event sequencing.

---

## Fraud Risk Management

The RBI requires seamless alignment between the bank's Information Security/SOC operations and the Fraud Risk Management cell. Requirements include:

- **Risk-Based Transaction Monitoring:** Automated real-time transaction monitoring across all payment channels with behavioral analysis and rule-based anomaly detection — tracking abnormal velocity, geographic jumps (impossible travel), unusual transaction sizes, and changes in device fingerprint or IP address.
- **Real-Time Customer Alerts:** Mandatory instantaneous notification via out-of-band channels (SMS/email) for all financial debits and high-risk events (password change, beneficiary addition).
- **Cooling Periods:** Multi-factor verification and cooling periods before enabling fund transfers to newly added beneficiaries.
- **Customer Self-Service Controls:** Mechanisms enabling immediate customer self-service freezing/blocking of channels and accounts upon detecting suspicious transactions.
- **Mule Account Detection:** Proactive identification of dormant accounts abruptly becoming active, high-velocity fund routing across newly opened accounts, and non-KYC compliant activity.

**Bank Implementation:**
- `manager_profiles.approval_limit` enforces financial transaction bounds as a segregation-of-duties control.
- Dual-control mechanisms are mandated by the `requests` workflow, ensuring sensitive changes require secondary approval via `processed_by`.
- Additions to `beneficiaries` trigger MFA (`otp_challenges`) to prevent unauthorized fund routing.
- Transaction monitoring can correlate `transactions.ip_address` with `login_events.ip_address` to detect impossible travel and device fingerprint changes.
- Dormant account detection can analyze `accounts.status` transitions combined with `transactions.created_at` patterns.
