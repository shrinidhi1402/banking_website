# Banking Application Database Schema Documentation

This document describes the schema of the banking database. The database is designed to support customer banking operations while strictly auditing security-relevant events, access control, and transaction integrity. 

## users
**Purpose & Business Context:** The core identity table storing authentication and authorization state for all individuals interacting with the banking system.
**Key/Non-obvious Columns:**
- `role`: [CUSTOMER/EMPLOYEE/MANAGER] - Defines the RBAC scope of the user.
- `status`: [ACTIVE/INACTIVE/LOCKED] - Reflects account standing. 'LOCKED' indicates automated or manual response to security incidents.
**Relationships:** Forms the root of identity. Referenced by all profile tables, operational tables, and security logs.
**Security & Compliance Relevance:** The `password_hash` provides evidence for cryptographic storage controls. `status` acts as a crucial preventative control against compromised accounts.

## customer_profiles
**Purpose & Business Context:** Extended profile for external customers containing PII necessary for banking services and KYC compliance.
**Key/Non-obvious Columns:** 
- `customer_id`: Business identifier independent of the internal user ID.
- `date_of_birth`, `address`, `postal_code`: High-risk PII elements subject to data privacy regulations.
**Relationships:** `user_id` FK to `users`.
**Security & Compliance Relevance:** Primary target for data exfiltration scenarios. Access to this table must be strictly monitored to prevent data breaches.

## employee_profiles
**Purpose & Business Context:** Extended profile for internal staff containing HR and departmental context.
**Key/Non-obvious Columns:**
- `employee_id`: Internal HR identifier.
- `department`, `designation`, `branch`: Used for attribute-based access control (ABAC) context.
**Relationships:** `user_id` FK to `users`.
**Security & Compliance Relevance:** Identifies internal actors. Anomalous cross-branch activity can be a strong indicator of insider threat.

## manager_profiles
**Purpose & Business Context:** Extended profile for high-privilege internal staff capable of overriding limits and approving requests.
**Key/Non-obvious Columns:**
- `approval_limit` (numeric): Specifies the maximum financial threshold for transaction or request approval.
**Relationships:** `user_id` FK to `users`.
**Security & Compliance Relevance:** Represents segregation-of-duties (SoD) controls. The `approval_limit` is a critical business logic control that bounds the impact of a compromised manager account.

## accounts
**Purpose & Business Context:** Represents financial ledger accounts tied to users, acting as the primary repository of financial value.
**Key/Non-obvious Columns:**
- `balance` (numeric ≥0): The current monetary value. Must be strictly positive.
- `status`: [ACTIVE/INACTIVE/FROZEN] - Frozen indicates compliance or security lockdown (e.g., AML suspicion).
**Relationships:** `user_id` FK to `users`.
**Security & Compliance Relevance:** Integrity of the `balance` is the highest priority. Changes without corresponding transactions indicate severe system failure or manipulation.

## beneficiaries
**Purpose & Business Context:** Stores trusted payee accounts added by users for frequent transfers.
**Key/Non-obvious Columns:**
- `ifsc`, `bank_name`, `account_number`: Routing information for external transfers.
**Relationships:** `user_id` FK to `users`.
**Security & Compliance Relevance:** Adding a beneficiary is a high-risk action requiring MFA. Unauthorized modifications here represent a precursor to financial fraud.

## transactions
**Purpose & Business Context:** The immutable ledger of financial movement between accounts.
**Key/Non-obvious Columns:**
- `amount >0`: Ensures strictly directional transfer.
- `status`: [PENDING/SUCCESS/FAILED/REVERSED] - Tracks the lifecycle.
- `ip_address` (inet): Network context of the initiator.
**Relationships:** `sender_account_id` and `receiver_account_id` FK to `accounts`.
**Security & Compliance Relevance:** Core financial audit trail. Used heavily in fraud detection, AML scanning, and calculating actual financial impact during incident investigations.

## requests
**Purpose & Business Context:** Workflow table for operations requiring approval, such as limit increases, account unfreezing, or role changes.
**Key/Non-obvious Columns:**
- `processed_by`: FK to `users` (typically a manager).
**Relationships:** `user_id` FK to `users`, `processed_by` FK to `users`.
**Security & Compliance Relevance:** Demonstrates dual-control and segregation of duties. The pairing of `user_id` and `processed_by` forms the evidence for compliance audits.

## login_events
**Purpose & Business Context:** Dedicated log for tracking authentication attempts and session initialization.
**Key/Non-obvious Columns:**
- `success` (boolean), `failure_reason`: Context on failed logins.
- `device`, `ip_address`: Contextual factors for risk-based authentication.
**Relationships:** `user_id` FK to `users`.
**Security & Compliance Relevance:** Acts as the definitive authentication audit trail. High volume of failures indicates credential stuffing or brute force (Threat Event Frequency in FAIR).

## security_events
**Purpose & Business Context:** Aggregates detected security anomalies, rule violations, and alerts from application logic.
**Key/Non-obvious Columns:**
- `event_type`: Categorizes the threat (e.g., 'MULTIPLE_OTP_FAILURES', 'NEW_DEVICE_LOGIN').
- `severity`: [LOW/MEDIUM/HIGH/CRITICAL] - Used for triage prioritization.
**Relationships:** `user_id` FK to `users`.
**Security & Compliance Relevance:** Functions as an internal SIEM-style alert feed. Crucial for calculating Vulnerability and mapping incidents to compliance frameworks.

## audit_logs
**Purpose & Business Context:** General-purpose immutable log of sensitive administrative or data-modification actions.
**Key/Non-obvious Columns:**
- `action`, `resource`, `resource_id`: Identifies what was changed and how.
**Relationships:** `user_id` FK to `users`.
**Security & Compliance Relevance:** Provides non-repudiation and evidence of changes to configurations, user statuses, and permissions. Required for almost all regulatory audits.

## otp_challenges
**Purpose & Business Context:** Tracks Multi-Factor Authentication (MFA) challenges issued during high-risk operations (login, beneficiary addition).
**Key/Non-obvious Columns:**
- `otp_hash`: Securely stored reference for validation.
- `expires_at`, `attempts`: Controls the time and retry bounds of the challenge.
**Relationships:** `user_id` FK to `users`.
**Security & Compliance Relevance:** Provides MFA control evidence. Excessive failed attempts indicate a targeted account takeover attempt.
