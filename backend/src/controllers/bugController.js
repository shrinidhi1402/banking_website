/**
 * bugController.js – Vulnerability Simulation Controller
 *
 * Northstar Banking – Internal Risk Assessment Platform
 * ─────────────────────────────────────────────────────
 * This controller powers the Bug Lab panel (Manager only).
 * It exposes three sets of endpoints:
 *
 *   GET  /api/bugs/flags           → current state of all flags
 *   POST /api/bugs/toggle          → enable/disable a bug flag
 *
 *   Phase 1 – MFA Bypass / Account Takeover
 *   POST /api/bugs/trigger/mfa-bypass  → simulate the attack trail
 *
 *   Phase 2 – SQL Injection
 *   POST /api/bugs/search          → vulnerable or safe query based on flag
 *
 *   Phase 3 – IDOR
 *   GET  /api/bugs/account         → fetch any account by ID (bypass ownership)
 *
 * All write endpoints require MANAGER role (enforced in routes/index.js).
 */

import { getBugFlags, isBugEnabled, toggleBugFlag } from '../config/bugFlags.js'
import { supabaseAdmin } from '../config/supabase.js'
import { getPgPool } from '../config/pgClient.js'
import { ApiError } from '../utils/errors.js'
import { emitCRQEvent } from '../services/crqClient.js'

// ─── Flag Management ──────────────────────────────────────────────────────────

/**
 * GET /api/bugs/flags
 * Returns the current state of all vulnerability flags.
 */
export function getFlags(req, res) {
  res.json({ flags: getBugFlags() })
}

/**
 * POST /api/bugs/toggle
 * Body: { flag: 'BUG_MFA' | 'BUG_SQLI' | 'BUG_IDOR' }
 * Toggles the requested flag and returns the new state.
 */
export function toggle(req, res, next) {
  try {
    const { flag } = req.body
    if (!flag) throw new ApiError(400, 'flag is required')
    const validFlags = ['BUG_MFA', 'BUG_SQLI', 'BUG_IDOR', 'BUG_EXCESSIVE_PRIVILEGES', 'BUG_SECRET_EXPOSURE']
    if (!validFlags.includes(flag)) throw new ApiError(400, `Invalid flag. Must be one of: ${validFlags.join(', ')}`)
    const newState = toggleBugFlag(flag)
    console.log(`[BugLab] ${flag} toggled → ${newState ? 'ON ⚠' : 'OFF ✓'} by Manager ${req.auth?.profile?.email}`)

    // --- CRQ Event Emission ---
    // Fire and forget CRQ event based on flag toggle
    try {
      if (flag === 'BUG_MFA') {
        const eventType = newState ? 'control.disabled' : 'control.enabled';
        emitCRQEvent(eventType, { control: "mfa", account_id: "admin-all", asset_id: "core-banking-db" });
      } else if (flag === 'BUG_SQLI') {
        const eventType = newState ? 'vuln.detected' : 'vuln.resolved';
        emitCRQEvent(eventType, { vulnerability_id: "BUG_SQLI", cve_id_or_description: "SQL Injection in customer search", asset_id: "bank-api", severity: "CRITICAL" });
      } else if (flag === 'BUG_IDOR') {
        const eventType = newState ? 'vuln.detected' : 'vuln.resolved';
        emitCRQEvent(eventType, { vulnerability_id: "BUG_IDOR", cve_id_or_description: "Broken Access Control (IDOR) on accounts", asset_id: "bank-api", severity: "HIGH" });
      }
    } catch (err) {
      console.error("[BugLab] Error emitting CRQ event:", err);
    }
    // --------------------------

    res.json({ flag, enabled: newState, flags: getBugFlags() })
  } catch (e) { next(e) }
}

// ─── Phase 1: MFA Bypass / Account Takeover ───────────────────────────────────

/**
 * POST /api/bugs/trigger/mfa-bypass
 * Body: { target_email: string }
 *
 * Simulates an account takeover attack trail:
 *  1. Records 4 rapid failed login attempts from a "foreign" IP
 *  2. Records a suspicious successful login with a different device
 *  3. Records ACCOUNT_TAKEOVER security event
 *  4. Records NO_MFA_CONFIGURED event to explain why MFA couldn't stop it
 *
 * This does NOT actually log in as the target — it writes realistic
 * security event data that the Manager Security panel will display.
 */
export async function triggerMfaBypass(req, res, next) {
  try {
    if (!isBugEnabled('BUG_MFA')) {
      throw new ApiError(400, 'BUG_MFA is not enabled. Enable it first to run this simulation.')
    }

    const { target_email } = req.body
    if (!target_email) throw new ApiError(400, 'target_email is required')

    // Look up the target user
    const { data: targetUser, error: userErr } = await supabaseAdmin
      .from('users')
      .select('id, name, email, role')
      .eq('email', target_email)
      .single()

    if (userErr || !targetUser) {
      throw new ApiError(404, `No user found with email: ${target_email}`)
    }

    if (targetUser.role === 'MANAGER') {
      throw new ApiError(400, 'Cannot simulate attack against a Manager account for safety reasons.')
    }

    const suspiciousIp  = '185.220.101.47' // known Tor exit node
    const attackerAgent = 'python-requests/2.31.0'
    const normalAgent   = req.get('user-agent') ?? 'Chrome on Windows'
    const now = new Date()

    // Step 1: Record 4 rapid failed login attempts from suspicious IP
    const failedLogins = []
    for (let i = 0; i < 4; i++) {
      const attemptTime = new Date(now.getTime() - (4 - i) * 12000) // 12s apart
      failedLogins.push({
        user_id: targetUser.id,
        ip_address: suspiciousIp,
        device: attackerAgent,
        success: false,
        failure_reason: 'Invalid credentials',
        created_at: attemptTime.toISOString(),
      })
    }

    const { error: loginErr } = await supabaseAdmin
      .from('login_events')
      .insert(failedLogins)

    if (loginErr) {
      console.error('[BugLab] Failed to insert login events:', loginErr)
      throw new ApiError(500, 'Database error during simulation')
    }

    // Step 2: Security event – brute force detected
    await supabaseAdmin.from('security_events').insert({
      user_id: targetUser.id,
      event_type: 'BRUTE_FORCE_DETECTED',
      severity: 'HIGH',
      description: `4 rapid failed login attempts for ${targetUser.email} from suspicious IP ${suspiciousIp} (Tor exit node)`,
      ip_address: suspiciousIp,
    })

    // Step 3: Record NO_MFA_CONFIGURED event — explains how bypass was possible
    await supabaseAdmin.from('security_events').insert({
      user_id: targetUser.id,
      event_type: 'NO_MFA_CONFIGURED',
      severity: 'CRITICAL',
      description: `Employee account ${targetUser.email} (${targetUser.role}) has no Multi-Factor Authentication configured. OTP step bypassed by vulnerability BUG_MFA.`,
      ip_address: suspiciousIp,
    })

    // Step 4: Successful login without MFA — from different IP (attacker got creds)
    await supabaseAdmin.from('login_events').insert({
      user_id: targetUser.id,
      ip_address: suspiciousIp,
      device: attackerAgent,
      success: true,
      failure_reason: null,
    })

    // Step 5: ACCOUNT_TAKEOVER security event
    await supabaseAdmin.from('security_events').insert({
      user_id: targetUser.id,
      event_type: 'ACCOUNT_TAKEOVER',
      severity: 'CRITICAL',
      description: `SIMULATED: Account ${targetUser.email} accessed without MFA verification. Session established from ${suspiciousIp} using automated tool (${attackerAgent}). No OTP challenge was issued due to MFA_BYPASS vulnerability.`,
      ip_address: suspiciousIp,
    })

    // Step 6: Suspicious login from new device
    await supabaseAdmin.from('security_events').insert({
      user_id: targetUser.id,
      event_type: 'SUSPICIOUS_LOGIN',
      severity: 'HIGH',
      description: `Login from new device/location: IP ${suspiciousIp}, agent: ${attackerAgent}. Previous logins used: ${normalAgent}`,
      ip_address: suspiciousIp,
    })

    // --- CRQ Event Emission ---
    try {
      emitCRQEvent('incident.detected', {
        type: 'ACCOUNT_TAKEOVER_SIMULATION',
        asset_id: `user-account-${targetUser.id}`,
        details: `Simulated attack on ${targetUser.email}`
      });
    } catch (err) {
      console.error("[BugLab] Error emitting CRQ event:", err);
    }
    // --------------------------

    res.json({
      success: true,
      simulation: 'MFA_BYPASS',
      target: { id: targetUser.id, email: targetUser.email, role: targetUser.role },
      events_generated: [
        '4x FAILED_LOGIN from suspicious IP 185.220.101.47',
        'BRUTE_FORCE_DETECTED (HIGH)',
        'NO_MFA_CONFIGURED (CRITICAL)',
        'Successful login without OTP',
        'ACCOUNT_TAKEOVER (CRITICAL)',
        'SUSPICIOUS_LOGIN (HIGH)',
      ],
      message: `Attack simulation complete. Check the Security panel to see ${6} new events for ${targetUser.email}.`,
    })
  } catch (e) { next(e) }
}

// ─── Phase 2: SQL Injection ────────────────────────────────────────────────────

/**
 * POST /api/bugs/search
 * Body: { query: string }
 *
 * When BUG_SQLI is OFF: uses Supabase parameterized query (safe)
 * When BUG_SQLI is ON : uses raw pg query with DIRECT STRING INTERPOLATION
 *                       making it genuinely vulnerable to SQL injection.
 *
 * Try payloads like:
 *   - Normal:   alice@example.com
 *   - SQLi:     ' OR '1'='1' --
 *   - SQLi:     ' UNION SELECT id,email,password_hash,role,status,created_at,last_login,phone FROM users --
 *   - Time:     '; SELECT pg_sleep(3); --
 */
export async function sqlSearch(req, res, next) {
  try {
    const { query } = req.body
    if (query === undefined || query === null) throw new ApiError(400, 'query is required')

    const bugOn = isBugEnabled('BUG_SQLI')

    if (!bugOn) {
      // ── SECURE PATH: Supabase parameterized query ──────────────────────────
      const { data, error } = await supabaseAdmin
        .from('users')
        .select('id, name, email, role, status, created_at')
        .eq('email', query)
        .limit(20)

      if (error) throw new ApiError(500, 'Database error')

      return res.json({
        mode: 'SAFE',
        bug_enabled: false,
        query_used: `SELECT id, name, email, role, status FROM users WHERE email = $1  -- parameterized`,
        result_count: data.length,
        results: data,
        note: 'Parameterized query — input is never interpolated into SQL.',
      })
    }

    // ── VULNERABLE PATH: Raw string interpolation ────────────────────────────
    const pool = getPgPool()

    if (!pool) {
      // Fallback: simulate the attack using Supabase PostgREST filter manipulation
      // This demonstrates the principle even without a direct pg connection
      let data, error, sqlNote

      // Attempt to replicate injection logic via Supabase .or() — demonstrates
      // that normally the .eq() guard stops this but raw APIs don't
      if (query.includes("'") || query.toLowerCase().includes('or') || query.includes('--')) {
        // Simulated injection: "return all rows" behavior
        const result = await supabaseAdmin
          .from('users')
          .select('id, name, email, role, status, created_at')
          .limit(50)
        data  = result.data
        error = result.error
        sqlNote = `⚠ VULNERABLE (simulated): Raw query constructed as: SELECT * FROM users WHERE email = '${query}' — injection payload caused all-rows return. (Set SUPABASE_DB_URL for true raw SQL execution.)`
      } else {
        const result = await supabaseAdmin
          .from('users')
          .select('id, name, email, role, status, created_at')
          .eq('email', query)
          .limit(20)
        data  = result.data
        error = result.error
        sqlNote = `⚠ VULNERABLE (simulated): SELECT * FROM users WHERE email = '${query}'  -- no parameterization`
      }

      if (error) throw new ApiError(500, 'Database error')

      return res.json({
        mode: 'VULNERABLE',
        bug_enabled: true,
        query_used: sqlNote,
        result_count: data.length,
        results: data,
        warning: 'SQL INJECTION VULNERABILITY ACTIVE. Input was directly interpolated into query string.',
        note: 'Add SUPABASE_DB_URL to .env for true raw pg SQL execution.',
      })
    }

    // True raw SQL injection via node-postgres
    const startTime = Date.now()
    try {
      // !! INTENTIONALLY VULNERABLE — never do this in production !!
      const rawSql = `SELECT id, name, email, role, status, created_at FROM users WHERE email = '${query}' LIMIT 50`
      console.warn(`[BugLab] EXECUTING VULNERABLE QUERY: ${rawSql}`)
      
      const result = await pool.query(rawSql)
      const elapsed = Date.now() - startTime

      res.json({
        mode: 'VULNERABLE',
        bug_enabled: true,
        query_used: rawSql,
        result_count: result.rows.length,
        results: result.rows,
        elapsed_ms: elapsed,
        warning: '⚠ SQL INJECTION VULNERABILITY ACTIVE. User input was directly interpolated into the query string. This query executed against the live database with NO sanitization.',
      })
    } catch (pgErr) {
      // Return the raw DB error — this itself is an information disclosure vulnerability
      res.status(500).json({
        mode: 'VULNERABLE',
        bug_enabled: true,
        query_used: `SELECT ... WHERE email = '${query}'`,
        db_error: pgErr.message,  // intentionally exposing the DB error
        warning: '⚠ DATABASE ERROR EXPOSED: In a vulnerable system, DB errors reveal schema information to attackers.',
      })
    }
  } catch (e) { next(e) }
}

// ─── Phase 3: IDOR – Broken Access Control ───────────────────────────────────

/**
 * GET /api/bugs/account?account_id=<id>
 *
 * When BUG_IDOR is OFF: enforces ownership — only returns the caller's own account
 * When BUG_IDOR is ON : returns ANY account by ID regardless of who owns it
 *
 * This simulates an IDOR where the authorization check is missing.
 */
export async function idorAccount(req, res, next) {
  try {
    const { account_id } = req.query
    if (!account_id) throw new ApiError(400, 'account_id query parameter is required')

    const id = parseInt(account_id, 10)
    if (isNaN(id)) throw new ApiError(400, 'account_id must be a valid integer')

    const bugOn = isBugEnabled('BUG_IDOR')
    const callerId = req.auth.profile.id

    if (!bugOn) {
      // ── SECURE PATH: enforce ownership ────────────────────────────────────
      const { data, error } = await supabaseAdmin
        .from('accounts')
        .select('id, account_number, account_type, balance, status, created_at, user_id')
        .eq('id', id)
        .eq('user_id', callerId)  // ← authorization check
        .single()

      if (error?.code === 'PGRST116' || !data) {
        throw new ApiError(403, 'Access denied: this account does not belong to you.')
      }
      if (error) throw new ApiError(500, 'Database error')

      return res.json({
        mode: 'SECURE',
        bug_enabled: false,
        note: 'Authorization check enforced: account_id must match authenticated user.',
        account: data,
      })
    }

    // ── VULNERABLE PATH: no ownership check ──────────────────────────────────
    console.warn(`[BugLab] IDOR: user ${callerId} accessing account ${id} without ownership check`)

    const { data: account, error: accErr } = await supabaseAdmin
      .from('accounts')
      .select('id, account_number, account_type, balance, status, created_at, user_id')
      .eq('id', id)
      .single()

    if (accErr?.code === 'PGRST116' || !account) {
      throw new ApiError(404, `No account found with id: ${id}`)
    }
    if (accErr) throw new ApiError(500, 'Database error')

    // Also fetch the victim's personal info (further escalation)
    const { data: ownerProfile } = await supabaseAdmin
      .from('users')
      .select('id, name, email, phone, role, status')
      .eq('id', account.user_id)
      .single()

    // Also fetch their recent transactions
    const { data: txs } = await supabaseAdmin
      .from('transactions')
      .select('id, amount, transaction_type, description, status, created_at')
      .or(`sender_account_id.eq.${id},receiver_account_id.eq.${id}`)
      .order('created_at', { ascending: false })
      .limit(10)

    res.json({
      mode: 'VULNERABLE',
      bug_enabled: true,
      warning: '⚠ IDOR VULNERABILITY ACTIVE: No authorization check. Any authenticated user can access any account.',
      accessed_by: { user_id: callerId, email: req.auth.profile.email },
      account: account,
      account_owner: ownerProfile,
      recent_transactions: txs || [],
    })
  } catch (e) { next(e) }
}

/**
 * GET /api/bugs/accounts/list
 * When BUG_IDOR is ON: returns ALL accounts in the system (object enumeration)
 * Useful for finding target account IDs to exploit.
 */
export async function idorListAccounts(req, res, next) {
  try {
    if (!isBugEnabled('BUG_IDOR')) {
      throw new ApiError(400, 'BUG_IDOR is not enabled.')
    }

    const { data, error } = await supabaseAdmin
      .from('accounts')
      .select('id, account_number, account_type, user_id, users!inner(name, email)')
      .order('id')
      .limit(100)

    if (error) throw new ApiError(500, 'Database error')

    res.json({
      mode: 'VULNERABLE',
      bug_enabled: true,
      warning: '⚠ IDOR VULNERABILITY ACTIVE: Full account enumeration exposed. An attacker can now pick any account_id to exploit.',
      total_accounts: data.length,
      accounts: data,
    })
  } catch (e) { next(e) }
}

// ─── Phase 4: Excessive Privileges / Insider Threat ──────────────────────────

/**
 * GET /api/bugs/insider-threat
 * 
 * When BUG_EXCESSIVE_PRIVILEGES is OFF: returns simulation disabled.
 * When BUG_EXCESSIVE_PRIVILEGES is ON: verifies EMPLOYEE role, simulates excessive access, 
 * logs EXCESSIVE_PRIVILEGE_DETECTED.
 */
export async function insiderThreat(req, res, next) {
  try {
    const bugOn = isBugEnabled('BUG_EXCESSIVE_PRIVILEGES')
    
    if (!bugOn) {
      return res.json({
        mode: 'SECURE',
        bug_enabled: false,
        note: 'Simulation disabled.'
      })
    }

    const callerId = req.auth.profile.id
    const callerRole = req.auth.profile.role

    if (callerRole !== 'EMPLOYEE') {
      throw new ApiError(403, 'This simulation requires logging in as an EMPLOYEE.')
    }

    console.warn(`[BugLab] INSIDER THREAT: Employee ${req.auth.profile.email} accessing restricted data`)

    // Log the security event
    await supabaseAdmin.from('security_events').insert({
      user_id: callerId,
      event_type: 'EXCESSIVE_PRIVILEGE_DETECTED',
      severity: 'HIGH',
      description: `SIMULATED: Employee ${req.auth.profile.email} bypassed role restrictions and accessed sensitive customer data due to excessive privileges.`,
      ip_address: req.ip || '127.0.0.1',
    })

    // Fetch demo sanitized data that an employee shouldn't normally see in bulk
    const { data: sensitiveData, error } = await supabaseAdmin
      .from('users')
      .select('id, name, email, role, status')
      .in('role', ['MANAGER', 'EMPLOYEE'])
      .limit(10)

    if (error) throw new ApiError(500, 'Database error')

    res.json({
      mode: 'VULNERABLE',
      bug_enabled: true,
      warning: '⚠ EXCESSIVE PRIVILEGES VULNERABILITY ACTIVE: Role bounds bypassed.',
      accessed_by: { user_id: callerId, email: req.auth.profile.email, role: callerRole },
      sensitive_data_exposed: sensitiveData,
      message: 'Logged EXCESSIVE_PRIVILEGE_DETECTED security event.'
    })
  } catch (e) { next(e) }
}

// ─── Phase 5: Client-Side Secret Exposure (CWE-798) ───────────────────────────

/**
 * GET /api/bugs/secret
 *
 * When BUG_SECRET_EXPOSURE is OFF : returns 404 — endpoint does not advertise itself.
 * When BUG_SECRET_EXPOSURE is ON  : returns a controlled response containing a
 *   clearly fake, non-functional credential for educational demonstration.
 *
 * SAFETY NOTE: This endpoint NEVER reads, copies, or returns any real environment
 * variable, Supabase service-role key, JWT secret, or production credential.
 * The values below are intentionally fictional and exist solely for the Bug Lab
 * simulation of CWE-798 (Use of Hard-coded Credentials).
 */
export async function secretExposure(req, res, next) {
  try {
    if (!isBugEnabled('BUG_SECRET_EXPOSURE')) {
      // When OFF: behave as though the endpoint does not exist
      throw new ApiError(404, 'Not found')
    }

    const callerId = req.auth.profile.id
    console.warn(`[BugLab] CLIENT_SIDE_SECRET_EXPOSURE: /api/bugs/secret accessed by ${req.auth.profile.email}`)

    // Log the security event (once per access)
    await supabaseAdmin.from('security_events').insert({
      user_id: callerId,
      event_type: 'CLIENT_SIDE_SECRET_EXPOSURE',
      severity: 'CRITICAL',
      description: 'Sensitive client-side configuration was accessed while the vulnerability was active.',
      ip_address: req.ip || '127.0.0.1',
    })

    // *** FAKE CREDENTIAL ONLY — NOT A REAL KEY ***
    // This string is intentionally non-functional and exists exclusively for
    // the BugLab / SIH security-demonstration environment.
    res.json({
      mode: 'VULNERABLE',
      vulnerability: 'CLIENT_SIDE_SECRET_EXPOSURE',
      cwe: 'CWE-798',
      credential_name: 'FAKE_SUPABASE_SERVICE_ROLE_KEY',
      credential: 'BUGLAB_FAKE_ONLY_NOT_A_REAL_CREDENTIAL',
      flag: 'FLAG{CLIENT_SIDE_SECRET_EXPOSURE}',
      warning: '⚠ SIMULATED: This is a fake credential for the Risk Assessment Platform demo. No real secret is exposed.',
    })
  } catch (e) { next(e) }
}
