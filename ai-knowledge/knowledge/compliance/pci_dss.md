# PCI DSS v4.0 Requirement Mapping

This document maps PCI DSS v4.0 requirements relevant to banking data, transaction processing, and access controls to the database schema. Source: Payment Card Industry Data Security Standard (PCI DSS) v4.0.

---

## Goal 1: Build and Maintain a Secure Network and Systems

### Requirement 1: Install and Maintain Network Security Controls
Network security controls (NSCs)—such as firewalls and cloud security groups—must be configured to permit only approved, business-justified traffic and protocols, denying all other traffic by default. Demilitarized Zones (DMZs) and micro-segmentation isolate cardholder data environments (CDE) from untrusted networks. NSC rule sets must be reviewed at least once every six months.

### Requirement 2: Apply Secure Configurations to All System Components
Baseline configuration standards (e.g., CIS benchmarks) must be defined and enforced across all operating systems, databases, applications, and network devices. Vendor-supplied default passwords, usernames, and community strings must be changed prior to production deployment. Unnecessary services, daemons, protocols, and sample applications must be removed or disabled. Secure administrative management requires TLS 1.2/1.3 or SSH, prohibiting unencrypted management protocols.

**Bank Implementation:**
- Device network contexts are logged in `login_events.ip_address`, `security_events.ip_address`, `transactions.ip_address`, and `audit_logs.ip_address`.
- Secure baseline configurations govern DB access controls, where `users.status = 'LOCKED'` prevents compromised access.

---

## Goal 2: Protect Account Data

### Requirement 3: Protect Stored Account Data
Primary Account Numbers (PAN) must be rendered unreadable wherever stored using strong cryptography (AES-256), tokenization, truncation, or keyed cryptographic hashes (HMAC). Storage of Sensitive Authentication Data (SAD)—including full track data, CVV/CVC, and PIN blocks—is strictly prohibited after transaction authorization. PAN display must be masked (showing maximum first six and last four digits). Cryptographic keys must be managed under split knowledge and dual control.

### Requirement 4: Protect Cardholder Data with Strong Cryptography During Transmission Over Open, Public Networks
PAN must be encrypted during transit across public or untrusted networks using strong cryptography (TLS 1.2/TLS 1.3, IPsec, SSH). Deprecated protocols (SSL v2/v3, TLS 1.0/1.1) and weak ciphers must be disabled. Unencrypted PAN transmission via end-user messaging (email, SMS, chat) is strictly prohibited.

**Bank Implementation:**
- Password hashes in `users.password_hash` enforce cryptographic storage controls (bcrypt).
- Customer PII data in `customer_profiles` (address, DOB) and beneficiary financial details in `beneficiaries` (account_number, ifsc) are isolated and restricted from direct unauthenticated retrieval.
- OTP hashes in `otp_challenges.otp_hash` prevent cleartext storage of authentication secrets.

---

## Goal 3: Maintain a Vulnerability Management Program

### Requirement 5: Protect All Systems and Networks from Malicious Software
Anti-malware solutions (NGAV/EDR) must be deployed across all endpoints and servers, maintained with automated signature updates and real-time execution monitoring. Anti-phishing capabilities (SPF, DKIM, DMARC, automated email scanning) must be implemented to protect against credential harvesting and malicious links.

### Requirement 6: Develop and Maintain Secure Systems and Software
Custom software must be developed in accordance with secure software development lifecycles (SSDLC) and secure coding standards (OWASP Top 10). Critical and high-severity security patches must be installed within 30 days of release. Public-facing web applications must be protected by Web Application Firewalls (WAF) or automated technical assessments, and client-side payment page JavaScript scripts must be authorized and managed to prevent e-skimming.

**Bank Implementation:**
- Application-level security anomalies and potential vulnerability exploits generate entries in `security_events` with severity ratings (LOW, MEDIUM, HIGH, CRITICAL).
- Vulnerability management SLAs align with `security_events.severity` handling.

---

## Goal 4: Implement Strong Access Control Measures

### Requirement 7: Restrict Access to System Components and Cardholder Data by Business Need to Know
Access privileges must be restricted based on job responsibilities using Role-Based Access Control (RBAC) and explicit "deny-all" default rules. Management authorization is required for privilege grants, and access reviews must be conducted at least every six months.

### Requirement 8: Identify Users and Authenticate Access to System Components
Every individual must be assigned a unique user ID. Universal Multi-Factor Authentication (MFA) is mandatory for ALL personnel accessing the Cardholder Data Environment and for non-console administrative access. Passwords/passphrases must be at least 12 characters combining alphanumeric and special characters. Account lockout is enforced after a maximum of 10 failed login attempts, with idle session timeouts capped at 15 minutes. Shared or generic accounts are strictly prohibited.

### Requirement 9: Restrict Physical Access to Cardholder Data
Physical access to facilities, data centers, and server rooms containing cardholder data must be restricted using electronic entry controls, visitor logging, and 90-day CCTV retention. Physical media must be securely stored, inventoried, and destroyed (degaussed, shredded) when no longer needed. Payment terminals (POS/POI) must be inventoried and periodically inspected for physical tampering or skimmers.

**Bank Implementation:**
- **Requirement 7 (RBAC):** Enforced via `users.role` enum (CUSTOMER, EMPLOYEE, MANAGER).
- **Requirement 8 (MFA & Identity):** Unique identity per user in `users.id`, authenticated via `login_events` and enforced using multi-factor authentication evidence in `otp_challenges`.
- **Segregation of Duties:** Enforced via `manager_profiles.approval_limit` and dual-authorization workflows in `requests` where `user_id` != `processed_by`.

---

## Goal 5: Regularly Monitor and Test Networks

### Requirement 10: Log and Monitor All Access to System Components and Cardholder Data
Comprehensive audit logs must be generated for all individual access to cardholder data, administrative actions, invalid authentication attempts, and privilege changes. Log entries must record user ID, event type, date/time (NTP-synchronized), success/failure status, and impacted resource. Centralized SIEM platforms must review logs daily. Audit logs must be protected from tampering (using WORM storage) and retained for at least 12 months (3 months online). Automated alerting must notify of critical security control failures.

### Requirement 11: Test Security of Systems and Networks Regularly
Rogue wireless access points must be scanned for quarterly. Internal vulnerability scans must be conducted quarterly (authenticated scans) and after major changes. External vulnerability scans must be performed quarterly by a PCI Approved Scanning Vendor (ASV). Internal and external penetration testing must be conducted at least annually. Intrusion Detection/Prevention Systems (IDS/IPS) and File Integrity Monitoring (FIM) must protect critical configuration files and payment pages.

**Bank Implementation:**
- **Requirement 10 (Logging & Tracking):** Non-repudiable system event auditing maintained via `audit_logs` (capturing user_id, action, resource, resource_id, ip_address, created_at) and authentication events via `login_events` (`user_id`, `ip_address`, `device`, `success`, `failure_reason`).
- Transaction audit trails are stored immutably in `transactions`.
- Real-time alerts generated in `security_events`.

---

## Goal 6: Maintain an Information Security Policy

### Requirement 12: Support Information Security with Organizational Policies and Programs
An enterprise information security policy must be reviewed annually and disseminated to all personnel. Targeted Risk Analyses (TRAs) must be conducted for customized control approaches. Third-Party Service Providers (TPSPs) managing cardholder data must be inventoried, contractually bound, and audited annually. Security awareness training must be conducted at hire and annually. Incident Response Plans (IRPs) must be documented, tested annually, and maintain 24/7 operational readiness.

**Bank Implementation:**
- Organization policies map to RBAC boundaries (`users.role`) and approval limits (`manager_profiles.approval_limit`).
- Incident response procedures leverage `security_events` and `requests` for asset containment ('FROZEN'/'LOCKED') and recovery.
