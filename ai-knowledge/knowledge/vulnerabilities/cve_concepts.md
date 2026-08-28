# Vulnerability Concepts for Cyber Risk Quantification

This document explains vulnerability-related concepts that an LLM needs to reason about vulnerability severity, exploitability, and their role in risk quantification. This is conceptual knowledge — the banking schema does not currently include a vulnerabilities table, but these concepts are essential for interpreting security posture and calculating risk.

---

## Common Vulnerabilities and Exposures (CVE)

### What is a CVE?
A CVE (Common Vulnerabilities and Exposures) is a standardized identifier for a publicly known cybersecurity vulnerability. Each CVE entry consists of:

- **CVE ID:** A unique identifier in the format `CVE-YYYY-NNNNN` (e.g., `CVE-2024-21762`)
- **Description:** A textual explanation of the vulnerability
- **Affected Product(s):** The software, hardware, or service impacted
- **References:** Links to advisories, patches, and analyses

CVEs are maintained by the MITRE Corporation and published in the National Vulnerability Database (NVD).

### Relevance to Banking Systems
In the context of the banking application:
- Vulnerabilities in web frameworks, authentication libraries, database drivers, or operating systems directly affect the bank's attack surface
- A CVE in the OTP generation library, for example, could undermine the entire MFA control evidenced by `otp_challenges`
- Unpatched CVEs in the application stack increase *Threat Capability* in the FAIR model, reducing the *Resistance Strength* of controls

---

## Common Vulnerability Scoring System (CVSS)

### Overview
CVSS provides a standardized numerical score (0.0–10.0) representing the severity of a vulnerability. It is the industry standard for prioritizing remediation.

### CVSS v3.1 / v4.0 Metric Groups

#### Base Score Metrics
These reflect the intrinsic characteristics of the vulnerability, independent of environment:

| Metric | Description | Values |
|--------|-------------|--------|
| **Attack Vector (AV)** | How the vulnerability is exploited | Network (N), Adjacent (A), Local (L), Physical (P) |
| **Attack Complexity (AC)** | Conditions beyond attacker control needed for exploitation | Low (L), High (H) |
| **Privileges Required (PR)** | Level of privileges needed | None (N), Low (L), High (H) |
| **User Interaction (UI)** | Whether a user must participate | None (N), Required (R) |
| **Scope (S)** | Whether impact crosses security boundaries | Unchanged (U), Changed (C) |
| **Confidentiality (C)** | Impact on information confidentiality | None (N), Low (L), High (H) |
| **Integrity (I)** | Impact on data integrity | None (N), Low (L), High (H) |
| **Availability (A)** | Impact on system availability | None (N), Low (L), High (H) |

#### Severity Ratings
| CVSS Score | Severity | Banking Response |
|------------|----------|-----------------|
| 0.0 | None | Informational only |
| 0.1–3.9 | Low | Patch within normal cycle (30 days) |
| 4.0–6.9 | Medium | Patch within 14 days, assess compensating controls |
| 7.0–8.9 | High | Patch within 72 hours, implement compensating controls immediately |
| 9.0–10.0 | Critical | Emergency patch within 24 hours, consider taking affected systems offline |

#### Temporal Metrics
Temporal metrics adjust the base score based on real-world factors:
- **Exploit Code Maturity:** Whether a working exploit exists (Unproven, Proof-of-Concept, Functional, High)
- **Remediation Level:** Whether a fix is available (Official Fix, Temporary Fix, Workaround, Unavailable)
- **Report Confidence:** How certain we are the vulnerability is real (Unknown, Reasonable, Confirmed)

#### Environmental Metrics
These allow organizations to customize the score based on their specific context:
- **Modified Base Metrics:** Adjust base metrics for the organization's deployment
- **Confidentiality/Integrity/Availability Requirements:** How important each property is to the organization (e.g., a banking system has High requirements for all three)

### Banking-Specific CVSS Context
For the banking application, environmental adjustments should reflect:
- **Confidentiality Requirement = High:** Due to PII in `customer_profiles` and financial data in `accounts`/`transactions`
- **Integrity Requirement = High:** `transactions.amount` and `accounts.balance` integrity is paramount
- **Availability Requirement = High:** Banking services must maintain uptime SLAs

---

## Exploit Availability and Weaponization

### Exploit Lifecycle
1. **Vulnerability Discovery:** A flaw is found (may be publicly disclosed or kept private)
2. **CVE Assignment:** The vulnerability receives a CVE identifier
3. **Proof of Concept (PoC):** A demonstration that the vulnerability can be exploited
4. **Weaponization:** The PoC is developed into a reliable, deployable exploit
5. **Active Exploitation (In the Wild):** Attackers use the exploit against real targets
6. **Patch Available:** The vendor releases a fix

### Zero-Day Vulnerabilities
A zero-day vulnerability is one that is actively exploited before a patch is available. In the FAIR model:
- Zero-days dramatically increase *Threat Event Frequency* (TEF) because attackers actively target them
- They reduce *Resistance Strength* to near zero for the affected control
- The *Loss Event Frequency* (LEF) spikes because Vulnerability (Vuln = Threat Capability / Resistance Strength) approaches 1.0

### Known Exploited Vulnerabilities (KEV)
CISA maintains a Known Exploited Vulnerabilities catalog — vulnerabilities confirmed to be actively exploited. Federal agencies are mandated to patch KEV entries within specific timelines. Banks should treat KEV entries with the same urgency.

---

## Vulnerability Severity and Risk Quantification

### Mapping Vulnerability Severity to FAIR

| FAIR Factor | Vulnerability Relevance |
|-------------|------------------------|
| **Threat Capability** | Higher CVSS score → higher attacker capability against the specific control |
| **Resistance Strength** | Unpatched vulnerabilities reduce resistance; compensating controls partially restore it |
| **Contact Frequency** | Network-accessible vulnerabilities (AV:N) have higher contact frequency |
| **Probability of Action** | Exploit availability increases the probability that a threat agent will act |
| **Primary Loss Magnitude** | Scope and CIA impact metrics bound the potential direct loss |

### Compensating Controls in Banking Context
When a vulnerability cannot be immediately patched, the banking system's existing controls provide compensating protection:

| Vulnerability Type | Compensating Control | Evidence Table |
|-------------------|---------------------|----------------|
| Authentication bypass | MFA enforcement | `otp_challenges` |
| Privilege escalation | RBAC + approval limits | `users.role`, `manager_profiles.approval_limit` |
| SQL injection | Input validation + audit logging | `audit_logs` |
| Session hijacking | IP/device tracking | `login_events.ip_address`, `login_events.device` |
| Brute force | Account lockout | `users.status = 'LOCKED'`, `login_events` |

### Vulnerability-Adjusted Risk Calculation
The presence of known vulnerabilities modifies the Expected Annual Loss (EAL):

```
EAL = LEF × (PLM + SLM)
```

Where:
- LEF increases proportionally to the number and severity of unpatched vulnerabilities
- PLM is bounded by asset criticality (Tier 1 assets like `accounts` and `transactions` have highest PLM)
- SLM includes regulatory fines for failing to patch known vulnerabilities within mandated timelines

A critical unpatched vulnerability (CVSS 9.0+) in the authentication stack could increase LEF by an order of magnitude, directly impacting the bank's annualized risk exposure.
