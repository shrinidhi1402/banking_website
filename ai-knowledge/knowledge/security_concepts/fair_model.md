# FAIR Model (Factor Analysis of Information Risk) in Banking

This document details the application of the FAIR model to quantify cyber risk within the banking database context.

## Threat Event Frequency (TEF)
**Definition:** The probable frequency within a given timeframe that threat agents act against an asset.
**Banking Context:** 
- Measured by analyzing `login_events` (failed logins), `security_events` (WAF blocks, rate limits), and `otp_challenges` (failed MFA attempts).
- *Contact Frequency* (how often a threat agent comes into contact with the system) combined with *Probability of Action* yields TEF.

## Vulnerability (Vuln)
**Definition:** The probability that a threat agent's action will result in a loss event. It represents the gap between Threat Capability and Resistance Strength.
**Banking Context:**
- *Threat Capability:* The sophistication of the attacker (e.g., credential stuffing vs. targeted spear-phishing).
- *Resistance Strength:* The effectiveness of controls. For example, MFA (`otp_challenges`) increases resistance strength against credential reuse. A 'LOCKED' `status` in the `users` table after 3 failed attempts provides high resistance strength against brute-force.

## Loss Event Frequency (LEF)
**Definition:** The probable frequency within a given timeframe that threat agents will successfully inflict damage.
**Banking Context:** Calculated by combining TEF and Vulnerability. For example, successful account takeovers per year, evidenced by successful logins from malicious IP addresses followed by immediate unauthorized `beneficiaries` addition.

## Primary Loss Magnitude (PLM)
**Definition:** The direct financial loss resulting from the event.
**Banking Context:** 
- Analyzed via the `transactions` table (unauthorized transfers).
- Asset value is bounded by `accounts.balance` and managed via `manager_profiles.approval_limit`.
- Response costs (incident management, restoring systems).

## Secondary Loss Magnitude (SLM)
**Definition:** Subsequent financial losses due to fallout from the primary event (e.g., fines, reputation damage, customer churn).
**Banking Context:**
- Fines for exposing `customer_profiles` (PII).
- Regulatory penalties for failing to maintain `audit_logs` or `security_events` during a breach.
- SLM is driven by *Secondary Loss Event Frequency* (the probability that secondary stakeholders like regulators will react).

## Expected Annual Loss (EAL)
**Definition:** The annualized risk represented as a financial value (LEF x LM).
**Banking Context:** The ultimate metric used by bank executives to prioritize security investments and insurance coverage.
