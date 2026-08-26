import { supabaseAdmin, supabaseAuth } from '../config/supabase.js'
import { ApiError } from '../utils/errors.js'
import { parse } from '../utils/validation.js'
import { recordLogin } from '../middleware/telemetry.js'
import { z } from 'zod'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

/**
 * POST /api/auth/login
 *
 * Flow:
 *  1. Validate input.
 *  2. Sign in via Supabase Auth (password verification done by Auth).
 *  3. Use the VERIFIED EMAIL from the session to find the users row.
 *  4. Reject LOCKED / INACTIVE accounts.
 *  5. Return access_token + sanitised application profile (no password_hash, no secrets).
 */
export async function login(req, res, next) {
  try {
    const credentials = parse(loginSchema, req.body)

    // Step 2: Supabase Auth verifies the password
    const { data, error } = await supabaseAuth.auth.signInWithPassword(credentials)
    if (error || !data.user || !data.session) {
      await recordLogin({ success: false, req, reason: error?.message ?? 'Invalid credentials' })
      throw new ApiError(401, 'Invalid email or password')
    }

    // Step 3: find application profile by verified email (NOT by auth UUID)
    const email = data.user.email
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('id, name, email, phone, role, status, created_at, last_login')
      .eq('email', email)
      .single()

    if (profileError || !profile) {
      // Auth succeeded but no matching users row – record failure and reject
      await recordLogin({ success: false, req, reason: 'No application profile for this account' })
      await supabaseAdmin.auth.admin.signOut(data.session.access_token)
      throw new ApiError(403, 'No application profile is associated with this account')
    }

    // Step 4: status checks
    if (profile.status === 'LOCKED') {
      await recordLogin({ userId: profile.id, success: false, req, reason: 'Account locked' })
      // Direct insert: req.auth is not set yet at login time, so we cannot use recordSecurity(req, ...)
      await supabaseAdmin.from('security_events').insert({
        user_id: profile.id, event_type: 'SUSPICIOUS_LOGIN', severity: 'HIGH',
        description: 'Login attempt on locked account', ip_address: req.ip,
      })
      await supabaseAdmin.auth.admin.signOut(data.session.access_token)
      throw new ApiError(403, 'Account is locked. Contact your administrator.')
    }
    if (profile.status === 'INACTIVE') {
      await recordLogin({ userId: profile.id, success: false, req, reason: 'Account inactive' })
      await supabaseAdmin.auth.admin.signOut(data.session.access_token)
      throw new ApiError(403, 'Account is inactive.')
    }

    // Step 5: success – record and respond (no password_hash in response)
    await recordLogin({ userId: profile.id, success: true, req })

    res.json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
      user: profile,                               // password_hash excluded by SELECT
    })
  } catch (error) {
    next(error)
  }
}

/**
 * POST /api/auth/logout
 */
export async function logout(req, res, next) {
  try {
    const { error } = await supabaseAdmin.auth.admin.signOut(req.auth.token)
    if (error) throw new ApiError(400, 'Unable to end session')
    res.status(204).send()
  } catch (error) {
    next(error)
  }
}

/**
 * GET /api/auth/me
 * Returns the authenticated user's application profile.
 * password_hash is never selected; no secrets are returned.
 */
export function me(req, res) {
  // req.auth.profile already has password_hash excluded (see authenticate middleware SELECT)
  res.json({ user: req.auth.profile })
}

// eslint-disable-next-line no-unused-vars
const _zPassword = z.object({ new_password: z.string().min(8).max(128) })
