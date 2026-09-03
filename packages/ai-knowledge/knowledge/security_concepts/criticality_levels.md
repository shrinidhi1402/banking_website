# Asset Criticality and Severity Levels

This document outlines the classification of asset criticality, the definition of severity levels for events, and how these factors influence risk quantification in the banking environment.

## Asset Criticality
Asset criticality defines the relative importance of an information asset to the core mission of the bank.

- **Tier 1 (Mission Critical):**
  - **Assets:** `accounts`, `transactions`, `users` (credentials).
  - **Impact of Compromise:** Immediate financial loss, systemic operational failure, severe regulatory breach.
- **Tier 2 (Business Critical):**
  - **Assets:** `customer_profiles` (PII), `beneficiaries`.
  - **Impact of Compromise:** Significant privacy breach, regulatory fines, moderate operational disruption, enabler for future financial fraud.
- **Tier 3 (Operational):**
  - **Assets:** `employee_profiles`, `requests`.
  - **Impact of Compromise:** Internal administrative delays, minor reputational impact.

## Severity Levels (Event Triage)
Events logged in `security_events` are categorized by severity to dictate response SLAs.

- **CRITICAL:** Imminent or ongoing Tier 1 asset compromise (e.g., active database exfiltration, successful login from known APT infrastructure). Requires immediate 24/7 response.
- **HIGH:** High probability of compromise or confirmed Tier 2 asset exposure (e.g., excessive failed MFA from a single IP, multiple 'LOCKED' accounts). Requires response within 1 hour.
- **MEDIUM:** Suspicious behavior requiring investigation (e.g., unusual login time, modification of `beneficiaries` followed by no transaction). Requires response within 24 hours.
- **LOW:** Anomalous but likely benign activity (e.g., single failed login, standard password reset). Handled via automated reporting.

## EAL Calculation and Risk Quantification
Asset Criticality and Event Severity directly feed into the Expected Annual Loss (EAL) calculation.
- **Criticality** bounds the *Primary Loss Magnitude* (PLM) and *Secondary Loss Magnitude* (SLM). A Tier 1 asset compromise will have a drastically higher PLM than a Tier 3 asset.
- **Severity** mapping helps estimate the *Loss Event Frequency* (LEF) by providing concrete data on how often high-risk scenarios manifest in the environment.
- By quantifying these levels using historical data from `security_events` and financial exposure from `accounts`, the bank calculates the EAL to prioritize control investments.
