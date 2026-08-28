# Golden Evaluation Set for RAG Semantic Retrieval

This document defines a benchmark evaluation set of 18 golden queries spanning all knowledge categories (Schema, Security Concepts, Compliance Frameworks, Policies, Vulnerabilities, and Query Patterns). Each entry specifies the test query, target domain, expected top source file, and key semantic concepts that must appear in the retrieved context.

---

### Query 01: Manager Approval Limit
- **Query:** "What does approval_limit mean in manager profiles?"
- **Domain:** Schema Documentation
- **Expected Top Source:** `knowledge/schema_docs/bank_schema.md`
- **Key Concepts:** `manager_profiles`, `approval_limit`, segregation of duties, financial threshold

### Query 02: FAIR Loss Event Frequency
- **Query:** "How is Loss Event Frequency defined in the FAIR risk model?"
- **Domain:** Security Concepts
- **Expected Top Source:** `knowledge/security_concepts/fair_model.md`
- **Key Concepts:** Threat Event Frequency, Vulnerability, Loss Event Frequency, LEF

### Query 03: Control Effectiveness Measurement
- **Query:** "How do we measure the operational effectiveness of multi-factor authentication controls?"
- **Domain:** Security Concepts
- **Expected Top Source:** `knowledge/security_concepts/control_effectiveness.md`
- **Key Concepts:** `otp_challenges`, failure rate, Resistance Strength, operational effectiveness

### Query 04: Asset Criticality Tiers
- **Query:** "Which banking database tables are classified as Tier 1 mission critical assets?"
- **Domain:** Security Concepts
- **Expected Top Source:** `knowledge/security_concepts/criticality_levels.md`
- **Key Concepts:** Tier 1, `accounts`, `transactions`, `users`, Expected Annual Loss

### Query 05: NIST CSF Governance Function
- **Query:** "What is the purpose of the Govern function in NIST CSF 2.0?"
- **Domain:** Compliance Framework (NIST CSF 2.0)
- **Expected Top Source:** `knowledge/compliance/nist_csf.md`
- **Key Concepts:** Govern (GV), risk management strategy, policy, GV.OC, GV.RM

### Query 06: RBI C-SOC Mandate
- **Query:** "What are the RBI cyber security guidelines for 24x7 C-SOC monitoring?"
- **Domain:** Compliance Framework (RBI CSF)
- **Expected Top Source:** `knowledge/compliance/rbi_cyber_security.md`
- **Key Concepts:** C-SOC, continuous surveillance, 24x7, SIEM, threat intelligence

### Query 07: RBI Cyber Incident Reporting Timeline
- **Query:** "Within how many hours must a bank report a cyber security incident to the RBI?"
- **Domain:** Compliance Framework (RBI CSF)
- **Expected Top Source:** `knowledge/compliance/rbi_cyber_security.md`
- **Key Concepts:** 2 to 6 hours, CSITE cell, CSIR, incident reporting template

### Query 08: PCI DSS Stored Account Data Protection
- **Query:** "What does PCI DSS Requirement 3 specify regarding PAN storage and SAD prohibition?"
- **Domain:** Compliance Framework (PCI DSS v4.0)
- **Expected Top Source:** `knowledge/compliance/pci_dss.md`
- **Key Concepts:** Requirement 3, PAN unreadability, SAD prohibition, AES-256, HMAC

### Query 09: PCI DSS Multi-Factor Authentication
- **Query:** "Which PCI DSS v4.0 requirement mandates universal multi-factor authentication?"
- **Domain:** Compliance Framework (PCI DSS v4.0)
- **Expected Top Source:** `knowledge/compliance/pci_dss.md`
- **Key Concepts:** Requirement 8, universal MFA, non-console administrative access, 12 characters

### Query 10: CIS Control 08 Audit Log Management
- **Query:** "What are the requirements under CIS Control 08 for audit log management?"
- **Domain:** Compliance Framework (CIS Controls v8)
- **Expected Top Source:** `knowledge/compliance/cis_controls.md`
- **Key Concepts:** Control 08, Audit Log Management, collect, alert, review, retain

### Query 11: CIS Implementation Group 1 Baseline
- **Query:** "What is Implementation Group 1 (IG1) in CIS Controls v8?"
- **Domain:** Compliance Framework (CIS Controls v8)
- **Expected Top Source:** `knowledge/compliance/cis_controls.md`
- **Key Concepts:** IG1, essential cyber hygiene, 56 Safeguards, non-targeted attacks

### Query 12: SEBI CSCRF 5-Tier Entity Classification
- **Query:** "How does the SEBI CSCRF categorize regulated entities into risk tiers?"
- **Domain:** Compliance Framework (SEBI CSCRF)
- **Expected Top Source:** `knowledge/compliance/sebi_cscrf.md`
- **Key Concepts:** 5-tier model, MIIs, QREs, Mid-size REs, Small-size REs, Self-certification

### Query 13: SEBI Incident Reporting Deadline
- **Query:** "What is the deadline for reporting cyber incidents to SEBI under CSCRF?"
- **Domain:** Compliance Framework (SEBI CSCRF)
- **Expected Top Source:** `knowledge/compliance/sebi_cscrf.md`
- **Key Concepts:** 6 hours, SEBI Cybercell, CERT-In, incident reporting

### Query 14: Password Complexity and Lockout Policy
- **Query:** "What is the internal bank policy for failed login account lockout and password rotation?"
- **Domain:** Internal Security Policies
- **Expected Top Source:** `knowledge/policies/security_policies.md`
- **Key Concepts:** 5 consecutive failed attempts, `users.status = 'LOCKED'`, 12 characters, 90/180 days

### Query 15: Incident Response SLAs
- **Query:** "What are the response time SLAs for Critical and High severity security incidents?"
- **Domain:** Internal Security Policies
- **Expected Top Source:** `knowledge/policies/security_policies.md`
- **Key Concepts:** CRITICAL (immediate 24/7), HIGH (within 1 hour), `security_events.severity`

### Query 16: CVSS v3.1 Metric Groups
- **Query:** "What are the Base, Temporal, and Environmental metric groups in CVSS scoring?"
- **Domain:** Vulnerability Concepts
- **Expected Top Source:** `knowledge/vulnerabilities/cve_concepts.md`
- **Key Concepts:** CVSS, Base metrics (Attack Vector, Attack Complexity), Temporal, Environmental

### Query 17: Vulnerability Remediation SLAs
- **Query:** "What are the patching timelines for Critical versus High CVSS vulnerabilities?"
- **Domain:** Vulnerability Concepts
- **Expected Top Source:** `knowledge/vulnerabilities/cve_concepts.md`
- **Key Concepts:** Critical (24 hours), High (72 hours), Medium (14 days), Low (30 days)

### Query 18: SQL Pattern for Locked User Failed Logins
- **Query:** "Show an example SQL query for finding users with more than 5 failed logins in 24 hours."
- **Domain:** Query Pattern Examples
- **Expected Top Source:** `knowledge/query_examples/nl_to_sql_examples.md`
- **Key Concepts:** `login_events`, `success = FALSE`, `HAVING COUNT(l.id) > 5`, 24 hours
