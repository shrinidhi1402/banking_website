import { supabaseAdmin } from '../config/supabase.js'
import { ApiError } from '../utils/errors.js'

/**
 * Authenticate every protected request.
 *
 * Flow:
 *  1. Extract Bearer token from the Authorization header.
 *  2. Verify the token with Supabase Auth (getUser validates the JWT signature).
 *  3. Obtain the authenticated user's VERIFIED EMAIL from the session.
 *  4. Look up the existing `users` table row by email – this is the source of truth
 *     for the application role (CUSTOMER / EMPLOYEE / MANAGER).
 *  5. Reject if the account is not ACTIVE.
 *
 * We deliberately do NOT use the Supabase Auth UUID as a FK into users.id
 * because users.id is a bigint serial and the two key spaces are unrelated.
 */
export async function authenticate(req, res, next) {
  try {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '')
    if (!token) throw new ApiError(401, 'Bearer token required')

    // Verify with Supabase Auth – this validates the JWT cryptographically
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !user) throw new ApiError(401, 'Invalid or expired session')

    // The verified email is the safe bridge between Supabase Auth and our users table
    const email = user.email
    if (!email) throw new ApiError(401, 'Session has no verified email')

    // Look up application profile by email (NOT by Auth UUID)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('id, name, email, phone, role, status, created_at, last_login')
      .eq('email', email)
      .single()

    if (profileError || !profile) throw new ApiError(403, 'User profile is not available')
    if (profile.status === 'LOCKED') throw new ApiError(403, 'Account is locked')
    if (profile.status === 'INACTIVE') throw new ApiError(403, 'Account is inactive')

    // Attach to request – controllers use req.auth.profile.role for authorization
    req.auth = { user, profile, token }
    next()
  } catch (error) {
    next(error)
  }
}

/**
 * Middleware factory: restrict a route to one or more roles.
 * Role is always read from req.auth.profile (populated from the DB above).
 * The frontend NEVER supplies the role.
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    const role = String(req.auth?.profile?.role ?? '').toUpperCase()
    if (!allowedRoles.map((r) => r.toUpperCase()).includes(role)) {
      return next(new ApiError(403, 'Insufficient permissions'))
    }
    next()
  }
}
