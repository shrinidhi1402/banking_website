# Control Effectiveness in Banking Systems

This document defines how security control effectiveness is measured, evaluated, and mapped to systemic data points within the banking infrastructure.

## Meaning of Control Effectiveness
Control Effectiveness represents the degree to which a implemented safeguard or countermeasure operates as intended to mitigate identified risks. It answers the question: "Is this control actually working to reduce Vulnerability or Loss Magnitude?"
In quantitative models like FAIR, control effectiveness directly influences the *Resistance Strength* of the environment.

## Measurement Approaches
1. **Design Effectiveness:** Evaluating whether the control is theoretically capable of mitigating the risk (e.g., policy reviews, architecture reviews).
2. **Operational Effectiveness:** Evaluating whether the control functions in practice over a period of time. This requires empirical data.
3. **Automated Evidence Collection:** Using logs and state data to continuously monitor control state, moving away from point-in-time audits.

## Mapping Controls to Bank Tables

### Authentication & Access Control
- **Control:** Multi-Factor Authentication (MFA).
- **Measurement:** Ratio of successful to failed `otp_challenges`. A high failure rate with no successful bypass indicates the control is highly effective at stopping unauthorized access.
- **Control:** Account Lockout.
- **Measurement:** Reviewing `users.status` changes to 'LOCKED' following consecutive failed `login_events`.

### Segregation of Duties (SoD) & Authorization
- **Control:** Dual Control/Approval Workflows.
- **Measurement:** Analyzing the `requests` table to ensure `user_id` (initiator) is never the same as `processed_by` (approver) for critical actions.
- **Control:** Financial Limits.
- **Measurement:** Verifying that no approved `transactions` exceed the `approval_limit` defined in `manager_profiles` for the approving user.

### Audit & Accountability
- **Control:** Immutable Audit Trail.
- **Measurement:** Checking the volume, continuity, and integrity of records in `audit_logs`. Missing sequences or an inability to trace a critical `transactions` record back to an `audit_logs` entry indicates degraded control effectiveness.

### Incident Detection & Response
- **Control:** Security Monitoring.
- **Measurement:** Mean Time to Detect (MTTD) derived from the `created_at` timestamps in `security_events` relative to the actual occurrence of an anomaly.
