/**
 * Northstar Banking – Database Seed Script  (v3 – schema-validated)
 *
 * Schema facts verified via OpenAPI introspection + live constraint probing:
 *
 *  PKs:               All tables use integer(bigint) serial – never insert `id`
 *  FKs:               All user_id / account_id etc. are integer(bigint)
 *  users:             password_hash required; role ∈ {CUSTOMER,EMPLOYEE,MANAGER}
 *                     status ∈ {ACTIVE,INACTIVE,LOCKED}
 *  accounts:          account_type ∈ {SAVINGS,CURRENT}
 *                     status ∈ {ACTIVE,INACTIVE,FROZEN}
 *  transactions:      transaction_type ∈ {TRANSFER,PAYMENT,DEPOSIT,WITHDRAWAL,
 *                       CREDIT,DEBIT,FUND_TRANSFER,BILL_PAYMENT,NEFT,RTGS,IMPS}
 *                     status ∈ {PENDING,FAILED,REVERSED}
 *  requests:          request_type ∈ {ACCOUNT_REVIEW,LIMIT_CHANGE,ADDRESS_UPDATE,
 *                       BENEFICIARY_REVIEW,CARD_ISSUE,DISPUTE,LOAN,GENERAL}
 *                     status ∈ {PENDING,APPROVED,REJECTED}
 *  beneficiaries:     status ∈ {ACTIVE,INACTIVE}
 *  security_events:   severity ∈ {LOW,MEDIUM,HIGH,CRITICAL}
 *                     event_type – unconstrained varchar
 *  audit_logs:        resource_id is integer (nullable)
 *
 * Duplicate guard: aborts if any email like seed-*@seed.northstar.local exists.
 * Safe: insert-only.  No DELETE / TRUNCATE / DROP.
 */

import { supabaseAdmin } from '../src/config/supabase.js'

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const TABLES = ['users','customer_profiles','employee_profiles','manager_profiles',
  'accounts','beneficiaries','transactions','requests',
  'login_events','security_events','audit_logs']
const BATCH_SIZE = 100
const SEED_NS    = 'seed.northstar.local'

// ---------------------------------------------------------------------------
// Name / data pools
// ---------------------------------------------------------------------------
const firstNames   = ['Avery','Maya','Jordan','Olivia','Noah','Sophia','Ethan','Amelia',
  'Liam','Isla','Marcus','Priya','Lena','Theo','Nora','Caleb','Zoe','Milo',
  'Elena','Samir','Aria','Felix','Grace','Hugo','Ivy','Jack','Kira','Leon','Mia','Nate']
const lastNames    = ['Sterling','Bennett','Williams','Caldwell','Davis','Morgan','Lee',
  'Shah','Ortiz','Carter','Brooks','Hayes','Foster','Reed','Mason','Grant','Bell',
  'Clarke','Wright','Turner','Black','Cole','Dean','Ellis','Flynn','Gore','Hunt',
  'Ingram','James','King']
const cities       = [
  ['Austin','Texas','78701'],['Denver','Colorado','80202'],['Chicago','Illinois','60601'],
  ['Seattle','Washington','98101'],['Boston','Massachusetts','02108'],
  ['Atlanta','Georgia','30303'],['Phoenix','Arizona','85001'],['Miami','Florida','33101']]
const banks        = ['Pioneer Credit Union','Cedar National Bank','Harbor Financial',
  'Summit Trust','Apex Savings']
const departments  = ['Client success','Risk & compliance','Relationship banking',
  'Operations','Digital banking']

// Validated constraint values
const ACCOUNT_TYPES   = ['SAVINGS','CURRENT']
const TX_TYPES        = ['TRANSFER','PAYMENT','DEPOSIT','WITHDRAWAL','CREDIT','DEBIT',
  'FUND_TRANSFER','BILL_PAYMENT','NEFT','RTGS','IMPS']
const TX_STATUS       = ['PENDING','FAILED','REVERSED']
const REQ_TYPES       = ['ACCOUNT_REVIEW','LIMIT_CHANGE','ADDRESS_UPDATE',
  'BENEFICIARY_REVIEW','CARD_ISSUE','DISPUTE','LOAN','GENERAL']
const REQ_DESCS       = [
  'Please review my account activity',
  'Requesting a transfer limit adjustment',
  'I need to update my mailing address',
  'Please verify this new beneficiary',
  'My card was lost or damaged',
  'I am disputing a recent transaction',
  'Enquiring about loan eligibility',
  'General account enquiry']
const DEVICES         = ['Chrome on Windows','Safari on iPhone','Edge on macOS',
  'Mobile app Android','Firefox on Linux']
const TX_DESCS        = ['Utilities','Groceries','Payroll','Rent','Internal transfer',
  'Online shopping','Insurance premium','Loan repayment','Dining','Subscriptions']

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const NOW     = Date.now()
const isoDate = (daysAgo) => new Date(NOW - daysAgo * 86_400_000).toISOString()
const pick    = (arr, idx) => arr[Math.abs(idx) % arr.length]
const money   = (v) => Math.round(v * 100) / 100
const emailFor= (role, idx) => `seed-${role.toLowerCase()}-${String(idx + 1).padStart(4,'0')}@${SEED_NS}`
const fullName = (idx, shift = 3) => `${pick(firstNames, idx)} ${pick(lastNames, idx + shift)}`
// Placeholder password_hash – NOT a real bcrypt digest, just satisfies NOT NULL
const fakeHash = (idx) => `$2b$12$NorthstarSeedHash${String(idx).padStart(6,'0')}XXXXXXXXXXXXXXXXXXXXXXXXXX`.slice(0, 60)
const ifscCode = (idx) => `NSTR${String(10000 + idx).padStart(7,'0')}`

function fail(table, error) {
  const parts = [error?.message, error?.code && `code:${error.code}`, error?.hint && `hint:${error.hint}`].filter(Boolean)
  throw new Error(`[${table}] schema/permission mismatch – ${parts.join(' | ')}`)
}

// ---------------------------------------------------------------------------
// Preflight – verify all 11 tables are present
// ---------------------------------------------------------------------------
async function preflight() {
  const { env } = await import('../src/config/env.js')
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/`, {
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` }
  })
  if (!res.ok) throw new Error(`Schema preflight HTTP ${res.status}`)
  const spec = await res.json()
  const missing = TABLES.filter((t) => !spec.definitions?.[t])
  if (missing.length) throw new Error(`Missing tables: ${missing.join(', ')}`)
  console.log(`✓ Preflight – all ${TABLES.length} tables confirmed`)
}

// ---------------------------------------------------------------------------
// Duplicate guard
// ---------------------------------------------------------------------------
async function refuseDuplicateSeed() {
  const { data, error } = await supabaseAdmin.from('users').select('id').like('email', `seed-%@${SEED_NS}`)
  if (error) fail('users', error)
  if (data?.length) {
    throw new Error(`Duplicate seed detected – ${data.length} row(s) already in users (${SEED_NS}). Aborting.`)
  }
  console.log('✓ No existing seed rows – proceeding')
}

// ---------------------------------------------------------------------------
// Batch insert – returns all rows with their auto-generated integer ids
// ---------------------------------------------------------------------------
async function insertBatches(table, rows, counts) {
  const inserted = []
  for (let off = 0; off < rows.length; off += BATCH_SIZE) {
    const batch = rows.slice(off, off + BATCH_SIZE)
    const { data, error } = await supabaseAdmin.from(table).insert(batch).select()
    if (error) fail(table, error)
    inserted.push(...(data ?? []))
  }
  counts[table] = (counts[table] ?? 0) + inserted.length
  return inserted
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  await preflight()
  await refuseDuplicateSeed()

  const counts = {}

  // ── 1. USERS ─────────────────────────────────────────────────────────────
  console.log('\n[1/11] Inserting users (485)…')
  const userRows = Array.from({ length: 485 }, (_, idx) => ({
    name:          fullName(idx),
    email:         idx < 450 ? emailFor('customer', idx)
                 : idx < 480 ? emailFor('employee', idx - 450)
                             : emailFor('manager', idx - 480),
    phone:         `+1-555-${String(1_000_000 + idx).slice(-7)}`,
    password_hash: fakeHash(idx),
    role:          idx < 450 ? 'CUSTOMER' : idx < 480 ? 'EMPLOYEE' : 'MANAGER',
    status:        'ACTIVE',
    created_at:    isoDate(180 - (idx % 150)),
  }))
  const users         = await insertBatches('users', userRows, counts)
  const customerUsers = users.slice(0, 450)
  const employeeUsers = users.slice(450, 480)
  const managerUsers  = users.slice(480)
  console.log(`   ✓ ${users.length} users  (ids ${users[0].id}–${users.at(-1).id})`)

  // ── 2. CUSTOMER PROFILES ─────────────────────────────────────────────────
  console.log('[2/11] Inserting customer_profiles (450)…')
  const cpRows = customerUsers.map((u, idx) => {
    const city = pick(cities, idx)
    return {
      user_id:       u.id,
      customer_id:   `CUS-${String(idx + 1).padStart(6,'0')}`,
      date_of_birth: `${1970 + (idx % 30)}-${String((idx % 12) + 1).padStart(2,'0')}-15`,
      address:       `${100 + idx} Northstar Avenue`,
      city:          city[0], state: city[1], postal_code: city[2],
      created_at:    isoDate(175 - (idx % 100)),
    }
  })
  await insertBatches('customer_profiles', cpRows, counts)
  console.log(`   ✓ ${cpRows.length} customer_profiles`)

  // ── 3. EMPLOYEE PROFILES ─────────────────────────────────────────────────
  console.log('[3/11] Inserting employee_profiles (30)…')
  const epRows = employeeUsers.map((u, idx) => ({
    user_id:      u.id,
    employee_id:  `EMP-${String(idx + 1).padStart(4,'0')}`,
    department:   pick(departments, idx),
    designation:  idx % 3 === 0 ? 'Senior associate' : 'Banking associate',
    branch:       pick(['West region','Central branch','North branch','East branch'], idx),
    joining_date: isoDate(900 - (idx % 500)),
    created_at:   isoDate(170 - (idx % 90)),
  }))
  await insertBatches('employee_profiles', epRows, counts)
  console.log(`   ✓ ${epRows.length} employee_profiles`)

  // ── 4. MANAGER PROFILES ──────────────────────────────────────────────────
  console.log('[4/11] Inserting manager_profiles (5)…')
  const mpRows = managerUsers.map((u, idx) => ({
    user_id:        u.id,
    manager_id:     `MGR-${String(idx + 1).padStart(3,'0')}`,
    designation:    idx % 2 ? 'Regional manager' : 'Branch manager',
    branch:         pick(['HQ','West region','Central branch','North branch'], idx),
    approval_limit: idx % 2 ? 50000 : 100000,
    joining_date:   isoDate(1500 - (idx % 700)),
    created_at:     isoDate(180 - (idx % 110)),
  }))
  await insertBatches('manager_profiles', mpRows, counts)
  console.log(`   ✓ ${mpRows.length} manager_profiles`)

  // ── 5. ACCOUNTS (one per customer) ──────────────────────────────────────
  console.log('[5/11] Inserting accounts (450)…')
  const accountRows = customerUsers.map((u, idx) => ({
    user_id:        u.id,
    account_number: `100${String(idx + 1).padStart(8,'0')}`,
    account_type:   pick(ACCOUNT_TYPES, idx),                     // SAVINGS | CURRENT
    balance:        money(1200 + ((idx * 791) % 62000) + (idx % 5) * 0.17),
    status:         'ACTIVE',
    created_at:     isoDate(170 - (idx % 90)),
  }))
  const accounts = await insertBatches('accounts', accountRows, counts)
  console.log(`   ✓ ${accounts.length} accounts  (ids ${accounts[0].id}–${accounts.at(-1).id})`)

  // ── 6. BENEFICIARIES (~630 rows) ─────────────────────────────────────────
  console.log('[6/11] Inserting beneficiaries…')
  const benRows = customerUsers.flatMap((u, idx) => {
    if (idx % 5 === 0) return []
    const count = idx % 4 === 0 ? 1 : 2
    return Array.from({ length: count }, (_, n) => ({
      user_id:          u.id,
      beneficiary_name: `${pick(firstNames, idx + n + 4)} ${pick(lastNames, idx + n + 8)}`,
      account_number:   `200${String(idx * 3 + n + 1).padStart(8,'0')}`,
      bank_name:        pick(banks, idx + n),
      ifsc:             ifscCode(idx + n),
      status:           'ACTIVE',
      created_at:       isoDate((idx + n) % 120),
    }))
  })
  await insertBatches('beneficiaries', benRows, counts)
  console.log(`   ✓ ${benRows.length} beneficiaries`)

  // ── 7. TRANSACTIONS (1,200 rows) ─────────────────────────────────────────
  console.log('[7/11] Inserting transactions (1 200)…')
  const txRows = Array.from({ length: 1200 }, (_, idx) => {
    const sIdx = idx % accounts.length
    let   rIdx = (sIdx + 1 + (idx % 19)) % accounts.length
    if (rIdx === sIdx) rIdx = (rIdx + 1) % accounts.length
    const isLarge = idx % 97 === 0
    return {
      sender_account_id:   accounts[sIdx].id,
      receiver_account_id: accounts[rIdx].id,
      amount:              money(isLarge ? 10000 + (idx % 6) * 2500 : 12 + ((idx * 43) % 1800) + (idx % 7) * 0.11),
      transaction_type:    pick(TX_TYPES, idx),                  // validated
      status:              pick(TX_STATUS, idx % 3),             // PENDING|FAILED|REVERSED
      description:         isLarge ? 'Large transfer review' : pick(TX_DESCS, idx),
      ip_address:          `10.20.${idx % 20}.${(idx % 240) + 10}`,
      created_at:          isoDate(idx % 180),
    }
  })
  const transactions = await insertBatches('transactions', txRows, counts)
  console.log(`   ✓ ${transactions.length} transactions`)

  // ── 8. REQUESTS (90 rows) ────────────────────────────────────────────────
  console.log('[8/11] Inserting requests (90)…')
  const reqRows = Array.from({ length: 90 }, (_, idx) => {
    const user      = customerUsers[idx % customerUsers.length]
    const processor = idx % 4 === 0 ? null
      : idx % 2 === 0 ? employeeUsers[idx % employeeUsers.length]
                      : managerUsers[idx % managerUsers.length]
    const status    = processor ? (idx % 7 === 0 ? 'REJECTED' : 'APPROVED') : 'PENDING'
    return {
      user_id:      user.id,
      request_type: pick(REQ_TYPES, idx),
      description:  pick(REQ_DESCS, idx),
      status,
      processed_by: processor?.id ?? null,
      created_at:   isoDate(idx % 90),
      processed_at: processor ? isoDate((idx % 80) + 1) : null,
    }
  })
  const requests = await insertBatches('requests', reqRows, counts)
  console.log(`   ✓ ${requests.length} requests`)

  // ── 9. LOGIN EVENTS (950 rows) ───────────────────────────────────────────
  console.log('[9/11] Inserting login_events (950)…')
  const loginRows = Array.from({ length: 950 }, (_, idx) => {
    const user       = users[idx % users.length]
    const suspicious = idx % 113 === 0
    const failed     = idx % 17 === 0 || (suspicious && idx % 2 === 0)
    return {
      user_id:        user.id,
      ip_address:     suspicious
        ? `185.22.${idx % 200}.${idx % 240}`
        : `10.10.${idx % 20}.${(idx % 240) + 1}`,
      device:         pick(DEVICES, idx),
      success:        !failed,
      failure_reason: failed ? (suspicious ? 'Unrecognized location' : 'Invalid password') : null,
      created_at:     isoDate(idx % 180),
    }
  })
  await insertBatches('login_events', loginRows, counts)
  console.log(`   ✓ ${loginRows.length} login_events`)

  // ── 10. SECURITY EVENTS (~117 rows) ──────────────────────────────────────
  console.log('[10/11] Inserting security_events…')
  const largeTxs = transactions.filter((_, idx) => idx % 97 === 0)
  const secRows = [
    ...Array.from({ length: 80 }, (_, idx) => ({
      user_id:     customerUsers[idx % customerUsers.length].id,
      event_type:  idx % 3 === 0 ? 'NEW_BENEFICIARY' : 'LOGIN_FAILURE',
      severity:    idx % 10 === 0 ? 'MEDIUM' : 'LOW',            // LOW is lowest valid
      description: idx % 3 === 0 ? 'New beneficiary created' : 'Failed login attempt recorded',
      ip_address:  `10.12.${idx % 20}.${idx + 1}`,
      created_at:  isoDate(idx % 180),
    })),
    ...largeTxs.map((tx, idx) => ({
      user_id:     customerUsers[idx % customerUsers.length].id,
      event_type:  'LARGE_TRANSFER',
      severity:    'HIGH',
      description: 'Large transfer requires review',
      ip_address:  tx.ip_address,
      created_at:  tx.created_at,
    })),
    ...Array.from({ length: 25 }, (_, idx) => ({
      user_id:     managerUsers[idx % managerUsers.length].id,
      event_type:  'PRIVILEGED_ACTION',
      severity:    idx % 5 === 0 ? 'HIGH' : 'LOW',
      description: 'Manager approved an operational request',
      ip_address:  `10.30.${idx % 10}.${idx + 1}`,
      created_at:  isoDate(idx % 120),
    })),
  ]
  await insertBatches('security_events', secRows, counts)
  console.log(`   ✓ ${secRows.length} security_events`)

  // ── 11. AUDIT LOGS (~183 rows) ───────────────────────────────────────────
  console.log('[11/11] Inserting audit_logs…')
  const processedReqs = requests.filter((r) => r.processed_by != null)
  const auditRows = [
    ...processedReqs.map((req) => ({
      user_id:     req.processed_by,
      role:        managerUsers.some((u) => u.id === req.processed_by) ? 'MANAGER' : 'EMPLOYEE',
      action:      `${req.status}_REQUEST`,
      resource:    'requests',
      resource_id: null,
      ip_address:  '10.30.1.10',
      created_at:  req.processed_at ?? req.created_at,
    })),
    ...Array.from({ length: 120 }, (_, idx) => ({
      user_id:     managerUsers[idx % managerUsers.length].id,
      role:        'MANAGER',
      action:      pick(['VIEW_REPORT','UPDATE_CUSTOMER_STATUS','VIEW_SECURITY_EVENTS','EXPORT_DATA'], idx),
      resource:    pick(['reports','users','security_events','transactions'], idx),
      resource_id: null,
      ip_address:  `10.31.${idx % 10}.${idx + 1}`,
      created_at:  isoDate(idx % 140),
    })),
  ]
  await insertBatches('audit_logs', auditRows, counts)
  console.log(`   ✓ ${auditRows.length} audit_logs`)

  // ── Summary ───────────────────────────────────────────────────────────────
  const bar = '═'.repeat(45)
  console.log(`\n${bar}`)
  console.log('  SEED COMPLETE – Row counts per table')
  console.log(bar)
  for (const t of TABLES) {
    console.log(`  ${t.padEnd(28)} ${String(counts[t] ?? 0).padStart(6)}`)
  }
  console.log(bar)
}

try {
  await main()
} catch (err) {
  console.error('\n✗ Seed failed:', err.message)
  process.exitCode = 1
}
