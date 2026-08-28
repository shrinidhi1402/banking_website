import { supabaseAdmin, supabaseAuth } from '../config/supabase.js'
import { ApiError } from '../utils/errors.js'
import { parse } from '../utils/validation.js'
import { recordLogin } from '../middleware/telemetry.js'
import { z } from 'zod'
import crypto from 'crypto'
import { env } from '../config/env.js'
import { sendOtpEmail } from '../services/emailService.js'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

const verifyOtpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  challenge_id: z.string().uuid(),
  otp: z.string().length(6),
})

const resendOtpSchema = z.object({
  challenge_id: z.string().uuid(),
  email: z.string().email(),
})

/**
 * POST /api/auth/login
 *
 * Flow:
 *  1. Validate input.
 *  2. Sign in via Supabase Auth to verify credentials.
 *  3. Immediately sign out to invalidate session during MFA.
 *  4. Verify application profile status.
 *  5. Generate and store OTP, and return challenge_id.
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

    // Step 3: Immediately invalidate the temporary Supabase session
    // Note: While this signs out the user on the backend, the JWT access_token itself 
    // remains cryptographically valid until expiry. We NEVER return it to the frontend here.
    await supabaseAdmin.auth.admin.signOut(data.session.access_token)

    // Step 4: find application profile by verified email (NOT by auth UUID)
    const email = data.user.email
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('id, name, email, phone, role, status, created_at, last_login')
      .eq('email', email)
      .single()

    if (profileError || !profile) {
      await recordLogin({ success: false, req, reason: 'No application profile for this account' })
      throw new ApiError(403, 'No application profile is associated with this account')
    }

    if (profile.status === 'LOCKED') {
      await recordLogin({ userId: profile.id, success: false, req, reason: 'Account locked' })
      const { error: secErr } = await supabaseAdmin.from('security_events').insert({
        user_id: profile.id, event_type: 'SUSPICIOUS_LOGIN', severity: 'HIGH',
        description: 'Login attempt on locked account', ip_address: req.ip,
      })
      if (secErr) { console.error('Failed to insert security event:', secErr); throw new ApiError(500, 'Database error') }
      throw new ApiError(403, 'Account is locked. Contact your administrator.')
    }
    if (profile.status === 'INACTIVE') {
      await recordLogin({ userId: profile.id, success: false, req, reason: 'Account inactive' })
      throw new ApiError(403, 'Account is inactive.')
    }

    // Step 5: Generate secure 6-digit OTP
    const otp = crypto.randomInt(100000, 1000000).toString()
    const otpHash = crypto.createHmac('sha256', env.OTP_SECRET).update(otp).digest('hex')
    const challengeId = crypto.randomUUID()
    
    // Invalidate old challenges by setting used = true for this user
    const { error: invErr } = await supabaseAdmin.from('otp_challenges').update({ used: true }).eq('user_id', profile.id)
    if (invErr) { console.error('Failed to invalidate old challenges:', invErr); throw new ApiError(500, 'Database error') }

    // Store new challenge
    const expiresAt = new Date(Date.now() + 5 * 60000).toISOString()
    const { error: insertErr } = await supabaseAdmin.from('otp_challenges').insert({
      id: challengeId,
      user_id: profile.id,
      otp_hash: otpHash,
      expires_at: expiresAt,
      attempts: 0,
      used: false
    })
    if (insertErr) { console.error('Failed to insert challenge:', insertErr); throw new ApiError(500, 'Database error') }

    // Send email
    try {
      await sendOtpEmail({ name: profile.name, email: profile.email, passcode: otp })
    } catch (err) {
      console.error(err)
      throw new ApiError(500, 'Failed to send OTP email')
    }

    const { error: secErr } = await supabaseAdmin.from('security_events').insert({
      user_id: profile.id, event_type: 'MFA_CHALLENGE_CREATED', severity: 'LOW',
      description: 'MFA challenge generated and sent', ip_address: req.ip,
    })
    if (secErr) { console.error('Failed to insert security event:', secErr); throw new ApiError(500, 'Database error') }

    res.json({
      mfa_required: true,
      challenge_id: challengeId
    })
  } catch (error) {
    next(error)
  }
}

export async function verifyOtp(req, res, next) {
  try {
    const { email, password, challenge_id, otp } = parse(verifyOtpSchema, req.body)

    // 1. Fetch challenge
    const { data: challenge, error: challengeError } = await supabaseAdmin
      .from('otp_challenges')
      .select('*, users!inner(email)')
      .eq('id', challenge_id)
      .single()
    
    if (challengeError || !challenge) {
      throw new ApiError(400, 'Invalid challenge')
    }

    if (challenge.users.email !== email) {
      throw new ApiError(400, 'Challenge does not match user')
    }

    if (challenge.used) {
      throw new ApiError(400, 'Challenge has already been used or invalidated')
    }

    if (new Date() > new Date(challenge.expires_at)) {
      throw new ApiError(400, 'OTP has expired. Please request a new code.')
    }

    if (challenge.attempts >= 5) {
      throw new ApiError(400, 'Too many incorrect attempts. Please login again.')
    }

    const providedHash = crypto.createHmac('sha256', env.OTP_SECRET).update(otp).digest('hex')
    const isValid = crypto.timingSafeEqual(Buffer.from(providedHash), Buffer.from(challenge.otp_hash))

    if (!isValid) {
      const { error: attErr } = await supabaseAdmin.from('otp_challenges').update({ attempts: challenge.attempts + 1 }).eq('id', challenge_id)
      if (attErr) { console.error('Failed to increment attempts:', attErr); throw new ApiError(500, 'Database error') }

      if (challenge.attempts + 1 >= 5) {
        const { error: invErr } = await supabaseAdmin.from('otp_challenges').update({ used: true }).eq('id', challenge_id)
        if (invErr) { console.error('Failed to invalidate challenge:', invErr); throw new ApiError(500, 'Database error') }
        
        const { error: secErr } = await supabaseAdmin.from('security_events').insert({
          user_id: challenge.user_id, event_type: 'MFA_ATTEMPT_LIMIT_EXCEEDED', severity: 'HIGH',
          description: 'Too many incorrect OTP attempts', ip_address: req.ip,
        })
        if (secErr) { console.error('Failed to record security event:', secErr); throw new ApiError(500, 'Database error') }
      }
      throw new ApiError(400, 'Invalid verification code')
    }

    // OTP is valid. Atomically mark as used.
    const { data: updateData, error: updateError } = await supabaseAdmin
      .from('otp_challenges')
      .update({ used: true })
      .eq('id', challenge_id)
      .eq('used', false)
      .select()

    if (updateError || !updateData || updateData.length === 0) {
      throw new ApiError(400, 'Challenge has already been used or invalidated')
    }

    // Authenticate with Supabase to get the real session
    const { data, error } = await supabaseAuth.auth.signInWithPassword({ email, password })
    if (error || !data.user || !data.session) {
      throw new ApiError(401, 'Credentials expired or invalid during MFA verification')
    }

    // Get user profile again just to be safe
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('id, name, email, phone, role, status, created_at, last_login')
      .eq('email', email)
      .single()

    if (profileError || !profile) {
      await supabaseAdmin.auth.admin.signOut(data.session.access_token)
      console.error('Failed to fetch profile after MFA:', profileError)
      throw new ApiError(500, 'Database error')
    }

    if (profile.status === 'LOCKED' || profile.status === 'INACTIVE') {
      await supabaseAdmin.auth.admin.signOut(data.session.access_token)
      throw new ApiError(403, 'Account is locked or inactive.')
    }

    await recordLogin({ userId: profile.id, success: true, req })
    const { error: secErr } = await supabaseAdmin.from('security_events').insert({
      user_id: profile.id, event_type: 'MFA_VERIFICATION_SUCCESS', severity: 'LOW',
      description: 'MFA verification completed successfully', ip_address: req.ip,
    })
    if (secErr) { console.error('Failed to record security event:', secErr); throw new ApiError(500, 'Database error') }

    res.json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
      user: profile,
    })
  } catch (error) {
    next(error)
  }
}

export async function resendOtp(req, res, next) {
  try {
    const { challenge_id, email } = parse(resendOtpSchema, req.body)

    const { data: oldChallenge, error: oldError } = await supabaseAdmin
      .from('otp_challenges')
      .select('*, users!inner(email, name)')
      .eq('id', challenge_id)
      .single()
    
    if (oldError || !oldChallenge || oldChallenge.users.email !== email) {
      throw new ApiError(400, 'Invalid challenge')
    }

    if (oldChallenge.used) {
      throw new ApiError(400, 'Challenge has already been used or invalidated')
    }

    if (new Date() > new Date(oldChallenge.expires_at)) {
      throw new ApiError(400, 'Challenge has expired. Please log in again.')
    }

    // Rate limiting: check if last challenge was created < 60 seconds ago
    const timeSinceLast = Date.now() - new Date(oldChallenge.created_at).getTime()
    if (timeSinceLast < 60000) {
      throw new ApiError(429, 'Please wait 60 seconds before requesting a new code')
    }

    // Invalidate old
    const { error: invErr } = await supabaseAdmin.from('otp_challenges').update({ used: true }).eq('user_id', oldChallenge.user_id)
    if (invErr) { console.error('Failed to invalidate old challenges:', invErr); throw new ApiError(500, 'Database error') }

    // Generate new OTP
    const otp = crypto.randomInt(100000, 1000000).toString()
    const otpHash = crypto.createHmac('sha256', env.OTP_SECRET).update(otp).digest('hex')
    const newChallengeId = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 5 * 60000).toISOString()
    
    const { error: insErr } = await supabaseAdmin.from('otp_challenges').insert({
      id: newChallengeId,
      user_id: oldChallenge.user_id,
      otp_hash: otpHash,
      expires_at: expiresAt,
      attempts: 0,
      used: false
    })
    if (insErr) { console.error('Failed to insert new challenge:', insErr); throw new ApiError(500, 'Database error') }

    await sendOtpEmail({ name: oldChallenge.users.name, email: oldChallenge.users.email, passcode: otp })

    res.json({ challenge_id: newChallengeId })
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
