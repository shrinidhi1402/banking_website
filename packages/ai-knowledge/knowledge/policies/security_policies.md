# Internal Security Policies — Banking Application

This document describes the internal security policies governing the banking application's operations, data handling, and access controls. These are organizational policies, not regulatory requirements — they represent the bank's own operational standards.

---

## Password and Authentication Policy

### Policy Statement
All users of the banking platform must authenticate using strong, unique credentials. Multi-factor authentication (MFA) is mandatory for all privileged operations and high-risk transactions.

### Requirements

#### Password Complexity
- Minimum length: 12 characters
- Must include at least one uppercase letter, one lowercase letter, one digit, and one special character
- Cannot reuse the last 12 passwords
- Password hashes are stored using bcrypt with a minimum cost factor of 12 (evidenced by `users.password_hash`)

#### Password Expiry and Rotation
- Customer passwords must be changed every 180 days
- Employee and manager passwords must be changed every 90 days
- Accounts with expired passwords are transitioned to `users.status = 'INACTIVE'` until reset

#### Multi-Factor Authentication (MFA)
- MFA via OTP is required for: login from a new device, beneficiary addition, high-value transactions (above configurable threshold), and role changes
- OTP challenges are tracked in `otp_challenges` with automatic expiry (`expires_at`) and attempt limiting (`attempts`)
- Maximum 3 OTP attempts per challenge; exceeding this invalidates the challenge and generates a `security_events` entry with `severity = 'HIGH'`

#### Account Lockout
- 5 consecutive failed login attempts within a 15-minute window triggers automatic account lockout (`users.status = 'LOCKED'`)
- All failed login attempts are recorded in `login_events` with `success = FALSE` and a `failure_reason`
- Locked accounts require manager-level intervention via the `requests` workflow to unlock

---

## Incident Response Policy

### Policy Statement
All security incidents must be detected, classified, contained, investigated, and resolved in accordance with defined severity-based SLAs. Every incident must produce a documented audit trail.

### Incident Classification
Incidents are classified using the severity levels defined in `security_events.severity`:

| Severity | Description | Response SLA | Example |
|----------|-------------|--------------|---------|
| CRITICAL | Active compromise of Tier 1 assets (accounts, transactions, credentials) | Immediate (24/7) | Database exfiltration attempt, successful ATO |
| HIGH | Confirmed or high-probability Tier 2 exposure | Within 1 hour | Mass failed MFA attempts, multiple account lockouts |
| MEDIUM | Suspicious activity requiring investigation | Within 24 hours | Unusual login patterns, beneficiary changes without transactions |
| LOW | Anomalous but likely benign events | Next business day | Single failed login, routine password reset |

### Incident Response Phases

#### Detection
- Automated detection rules generate entries in `security_events` with appropriate `event_type` and `severity`
- `login_events` and `audit_logs` feed continuous monitoring systems
- Mean Time to Detect (MTTD) is tracked using `security_events.created_at` relative to the triggering anomaly

#### Containment
- Immediate containment actions include:
  - Setting `users.status = 'LOCKED'` to prevent further access
  - Setting `accounts.status = 'FROZEN'` to prevent financial loss
  - Both actions generate corresponding `audit_logs` entries

#### Investigation
- Investigators trace activity using `audit_logs` (action, resource, resource_id), `login_events` (IP, device), and `transactions` (amount, timing, IP)
- Cross-reference `security_events` with `login_events` by `user_id` and time window

#### Recovery
- Account restoration follows the `requests` workflow (request type: account unlock/unfreeze, requires manager approval via `processed_by`)
- Status fields (`users.status`, `accounts.status`) are restored to 'ACTIVE'
- Recovery actions are logged in `audit_logs`

#### Post-Incident Review
- Root cause analysis documented
- Policy and control updates implemented as needed
- Lessons learned shared with the security team

---

## Data Retention and Disposal Policy

### Policy Statement
Banking data must be retained for the minimum period required by applicable regulations and business needs, and securely disposed of when the retention period expires.

### Retention Periods

| Data Category | Table(s) | Minimum Retention | Rationale |
|---------------|----------|-------------------|-----------|
| Transaction records | `transactions` | 10 years | RBI regulatory requirement, tax compliance |
| Audit trails | `audit_logs` | 7 years | Regulatory audit requirements |
| Login history | `login_events` | 3 years | Security investigation needs |
| Security events | `security_events` | 5 years | Incident pattern analysis, regulatory |
| OTP challenges | `otp_challenges` | 90 days | Short-lived authentication artifacts |
| Customer PII | `customer_profiles` | Duration of relationship + 7 years | KYC compliance |

### Data Classification
- **Confidential:** `users.password_hash`, `customer_profiles` (PII), `otp_challenges.otp_hash`
- **Internal:** `employee_profiles`, `manager_profiles`, `requests`
- **Restricted:** `transactions`, `accounts` (financial data)
- **Audit:** `audit_logs`, `login_events`, `security_events` (immutable logs)

### Disposal Requirements
- Confidential and restricted data must be cryptographically erased or physically destroyed
- Audit and log data must be archived to immutable storage before deletion from the primary database
- All disposal actions must generate an entry in `audit_logs`

---

## Access Control and Authorization Policy

### Policy Statement
Access to the banking system follows the principle of least privilege. Users are granted only the minimum permissions necessary for their role, and all access is logged.

### Role-Based Access Control (RBAC)
The system implements three primary roles via `users.role`:

| Role | Scope | Key Permissions |
|------|-------|-----------------|
| CUSTOMER | Own data only | View own accounts/transactions, initiate transfers, manage own beneficiaries, submit requests |
| EMPLOYEE | Assigned branch/department | View customer accounts (read-only), process routine requests, create security events |
| MANAGER | Branch-wide with approval authority | Approve/reject requests, unlock accounts, unfreeze accounts, view cross-branch data within `approval_limit` |

### Segregation of Duties
- The `requests` table enforces dual control: `user_id` (requester) must differ from `processed_by` (approver)
- `manager_profiles.approval_limit` caps the financial authority of each manager, preventing single-point-of-failure in authorization
- Employees cannot elevate their own role or modify their own profile without manager approval

### Access Monitoring
- All administrative actions are logged to `audit_logs` with the acting `user_id`, `role`, `action`, `resource`, `resource_id`, and `ip_address`
- Anomalous access patterns (e.g., cross-branch queries, off-hours activity) generate entries in `security_events`
