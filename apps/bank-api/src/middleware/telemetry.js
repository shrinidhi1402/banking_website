import { supabaseAdmin } from '../config/supabase.js'

/**
 * Record an action taken by an authenticated user in audit_logs.
 * Only called from protected routes where req.auth is already populated.
 */
export async function recordAudit(req, action, resource, resourceId, extra = {}) {
  const { error } = await supabaseAdmin.from('audit_logs').insert({
    user_id: req.auth.profile.id,        // integer from users table
    action,
    resource,
    resource_id: resourceId ?? null,
    role: req.auth.profile.role,
    ip_address: req.ip,
    ...extra,
  })
  if (error) console.error('audit_logs insert failed:', error.message)
}

/**
 * Record a notable security event in security_events.
 * severity must be one of: LOW | MEDIUM | HIGH | CRITICAL
 */
export async function recordSecurity(req, eventType, severity = 'LOW', description = '') {
  // Guard: map legacy 'INFO' (invalid in DB) to LOW
  const safeSeverity = severity === 'INFO' ? 'LOW' : severity
  const { error } = await supabaseAdmin.from('security_events').insert({
    user_id: req.auth?.profile?.id ?? null,   // integer; nullable for pre-auth events
    event_type: eventType,
    severity: safeSeverity,
    description: description || null,
    ip_address: req.ip,
  })
  if (error) console.error('security_events insert failed:', error.message)
}

/**
 * Record a login attempt in login_events.
 * userId is the integer users.id (or null for attempts where no profile exists).
 */
export async function recordLogin({ userId, success, req, reason }) {
  const { error } = await supabaseAdmin.from('login_events').insert({
    user_id: userId ?? null,              // integer users.id, nullable
    ip_address: req.ip,
    device: req.get('user-agent') ?? null,
    success,
    failure_reason: reason ?? null,
  })
  if (error) console.error('login_events insert failed:', error.message)
}
