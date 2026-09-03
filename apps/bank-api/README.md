# Northstar banking backend

Express API for the existing React frontend. It uses Supabase Auth for sessions and the existing Supabase tables for application data. No schema migrations are included.

## Setup

1. Copy `.env.example` to `.env`.
2. Set `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`.
3. Run `npm install` and `npm run dev`.

The service listens on `http://localhost:3001` by default. The service-role key must remain server-only.

## Database contract

The API reads/writes the existing `users`, `customer_profiles`, `employee_profiles`, `manager_profiles`, `accounts`, `beneficiaries`, `transactions`, `requests`, `login_events`, `security_events`, and `audit_logs` tables. Because no schema metadata is checked into this repository, the service keeps table-specific access in `src/controllers` and `src/services` for alignment with the deployed column names.

`POST /api/customer/transfer` calls the existing atomic PostgreSQL RPC `execute_transfer`. That function must validate ownership, prevent negative balances, update the account, and create the transaction in one database transaction. The API intentionally returns `503` when it is not present rather than performing unsafe multi-request balance updates.

## Roles

Roles are loaded from the authenticated user's `users.role` record. The API never trusts a role supplied by the browser. Allowed values are `CUSTOMER`, `EMPLOYEE`, and `MANAGER`.
