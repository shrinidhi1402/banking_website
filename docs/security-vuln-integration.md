# Northstar Banking – Security Vulnerability Integration Guide

## Overview
This system embeds 3 real, backend-enforced vulnerabilities into the normal banking website flows.
There is **no separate test panel** — the bugs manifest when real users interact with real features.
The Manager's **Security** tab has a professional toggle control to activate/deactivate each.

---

## Control Panel Location
**Log in as Manager → Security → "Vulnerability Controls" (top of the page)**

Each toggle activates a real backend code path change. All server flags reset to OFF on every restart.

---

## Phase 1 – MFA Bypass (BUG_MFA)

### What happens
When enabled, the server's `authController.js` skips the OTP generation entirely.
After password validation, a live JWT session is returned directly — no OTP email, no challenge.

### How to test
1. Enable **MFA Bypass** toggle in Security panel
2. Open a private/incognito window → `http://localhost:5173`
3. Log in with **any** employee or customer account (correct email + password)
4. **Expected:** You land directly on the dashboard — the OTP screen is completely gone
5. Disable the toggle → log out → try again → OTP screen returns immediately

### What gets logged
Every login while BUG_MFA is ON writes `MFA_BYPASSED (CRITICAL)` to the Security event log.

---

## Phase 2 – SQL Injection (BUG_SQLI)

### What happens
When enabled, the `/api/employee/customers?search=` and `/api/manager/customers?search=` endpoints
directly interpolate the `search` query param into a database filter — no sanitization.

The **Customers search bar** (visible to all Employees and Managers) is the attack surface.

### How to test
1. Enable **SQL Injection** toggle
2. Log in as **Employee** or **Manager** → go to **Customers** tab
3. Type in the search bar and watch real API calls with `?search=` fire against the backend
4. **Normal search:** type `john` → returns matching customers
5. **Injection payload:** type `role=MANAGER` → returns all MANAGER accounts (should never be visible)
6. **Injection payload:** type `status=LOCKED` → returns all locked accounts across the bank
7. **Injection payload:** type anything with an `@` → bypasses customer profile filter, searches raw users table
8. Disable the toggle → same payloads return empty or restricted results

### What gets logged
Every injection attempt writes `SQL_INJECTION_ATTEMPT (HIGH)` with the raw payload to the Security log.

---

## Phase 3 – Broken Access Control / IDOR (BUG_IDOR)

### What happens
When enabled, the `/api/customer/account` and `/api/customer/transactions` endpoints no longer verify
that the requested account belongs to the authenticated customer. Any logged-in customer can fetch
any other customer's full account balance and complete transaction history.

### How to test
1. Enable **Broken Access Control** toggle
2. Log in as **Customer A**
3. Open browser DevTools → Network tab → find the `GET /api/customer/account` request
4. Note Customer A's account ID in the response
5. **Exploit:** Resend the request with `?account_id=<different number>` (e.g., 1, 2, 3...)
6. **Expected (bug ON):** Returns the other customer's account details and transaction history
7. Disable the toggle → same request returns `403 Access denied: this account does not belong to you.`

### Real-world equivalent
An attacker who knows (or guesses) any account ID can access any other customer's financial data.
This is a direct GDPR/RBI data protection violation.

---

## Security Event Log
All vulnerability events appear in **Manager → Security → event log** in real time:

| Event Type | Severity | Trigger |
|---|---|---|
| MFA_BYPASSED | CRITICAL | Every login with BUG_MFA ON |
| SQL_INJECTION_ATTEMPT | HIGH | Every search with BUG_SQLI ON |
| MFA_CHALLENGE_CREATED | LOW | Every normal OTP login |
| SUSPICIOUS_LOGIN | HIGH | Login on locked account |

---

## Architecture Summary

### The bugs are real, backend-enforced, and silent:
- `authController.js` — Phase 1: skips OTP when `isBugEnabled('BUG_MFA')` returns true
- `operationsController.js` — Phase 2: raw filter execution when `isBugEnabled('BUG_SQLI')` + `?search=` present
- `customerController.js` — Phase 3: no `.eq('user_id', callerId)` when `isBugEnabled('BUG_IDOR')` + `?account_id=` present
- `bugFlags.js` — In-memory state, resets to all-OFF on every server restart (safe by default)

### What is NOT here:
- No "game" panel or exploitation console
- No separate Bug Lab nav item
- No buttons that say "Trigger Attack" or "Execute Query"
- No simulated data — all reads and events go to the real Supabase database


## Overview
This document explains how to use and verify each of the 3 simulated security vulnerabilities in the Northstar Banking Platform. All bugs are controlled via the **Bug Lab** panel (Manager login only).

---

## How to Access Bug Lab
1. Log in as a **Manager** account
2. In the left sidebar, click **⚠ Bug Lab** (last item in navigation)
3. You'll see the Vulnerability Simulation Lab with all 3 phases

---

## Phase 1 – MFA Disabled / Account Takeover

### What it does
When `BUG_MFA` is enabled, the OTP verification step is bypassed on login. Any user who enters a valid email + password is immediately logged in with a live session — **no email OTP is sent, no challenge is created**.

### How to test
1. **Enable Bug 1** in Bug Lab → click "▶ Enable" on Phase 1 card
2. **Open a new tab** → navigate to `http://localhost:5173`
3. **Login** with any employee or customer credentials
4. ✅ **Expected (bug ON):** You land directly on the dashboard — **no OTP screen appears**
5. Switch back to the Manager tab → **Trigger Attack Trail**:
   - Enter the email you just logged in with (or any other user's email)
   - Click "⚡ Trigger Attack"
6. **Check Security panel** → you will see:
   - `BRUTE_FORCE_DETECTED` (HIGH)
   - `NO_MFA_CONFIGURED` (CRITICAL)
   - `ACCOUNT_TAKEOVER` (CRITICAL)
   - `SUSPICIOUS_LOGIN` (HIGH)
   - `MFA_BYPASSED` (CRITICAL) — from the actual login you did in step 3
7. **Disable Bug 1** → click "⏹ Disable"
8. Go back to the new tab → **log out** → try logging in again
9. ✅ **Expected (bug OFF):** OTP screen appears normally

### Security events generated
| Event Type | Severity | Description |
|---|---|---|
| MFA_BYPASSED | CRITICAL | Written every time someone logs in while bug is ON |
| BRUTE_FORCE_DETECTED | HIGH | 4 rapid failed logins from suspicious IP |
| NO_MFA_CONFIGURED | CRITICAL | Explains why bypass was possible |
| ACCOUNT_TAKEOVER | CRITICAL | Full account takeover simulated |
| SUSPICIOUS_LOGIN | HIGH | Login from new device/Tor exit node |

---

## Phase 2 – SQL Injection Vulnerability

### What it does
When `BUG_SQLI` is enabled, the `/api/bugs/search` endpoint constructs SQL queries by directly interpolating user input into a string. When disabled, it uses parameterized queries.

### How to test
1. **Enable Bug 2** in Bug Lab
2. In the **SQL Injection Test Console**, try these payloads:
   - `alice@northstar.com` → returns only that user (normal behavior even when vulnerable)
   - `' OR '1'='1' --` → **all users in the database returned** (injection successful)
   - `' OR '1'='1` → same result (injection without comment terminator)
3. Observe the response:
   - **Vulnerable mode**: shows the raw SQL used, result count, full user table dump
   - Query displayed: `SELECT ... WHERE email = '' OR '1'='1' --'`
4. **Disable Bug 2**
5. Run the same payloads again
6. ✅ **Expected (bug OFF):** Returns 0 results — parameterized query treats the entire string as a literal email

### Modes
| Mode | Behavior |
|---|---|
| SAFE | Uses `.eq('email', query)` — Supabase parameterized query |
| VULNERABLE (with SUPABASE_DB_URL) | Executes raw `pg.query()` with string interpolation against live Postgres |
| VULNERABLE (without SUPABASE_DB_URL) | Simulates injection behavior — detects payload and returns all rows |

> **To get true raw SQL injection:** Add `SUPABASE_DB_URL=postgresql://postgres.[ref]:[password]@...` to `backend/.env`. Found in Supabase dashboard → Settings → Database → Connection String (Transaction mode).

---

## Phase 3 – Broken Access Control (IDOR)

### What it does
When `BUG_IDOR` is enabled, the account and transaction lookup endpoints do not verify that the requested resource belongs to the authenticated user. Any customer can read any other customer's account and transaction history.

### How to test
1. **Enable Bug 3** in Bug Lab
2. Click **"📋 List All Accounts"** → see all accounts in the system with owner names, emails, and IDs
3. Click any row to auto-fill the account ID field (pick an account that belongs to a **different** customer)
4. Click **"🔓 Fetch Account"**
5. ✅ **Expected (bug ON):** See the victim's:
   - Full name and email
   - Account number, balance, type, status
   - Last 10 transactions (amounts, descriptions, dates)
6. **Disable Bug 3**
7. Try fetching the same account ID again
8. ✅ **Expected (bug OFF):** `403 Access denied: this account does not belong to you.`

### Also works via customer API (for extra realism)
If logged in as a **Customer**, with bug ON, visit:
```
GET /api/customer/account?account_id=<victim_id>
GET /api/customer/transactions?account_id=<victim_id>
```
These endpoints skip the ownership check and return the victim's data.

---

## Risk Score Visibility

All events triggered by the Bug Lab are written to the **Supabase `security_events` table** and are immediately visible in the **Security** tab of the Manager dashboard.

The risk calculation system reads these events and their severities:
- `CRITICAL` → highest risk weight
- `HIGH` → elevated risk weight
- `MEDIUM` / `LOW` → standard weight

After running simulations, go to **Security** tab to see the full event log with timestamps and IP addresses.

---

## Server Restart Behavior
All bug flags are stored **in memory** on the backend server. They **automatically reset to OFF** on every server restart. This means:
- The platform is **always secure by default**
- Restarting the backend clears all active vulnerabilities
- This is the safest possible design for a simulation system

---

## Files

### bank-api (`apps/bank-api/`)
| File | Role |
|---|---|
| `src/config/bugFlags.js` | in-memory flag store (resets to `flags.json` on restart) |
| `src/config/pgClient.js` | raw pg pool for true SQLi (needs `SUPABASE_DB_URL`) |
| `src/config/env.js` | `SUPABASE_DB_URL`, `CRQ_BASE_URL`, `CRQ_ORG_ID` |
| `src/controllers/bugController.js` | all bug simulation logic + `CRQ_FLAG_MAP` |
| `src/controllers/authController.js` | Phase 1: MFA bypass when flag ON |
| `src/controllers/customerController.js` | Phase 3: IDOR in account/transactions |
| `src/services/crqClient.js` | emits `control.*` / `vuln.*` events to the CRQ engine |
| `src/routes/index.js` | `/api/bugs/*` routes |

### bank-web (`apps/bank-web/`)
| File | Role |
|---|---|
| `src/App.jsx` | Bug Lab / Security panels (Manager), MFA-bypass login handling |
| `src/CRQDashboard.jsx` | CRQ Dashboard tab — updates live when a flag is toggled |

Toggling a flag calls `POST /api/bugs/toggle`, which flips the flag **and** emits
the matching CRQ event so the risk engine recomputes EAL. See the
[root README](../README.md) §5 Scenario C.
