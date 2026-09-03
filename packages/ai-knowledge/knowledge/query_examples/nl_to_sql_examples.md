# Natural Language to SQL Query Pattern Examples

This document provides representative pairs of natural language questions and corresponding PostgreSQL query patterns for the CRQ banking schema. These examples serve as semantic retrieval context for LLM NL-to-SQL translation.

### Question 1
**Question:** How many active savings accounts exist in the bank?
**SQL Shape:**
```sql
SELECT COUNT(*) 
FROM public.accounts 
WHERE account_type = 'SAVINGS' AND status = 'ACTIVE';
```
**Explanation:** Filters `accounts` by `account_type = 'SAVINGS'` and `status = 'ACTIVE'`.

### Question 2
**Question:** What is the total volume and count of failed transactions in the last 30 days?
**SQL Shape:**
```sql
SELECT COUNT(*) AS failed_count, COALESCE(SUM(amount), 0) AS total_failed_amount
FROM public.transactions
WHERE status = 'FAILED' 
  AND created_at >= NOW() - INTERVAL '30 days';
```
**Explanation:** Filters `transactions` by status `'FAILED'` within a 30-day relative timestamp window.

### Question 3
**Question:** Which users have experienced more than 5 failed login attempts in the past 24 hours?
**SQL Shape:**
```sql
SELECT u.id, u.email, u.name, COUNT(l.id) AS failed_attempts
FROM public.users u
JOIN public.login_events l ON u.id = l.user_id
WHERE l.success = FALSE 
  AND l.created_at >= NOW() - INTERVAL '24 hours'
GROUP BY u.id, u.email, u.name
HAVING COUNT(l.id) > 5;
```
**Explanation:** Joins `users` to `login_events` where `success = FALSE` in the last 24 hours, grouping by user and filtering with `HAVING`.

### Question 4
**Question:** List all managers with an approval limit greater than $50,000.
**SQL Shape:**
```sql
SELECT u.id, u.name, u.email, m.approval_limit, m.branch, m.designation
FROM public.users u
JOIN public.manager_profiles m ON u.id = m.user_id
WHERE u.role = 'MANAGER' 
  AND m.approval_limit > 50000;
```
**Explanation:** Joins `users` and `manager_profiles` filtering on `role = 'MANAGER'` and `approval_limit > 50000`.

### Question 5
**Question:** Show all critical severity security events logged in the system today.
**SQL Shape:**
```sql
SELECT s.id, s.user_id, s.event_type, s.severity, s.description, s.ip_address, s.created_at
FROM public.security_events s
WHERE s.severity = 'CRITICAL' 
  AND s.created_at >= CURRENT_DATE;
```
**Explanation:** Filters `security_events` on `severity = 'CRITICAL'` and timestamps starting from today (`CURRENT_DATE`).

### Question 6
**Question:** What is the average account balance per account type for active accounts?
**SQL Shape:**
```sql
SELECT account_type, AVG(balance) AS avg_balance, COUNT(*) AS total_accounts
FROM public.accounts
WHERE status = 'ACTIVE'
GROUP BY account_type;
```
**Explanation:** Aggregates `balance` by `account_type` for accounts with `status = 'ACTIVE'`.

### Question 7
**Question:** Find all pending requests processed or submitted by locked users.
**SQL Shape:**
```sql
SELECT r.id, r.request_type, r.status, u.email AS requester_email, u.status AS user_status
FROM public.requests r
JOIN public.users u ON r.user_id = u.id
WHERE r.status = 'PENDING' 
  AND u.status = 'LOCKED';
```
**Explanation:** Identifies workflow items in `requests` where the submitting user has been `LOCKED`.

### Question 8
**Question:** How many OTP challenges have expired without being used in the last 7 days?
**SQL Shape:**
```sql
SELECT COUNT(*) AS expired_unused_otps
FROM public.otp_challenges
WHERE used = FALSE 
  AND expires_at < NOW() 
  AND created_at >= NOW() - INTERVAL '7 days';
```
**Explanation:** Queries `otp_challenges` for records where `used = FALSE` and `expires_at` is past.

### Question 9
**Question:** List the top 5 senders by total transaction amount in successful transfers.
**SQL Shape:**
```sql
SELECT a.user_id, u.name, u.email, SUM(t.amount) AS total_sent
FROM public.transactions t
JOIN public.accounts a ON t.sender_account_id = a.id
JOIN public.users u ON a.user_id = u.id
WHERE t.status = 'SUCCESS'
GROUP BY a.user_id, u.name, u.email
ORDER BY total_sent DESC
LIMIT 5;
```
**Explanation:** Sums transaction amounts by sender user ID, joining `transactions`, `accounts`, and `users`.

### Question 10
**Question:** What administrative actions were taken on the 'users' resource in the audit log during the past week?
**SQL Shape:**
```sql
SELECT a.id, a.user_id, a.role, a.action, a.resource_id, a.ip_address, a.created_at
FROM public.audit_logs a
WHERE a.resource = 'users' 
  AND a.created_at >= NOW() - INTERVAL '7 days'
ORDER BY a.created_at DESC;
```
**Explanation:** Queries `audit_logs` filtering for resource `'users'` over the past 7 days.

### Question 11
**Question:** Find customers located in a specific city who have a frozen account.
**SQL Shape:**
```sql
SELECT u.name, u.email, cp.city, a.account_number, a.balance
FROM public.users u
JOIN public.customer_profiles cp ON u.id = cp.user_id
JOIN public.accounts a ON u.id = a.user_id
WHERE a.status = 'FROZEN';
```
**Explanation:** Joins `users`, `customer_profiles`, and `accounts` filtering where `accounts.status = 'FROZEN'`.

### Question 12
**Question:** Count the distribution of security events by severity level over the last 30 days.
**SQL Shape:**
```sql
SELECT severity, COUNT(*) AS event_count
FROM public.security_events
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY severity
ORDER BY event_count DESC;
```
**Explanation:** Groups `security_events` by `severity` over a 30-day window to show event frequency distribution.
