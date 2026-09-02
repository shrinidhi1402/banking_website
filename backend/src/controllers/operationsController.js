import { supabaseAdmin } from '../config/supabase.js'
import { ApiError, assertNoDatabaseError } from '../utils/errors.js'
import { parse, requestDecisionSchema } from '../utils/validation.js'
import { recordAudit, recordSecurity } from '../middleware/telemetry.js'
import { getOne, getRows, updateOne } from '../services/dataService.js'
import { isBugEnabled } from '../config/bugFlags.js'
import { z } from 'zod'
import { emitCRQEvent } from '../services/crqClient.js'

// Shorthand: integer user id from the application users table
const uid = (req) => req.auth.profile.id

const list = (table, filter) => async (req, res, next) => {
  try { res.json(await getRows(table, filter?.(req))) } catch (e) { next(e) }
}

export const employeeDashboard      = list('users', () => (q) => q.eq('role', 'CUSTOMER').select('id'))

/**
 * GET /api/employee/customers?search=<term>
 *
 * SECURE (BUG_SQLI=OFF): uses Supabase parameterized .ilike() filter.
 * VULNERABLE (BUG_SQLI=ON): when a ?search= param is present, the search
 *   term is directly interpolated into a PostgREST filter string with no
 *   sanitization. Payloads like " OR role=eq.MANAGER" expose privileged
 *   records. Logs a security event every time the vulnerability fires.
 */
export async function employeeCustomers(req, res, next) {
  try {
    const search = req.query.search

    // ── PHASE 2 BUG: SQL INJECTION ─────────────────────────────────────
    // When BUG_SQLI is ON and ?search= is provided, the value is used
    // DIRECTLY to build a PostgREST filter without validation. An attacker
    // (or curious employee) can enumerate all users of any role, reveal
    // email addresses and statuses of accounts they should never see.
    if (search && isBugEnabled('BUG_SQLI')) {
      console.warn(`[BugLab] ⚠ SQL INJECTION ACTIVE: raw search param = "${search}"`)

      // Build a dangerously permissive query using raw Supabase .or()
      // The input is not sanitized — role/email/status filters can be injected.
      // Example safe: search="john" -> filter on name
      // Example attack: search=" OR role=eq.MANAGER" -> exposes all managers
      let query = supabaseAdmin
        .from('users')
        .select('id, name, email, role, status, phone, created_at')
        .order('created_at', { ascending: false })
        .limit(100)

      // Vulnerable: directly apply whatever the user typed as a text search
      // against email and name with NO input validation
      if (search.includes('@')) {
        // Looks like an email — search by exact email (no sanitization)
        query = query.ilike('email', `%${search}%`)
      } else if (search.toLowerCase().startsWith('role=') || search.toLowerCase().startsWith('status=')) {
        // Injection detected: search is trying to filter by role/status
        // A secure system would reject this. A vulnerable one executes it.
        const [field, value] = search.split('=')
        query = query.eq(field.trim(), value.trim())
      } else {
        // Default: name search — still no sanitization of special chars
        query = query.ilike('name', `%${search}%`)
      }

      const { data, error } = await query
      if (error) throw new ApiError(500, 'Database error')

      // Record that the injection fired
      await supabaseAdmin.from('security_events').insert({
        user_id: req.auth?.profile?.id ?? null,
        event_type: 'SQL_INJECTION_ATTEMPT',
        severity: 'HIGH',
        description: `Employee search endpoint received unsanitized input: "${search.slice(0, 120)}". BUG_SQLI is active — raw filter executed against users table. ${data.length} row(s) returned.`,
        ip_address: req.ip,
      })

      return res.json(data)
    }
    // ── END BUG PHASE 2 (normal secure path below) ──────────────────────

    // SECURE PATH: parameterized ilike filter
    let q = supabaseAdmin
      .from('customer_profiles')
      .select('*, users!inner(id, name, email, status)')
      .order('created_at', { ascending: false })

    if (search) {
      q = q.or(`users.name.ilike.%${search}%,users.email.ilike.%${search}%`)
    }

    const { data, error } = await q
    if (error) throw new ApiError(500, 'Database error')
    res.json(data)
  } catch (e) { next(e) }
}

export const managerCustomers       = employeeCustomers
export const employeeCustomer       = (req, res, next) => {
  return getOne('customer_profiles', (q) => q.select('*, users!inner(id, name, email, status, phone)').eq('id', req.params.id))
    .then(data => res.json(data)).catch(next)
}
export const managerCustomer        = employeeCustomer
export const employeeTransactions   = list('transactions', () => (q) => q.select('*, sender:accounts!sender_account_id(account_number, users(name)), receiver:accounts!receiver_account_id(account_number, users(name)))').order('created_at', { ascending: false }))
export const employeeRequests       = list('requests', () => (q) => q.select('*, users!requests_user_id_fkey(id, name, email)').order('created_at', { ascending: false }))
export const managerEmployees       = list('employee_profiles', () => (q) => q.select('*, users!inner(id, name, email, status, role)').order('created_at', { ascending: false }))
export const managerTransactions    = employeeTransactions
export const managerRequests        = employeeRequests
export const securityEvents         = list('security_events', () => (q) => q.order('created_at', { ascending: false }))


export const employeeProfile = (req, res) => res.json(req.auth.profile)
export const managerProfile = async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('manager_profiles')
      .select('*, users!inner(id, name, email, phone, role, status)')
      .eq('user_id', req.auth.profile.id)
      .single()
    // If no manager_profiles row exists for this user, fall back to the base users profile
    if (error?.code === 'PGRST116') return res.json(req.auth.profile)
    assertNoDatabaseError(error, 'Unable to load manager profile')
    // Merge: spread users fields first, then manager_profiles fields on top
    const { users: userRow, ...profileFields } = data
    res.json({ ...req.auth.profile, ...userRow, ...profileFields })
  } catch (e) { next(e) }
}

export async function updateOwnProfile(req, res, next) {
  try {
    const table = req.auth.profile.role === 'EMPLOYEE' ? 'employee_profiles' : 'manager_profiles'
    // Filter by user_id (integer FK) – use profile.id, not auth UUID
    const { data, error } = await supabaseAdmin.from(table).update(req.body).eq('user_id', uid(req)).select().single()
    if (error?.code === 'PGRST116') throw new ApiError(404, 'Profile not found')
    assertNoDatabaseError(error, 'Unable to update profile')
    await recordAudit(req, 'UPDATE_PROFILE', table, data.id)
    res.json(data)
  } catch (error) { next(error) }
}

export const suspiciousTransactions = list('transactions', () => (q) => q.gte('amount', 10000).order('created_at', { ascending: false }))

export const reports = async (req, res, next) => {
  try {
    const [transactions, accounts, customers, employees, requests] = await Promise.all([
      getRows('transactions'),
      getRows('accounts'),
      getRows('customer_profiles'),
      getRows('employee_profiles'),
      getRows('requests'),
    ])
    const suspiciousCount  = transactions.filter(t => t.amount >= 10000).length
    const pendingReqCount  = requests.filter(r => r.status === 'PENDING').length
    const totalDeposits    = accounts.reduce((sum, item) => sum + Number(item.balance ?? 0), 0)
    res.json({
      generated_at: new Date().toISOString(),
      totals: {
        transactions:          transactions.length,
        deposits:              totalDeposits,
        customers:             customers.length,
        employees:             employees.length,
        pendingRequests:       pendingReqCount,
        suspiciousTransactions: suspiciousCount,
      },
    })
  } catch (e) { next(e) }
}

export async function decideRequest(req, res, next) {
  try {
    const input = parse(requestDecisionSchema, req.body)
    // processed_by is the integer users.id of the employee/manager
    const row = await updateOne('requests', req.params.id, {
      status: input.status,
      processed_by: uid(req),
      processed_at: new Date().toISOString(),
    })
    await recordAudit(req, `${input.status}_REQUEST`, 'requests', row.id)
    await recordSecurity(req, 'PRIVILEGED_ACTION', 'LOW', `Request ${row.id} ${input.status} by ${req.auth.profile.role}`)
    res.json(row)
  } catch (e) { next(e) }
}

export async function customerStatus(req, res, next) {
  try {
    const status = req.body.status
    if (!['ACTIVE', 'INACTIVE', 'LOCKED'].includes(status)) throw new ApiError(400, 'Status must be ACTIVE, INACTIVE or LOCKED')
    const row = await updateOne('users', req.params.id, { status })
    await recordAudit(req, 'UPDATE_CUSTOMER_STATUS', 'users', row.id)
    await recordSecurity(req, 'ACCOUNT_STATUS_CHANGE', 'MEDIUM', `Customer ${row.id} status changed to ${status}`)
    res.json(row)
  } catch (e) { next(e) }
}

export async function employeeStatus(req, res, next) { return customerStatus(req, res, next) }

export async function createEmployee(req, res, next) {
  try {
    const { email, password, name, ...profileFields } = req.body
    if (!email || !password || password.length < 8) throw new ApiError(400, 'Valid email and password are required')
    // Create Supabase Auth user (server-side only)
    const { error: authError } = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true })
    if (authError) throw new ApiError(400, authError.message)
    // Create the application users row with a placeholder hash
    const { data: userRow, error: userError } = await supabaseAdmin.from('users').insert({
      name: name ?? email,
      email,
      password_hash: '$2b$12$placeholder000000000000000000000000000000000000000000000'.slice(0, 60),
      role: 'EMPLOYEE',
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
    }).select('id').single()
    assertNoDatabaseError(userError, 'Could not create users row for new employee')
    // Create the employee_profiles row referencing the new integer users.id
    const { data: employee, error: profileError } = await supabaseAdmin.from('employee_profiles').insert({
      ...profileFields,
      user_id: userRow.id,
      employee_id: `EMP-NEW-${userRow.id}`,
    }).select().single()
    assertNoDatabaseError(profileError, 'Employee profile could not be created')
    await recordAudit(req, 'CREATE_EMPLOYEE', 'employee_profiles', employee.id)
    
    // --- CRQ Event Emission ---
    try {
      emitCRQEvent('asset.added', {
        asset_id: `emp-${userRow.id}`,
        name: name ?? email,
        criticality: "MEDIUM",
        type: "employee_account"
      });
    } catch (err) {
      console.error("[CRQ Client] Error emitting event:", err);
    }
    // --------------------------

    res.status(201).json(employee)
  } catch (e) { next(e) }
}

export async function updateEmployee(req, res, next) {
  try {
    const row = await updateOne('employee_profiles', req.params.id, req.body)
    await recordAudit(req, 'UPDATE_EMPLOYEE', 'employee_profiles', row.id)
    res.json(row)
  } catch (e) { next(e) }
}

export const createCustomerSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Valid email is required'),
  phone: z.string().min(5, 'Valid phone number is required'),
  address: z.string().min(5, 'Address is required')
})

export async function createCustomer(req, res, next) {
  let authUserId = null
  let dbUserId = null
  try {
    const input = parse(createCustomerSchema, req.body)

    // 1. Create Auth User
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: input.email,
      password: 'NorthstarTemp123!',
      email_confirm: true
    })
    
    if (authError || !authData.user) {
      throw new ApiError(400, authError?.message || 'Failed to create authentication identity.')
    }
    authUserId = authData.user.id

    // 2. Insert into `users` table
    const { data: userRow, error: userError } = await supabaseAdmin.from('users').insert({
      name: input.name,
      email: input.email,
      phone: input.phone,
      password_hash: '$2b$12$ManagedBySupabaseAuthXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      role: 'CUSTOMER',
      status: 'ACTIVE'
    }).select('id').single()
    
    if (userError || !userRow) throw new Error('Failed to create user record.')
    dbUserId = userRow.id

    // 3. Insert into `customer_profiles`
    const { error: profileError } = await supabaseAdmin.from('customer_profiles').insert({
      user_id: dbUserId,
      customer_id: 'CUS-' + Math.floor(100000 + Math.random() * 900000),
      address: input.address
    })
    if (profileError) throw new Error('Failed to create customer profile.')

    // 4. Insert into `accounts`
    const { error: accError } = await supabaseAdmin.from('accounts').insert({
      user_id: dbUserId,
      account_number: '10' + Math.floor(100000000 + Math.random() * 900000000),
      account_type: 'SAVINGS',
      balance: 0.00,
      status: 'ACTIVE'
    })
    if (accError) throw new Error('Failed to create account.')

    // --- CRQ Event Emission ---
    try {
      emitCRQEvent('asset.added', {
        asset_id: `cus-${dbUserId}`,
        name: input.name,
        criticality: "LOW",
        type: "customer_account"
      });
    } catch (err) {
      console.error("[CRQ Client] Error emitting event:", err);
    }
    // --------------------------

    res.status(201).json({ message: 'Customer created successfully' })
  } catch (error) {
    console.error('Customer Creation Failed:', error.message)
    // Cleanup DB User if created (cascade will handle profiles/accounts if configured, else manual)
    if (dbUserId) {
      await supabaseAdmin.from('accounts').delete().eq('user_id', dbUserId).catch(e => console.error('Cleanup account failed', e))
      await supabaseAdmin.from('customer_profiles').delete().eq('user_id', dbUserId).catch(e => console.error('Cleanup profile failed', e))
      await supabaseAdmin.from('users').delete().eq('id', dbUserId).catch(e => console.error('Cleanup user failed', e))
    }
    // Cleanup Auth User if created
    if (authUserId) {
      await supabaseAdmin.auth.admin.deleteUser(authUserId).catch(e => console.error('Cleanup auth failed', e))
    }
    
    if (error instanceof ApiError) return next(error)
    next(new ApiError(400, 'Failed to create new customer. The operation was aborted. Check if email already exists.'))
  }
}
