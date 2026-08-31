import { useState, useCallback, useEffect } from 'react'
import './App.css'

// ─── API base ────────────────────────────────────────────────────────────────
const API = 'http://localhost:3001/api'

async function apiPost(path, body, token) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
  return data
}

async function apiGet(path, token) {
  const res = await fetch(`${API}${path}`, {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Cache-Control': 'no-store' }
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
  return data
}


async function apiPut(path, body, token) {
  const res = await fetch(`${API}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
  return data
}

async function apiDelete(path, token) {
  const res = await fetch(`${API}${path}`, {
    method: 'DELETE',
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  })
  if (res.status === 204) return null
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
  return data
}

// ─── Role-specific nav config ─────────────────────────────────────────────────
const roleConfig = {
  Customer: {
    nav: ['Overview', 'Transfer money', 'Beneficiaries', 'Transactions', 'Profile', 'Security'],
  },
  Employee: {
    nav: ['Overview', 'Customers', 'Transactions', 'Requests', 'Profile', 'Security'],
  },
  Manager: {
    nav: ['Overview', 'Customers', 'Employees', 'Transactions', 'Requests', 'Security', 'Reports', 'Profile'],
  },
}

// Capitalise first letter so DB role (CUSTOMER) maps to roleConfig key (Customer)
function toRoleKey(dbRole) {
  if (!dbRole) return null
  return dbRole.charAt(0).toUpperCase() + dbRole.slice(1).toLowerCase()
}

const transactions = [['Whole Foods Market', 'Groceries - Today, 10:42 AM', '-₹86.24', 'debit'], ['Acme Studio LLC', 'Incoming transfer - Yesterday', '+₹3,200.00', 'credit'], ['Netflix.com', 'Subscription - Aug 21', '-₹15.49', 'debit'], ['Cedar & Stone', 'Dining - Aug 20', '-₹64.80', 'debit'], ['Direct deposit', 'Payroll - Aug 18', '+₹4,850.00', 'credit']]
const customers  = [['Olivia Bennett', '4821', '₹18,420.65', 'Active'], ['Noah Williams', '1093', '₹42,106.20', 'Active'], ['Ethan Caldwell', '7738', '₹8,930.10', 'Review'], ['Sophia Davis', '6204', '₹65,240.00', 'Active']]

function Icon({ children }) { return <span className="icon" aria-hidden="true">{children}</span> }

function formatINR(val) {
  if (val === undefined || val === null || isNaN(val)) return '₹0.00'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(val)
}

// ─── App root ─────────────────────────────────────────────────────────────────
export default function App() {
  const [session, setSession]   = useState(null)   // { access_token, user }
  const [active, setActive]     = useState('Overview')
  const [notice, setNotice]     = useState('')

  const [customerData, setCustomerData] = useState({ account: null, transactions: [], beneficiaries: [], profile: null, loading: true })
  const [employeeData, setEmployeeData] = useState({ dashboard: [], customers: [], transactions: [], requests: [], profile: null, loading: true })
  const [managerData,  setManagerData]  = useState({ dashboard: null, customers: [], employees: [], transactions: [], requests: [], suspiciousTransactions: [], securityEvents: [], reports: null, profile: null, loading: true })

  const refreshCustomerData = useCallback(async () => {
    if (!session || session.user?.role !== 'CUSTOMER') return
    setCustomerData(prev => ({ ...prev, loading: true }))
    try {
      const [accs, txs, bens, prof] = await Promise.all([
        apiGet('/customer/account', session.access_token),
        apiGet('/customer/transactions', session.access_token),
        apiGet('/customer/beneficiaries', session.access_token),
        apiGet('/customer/profile', session.access_token),
      ])
      setCustomerData({ account: accs[0] || null, transactions: txs, beneficiaries: bens, profile: prof, loading: false })
    } catch (e) {
      console.error('Failed to fetch customer data', e)
      setCustomerData(prev => ({ ...prev, loading: false }))
    }
  }, [session])

  const refreshEmployeeData = useCallback(async () => {
    if (!session || session.user?.role !== 'EMPLOYEE') return
    setEmployeeData(prev => ({ ...prev, loading: true }))
    try {
      const [dash, cust, txs, reqs, prof] = await Promise.all([
        apiGet('/employee/dashboard', session.access_token),
        apiGet('/employee/customers', session.access_token),
        apiGet('/employee/transactions', session.access_token),
        apiGet('/employee/requests', session.access_token),
        apiGet('/employee/profile', session.access_token),
      ])
      setEmployeeData({ dashboard: dash, customers: cust, transactions: txs, requests: reqs, profile: prof, loading: false })
    } catch (e) {
      console.error('Failed to fetch employee data', e)
      setEmployeeData(prev => ({ ...prev, loading: false }))
    }
  }, [session])

  const refreshManagerData = useCallback(async () => {
    if (!session || session.user?.role !== 'MANAGER') return
    setManagerData(prev => ({ ...prev, loading: true }))
    try {
      const [rpts, custs, emps, txs, reqs, suspicious, secEvts, prof] = await Promise.all([
        apiGet('/manager/reports',               session.access_token),
        apiGet('/manager/customers',             session.access_token),
        apiGet('/manager/employees',             session.access_token),
        apiGet('/manager/transactions',          session.access_token),
        apiGet('/manager/requests',              session.access_token),
        apiGet('/manager/transactions/suspicious', session.access_token),
        apiGet('/manager/security-events',       session.access_token),
        apiGet('/manager/profile',               session.access_token),
      ])
      setManagerData({
        dashboard: rpts,
        customers: custs,
        employees: emps,
        transactions: txs,
        requests: reqs,
        suspiciousTransactions: suspicious,
        securityEvents: secEvts,
        reports: rpts,
        profile: prof,
        loading: false,
      })
    } catch (e) {
      console.error('Failed to fetch manager data', e)
      setManagerData(prev => ({ ...prev, loading: false }))
    }
  }, [session])

  useEffect(() => {
    if (session?.user?.role === 'CUSTOMER') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      refreshCustomerData()
    } else if (session?.user?.role === 'EMPLOYEE') {
      refreshEmployeeData()
    } else if (session?.user?.role === 'MANAGER') {
      refreshManagerData()
    }
  }, [session, refreshCustomerData, refreshEmployeeData, refreshManagerData])

  const handleLogin = useCallback((sessionData) => {
    setSession(sessionData)
    setActive('Overview')
  }, [])

  const handleLogout = useCallback(async () => {
    try {
      if (session?.access_token) {
        await apiPost('/auth/logout', {}, session.access_token)
      }
    } catch { /* ignore logout errors */ }
    setSession(null)
    setActive('Overview')
  }, [session])

  if (!session) return <LoginPage onLogin={handleLogin} />

  const dbRole     = session.user?.role                        // CUSTOMER / EMPLOYEE / MANAGER
  const roleKey    = toRoleKey(dbRole)                         // Customer / Employee / Manager
  const current    = roleConfig[roleKey] ?? roleConfig.Customer
  const userName   = session.user?.name ?? 'You'
  const initials   = userName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()

  function action(message) { setNotice(message); window.setTimeout(() => setNotice(''), 2800) }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">N</span><span>northstar<span className="brand-dot">.</span></span></div>

        <nav className="nav-list">
          <div className="workspace-label">Navigate</div>
          {current.nav.map((item, index) => (
            <button key={item} className={active === item ? 'nav-item selected' : 'nav-item'} onClick={() => setActive(item)}>
              <Icon>{['⌂', '↗', '◇', '≡', '♙', '◈', '▦', '✦'][index]}</Icon>
              {item}
              {item === 'Requests' && (
                <span className="nav-count">
                  {dbRole === 'MANAGER'
                    ? (managerData.requests || []).filter(r => r.status === 'PENDING').length || ''
                    : (employeeData.requests || []).filter(r => r.status === 'PENDING').length || ''}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="help-card">
            <span className="help-icon">?</span>
            <div><strong>Need a hand?</strong><small>Visit our help center</small></div>
          </div>
          <button className="nav-item logout" onClick={handleLogout}><Icon>↪</Icon> Log out</button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => action('Use the navigation menu to explore your workspace')}>☰</button>
          <div className="breadcrumb">Workspace <span>/</span> <b>{active}</b></div>
          <div className="top-actions">
            <button className="icon-button" onClick={() => action('You are all caught up')} aria-label="Notifications">♧<i /></button>
            <button className="profile-trigger" onClick={() => setActive('Profile')}>
              <span className="avatar small">{initials}</span>
              <span className="profile-name" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <span>{userName}</span>
                {dbRole === 'EMPLOYEE' && employeeData?.profile?.employee_id && (
                  <span style={{fontSize: '11px', color: '#9aa5b5', fontWeight: 'normal'}}>ID: {employeeData.profile.employee_id}</span>
                )}
              </span>
              <span>⌄</span>
            </button>
          </div>
        </header>

        <div className="content-wrap">
          {notice && <div className="toast"><span>✓</span>{notice}</div>}
          {active !== 'Bug Lab' && (
            <div className="page-heading">
              <div>
                <p className="eyebrow">{roleKey} workspace</p>
                <h1>{active === 'Overview' ? `Good morning, ${userName.split(' ')[0]}.` : active}</h1>
                <p className="subheading">Here is what is happening with your accounts today.</p>
              </div>
              <div className="heading-actions">
                <button className="secondary-button" onClick={() => action('Statement export is ready to download')}><Icon>⇩</Icon> Export</button>
                {roleKey === 'Customer' && <button className="primary-button" onClick={() => setActive('Transfer money')}><Icon>↗</Icon> Transfer money</button>}
              </div>
            </div>
          )}
          {active === 'Overview'
            ? <Dashboard roleKey={roleKey} action={action} customerData={customerData} employeeData={employeeData} managerData={managerData} />
            : <WorkspacePage active={active} action={action} customerData={customerData} employeeData={employeeData} managerData={managerData} session={session} refresh={refreshCustomerData} refreshEmployee={refreshEmployeeData} refreshManager={refreshManagerData} />}
        </div>
      </main>
    </div>
  )
}

// ─── Login page ───────────────────────────────────────────────────────────────
function LoginPage({ onLogin }) {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  // MFA State
  const [mfaChallengeId, setMfaChallengeId] = useState(null)
  const [otp, setOtp] = useState('')
  const [otpSentMsg, setOtpSentMsg] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await apiPost('/auth/login', { email, password })
      if (data.mfa_required) {
        setMfaChallengeId(data.challenge_id)
        setOtpSentMsg('We sent a 6-digit verification code to your email.')
      } else if (data.mfa_bypassed) {
        // BUG_MFA is active — OTP was skipped, session returned directly
        setError('')
        onLogin({ access_token: data.access_token, user: data.user, mfa_bypassed: true })
      } else {
        onLogin({ access_token: data.access_token, user: data.user })
      }
    } catch (err) {
      setError(err.message ?? 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyOtp(e) {
    e.preventDefault()
    setError('')
    setOtpSentMsg('')
    setLoading(true)
    try {
      const data = await apiPost('/auth/verify-otp', { email, password, challenge_id: mfaChallengeId, otp })
      // On success, clear password from state
      setPassword('')
      onLogin({ access_token: data.access_token, user: data.user })
    } catch (err) {
      setError(err.message ?? 'Verification failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleResendOtp() {
    setError('')
    setLoading(true)
    try {
      const data = await apiPost('/auth/resend-otp', { email, challenge_id: mfaChallengeId })
      setMfaChallengeId(data.challenge_id)
      setOtpSentMsg('A new verification code has been sent to your email.')
    } catch (err) {
      setError(err.message ?? 'Failed to resend code')
    } finally {
      setLoading(false)
    }
  }

  if (mfaChallengeId) {
    return (
      <div className="login-shell">
        <div className="login-card">
          <div className="login-brand">
            <span className="brand-mark">N</span>
            <span className="login-brand-name">northstar<span className="brand-dot">.</span></span>
          </div>
          <h1 className="login-title">Verify your identity</h1>
          <p className="login-subtitle">{otpSentMsg || 'Enter your 6-digit verification code'}</p>

          <form className="login-form" onSubmit={handleVerifyOtp} noValidate>
            <div className="form-field">
              <label htmlFor="otp-input">Verification Code</label>
              <input
                id="otp-input"
                className="text-input"
                type="text"
                autoComplete="one-time-code"
                required
                maxLength={6}
                placeholder="123456"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
              />
            </div>

            {error && <div className="login-error" role="alert">{error}</div>}

            <button
              className="primary-button login-submit"
              type="submit"
              disabled={loading || otp.length < 6}
            >
              {loading ? 'Verifying\u2026' : 'Verify'}
            </button>
            <button
              type="button"
              className="secondary-button"
              style={{ marginTop: '12px', width: '100%', border: 'none', background: 'transparent', cursor: 'pointer' }}
              onClick={handleResendOtp}
              disabled={loading}
            >
              Resend code
            </button>
            <button
              type="button"
              className="text-button"
              style={{ marginTop: '16px', width: '100%', border: 'none', background: 'transparent', cursor: 'pointer' }}
              onClick={() => { setMfaChallengeId(null); setOtp(''); setError(''); setPassword(''); }}
              disabled={loading}
            >
              Back to login
            </button>
          </form>
          <p className="login-footer">Protected by Northstar Secure&trade;</p>
        </div>
      </div>
    )
  }

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-brand">
          <span className="brand-mark">N</span>
          <span className="login-brand-name">northstar<span className="brand-dot">.</span></span>
        </div>
        <h1 className="login-title">Welcome back</h1>
        <p className="login-subtitle">Sign in to your Northstar workspace</p>

        <form className="login-form" onSubmit={handleSubmit} id="login-form" noValidate>
          <div className="form-field">
            <label htmlFor="login-email">Email address</label>
            <input
              id="login-email"
              className="text-input"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              className="text-input"
              type="password"
              autoComplete="current-password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && <div className="login-error" role="alert">{error}</div>}

          <button
            id="login-submit"
            className="primary-button login-submit"
            type="submit"
            disabled={loading}
          >
            {loading ? 'Signing in\u2026' : 'Sign in \u2192'}
          </button>
        </form>

        <p className="login-footer">Protected by Northstar Secure&trade;</p>
      </div>
    </div>
  )
}

// ─── Dashboard ─────────────────────────────────────────────────────────────────
function Dashboard({ roleKey, action, customerData, employeeData, managerData }) {
  let displayMetrics = []
  let displayTransactions = transactions

  if (roleKey === 'Customer' && customerData && !customerData.loading && customerData.account) {
    const acc = customerData.account
    const bal = formatINR(acc.balance)
    displayMetrics = [
      ['Available balance', bal, 'Account ' + acc.account_number.slice(-4)],
      ['Account status', acc.status, 'Active'],
      ['Account type', acc.account_type, 'Northstar Secure'],
    ]
    displayTransactions = customerData.transactions.map(tx => {
      const isDebit = tx.sender_account_id === acc.id
      return [
        tx.description || tx.transaction_type,
        `${tx.transaction_type} - ${new Date(tx.created_at).toLocaleDateString()}`,
        (isDebit ? '-' : '+') + formatINR(Math.abs(tx.amount)),
        isDebit ? 'debit' : 'credit'
      ]
    })
  } else if (roleKey === 'Employee' && employeeData && !employeeData.loading) {
    const totalCustomers = employeeData.dashboard?.length || 0
    const pendingReqs = (employeeData.requests || []).filter(r => r.status === 'PENDING').length
    displayMetrics = [
      ['Customers handled', totalCustomers.toString(), 'All managed accounts'],
      ['Pending requests', pendingReqs.toString(), pendingReqs > 0 ? `${pendingReqs} need attention` : 'All caught up'],
      ['Service rating', '4.9 / 5', '+0.2 this quarter']
    ]
    displayTransactions = (employeeData.transactions || []).map(tx => {
      return [
        tx.description || tx.transaction_type,
        `${tx.transaction_type} - ${new Date(tx.created_at).toLocaleDateString()}`,
        formatINR(Math.abs(tx.amount)),
        'credit'
      ]
    })
  } else if (roleKey === 'Manager') {
    if (managerData && !managerData.loading && managerData.reports) {
      const t = managerData.reports.totals
      displayMetrics = [
        ['Total customers',     t.customers.toLocaleString(),                                    'All registered customers'],
        ['Total deposits',      new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(t.deposits), 'Across all accounts'],
        ['Transactions',        t.transactions.toLocaleString(),                                 'All time'],
        ['Suspicious activity', t.suspiciousTransactions.toString(),                             t.suspiciousTransactions > 0 ? `${t.suspiciousTransactions} need review` : 'None flagged'],
      ]
    } else {
      displayMetrics = [
        ['Total customers',     '—', 'Loading…'],
        ['Total deposits',      '—', 'Loading…'],
        ['Transactions',        '—', 'Loading…'],
        ['Suspicious activity', '—', 'Loading…'],
      ]
    }
    displayTransactions = (managerData?.transactions || []).slice(0, 5).map(tx => {
      const senderName   = tx.sender?.users?.name   || 'Unknown'
      const receiverName = tx.receiver?.users?.name || 'Unknown'
      return [
        tx.description || tx.transaction_type,
        `${senderName} \u2192 ${receiverName} \u00b7 ${new Date(tx.created_at).toLocaleDateString()}`,
        formatINR(Math.abs(tx.amount)),
        (tx.amount >= 10000) ? 'debit' : 'credit'
      ]
    })
  }

  return (
    <>
      <section className={`metric-grid ${roleKey === 'Manager' ? 'four' : ''}`}>
        {displayMetrics.map(([label, value, note], index) => (
          <div className="metric-card" key={label}>
            <div className="metric-top">
              <span>{label}</span>
              <span className={`metric-icon tint-${index}`}>{['↗', '◒', '⌁', '!'][index]}</span>
            </div>
            <strong>{value}</strong>
            <small className={note.includes('need') || note.includes('priority') ? 'warning-text' : ''}>
              <span>↗</span> {note}
            </small>
          </div>
        ))}
      </section>
      <section className="dashboard-grid">
        <div className="panel chart-panel">
          <div className="panel-heading">
            <div><h2>Cash flow</h2><p>Money in and out over the last 30 days</p></div>
            <button className="select-button">Last 30 days ⌄</button>
          </div>
          <div className="chart-legend">
            <span><i className="legend-income" />Income</span>
            <span><i className="legend-spend" />Spending</span>
          </div>
          <div className="chart">
            <div className="y-labels"><span>₹6k</span><span>₹4k</span><span>₹2k</span><span>₹0</span></div>
            <div className="chart-area">
              <div className="grid-lines"><i /><i /><i /><i /></div>
              <svg viewBox="0 0 650 190" preserveAspectRatio="none" aria-label="Cash flow chart">
                <path className="income-line" d="M0 140 C50 133 65 84 115 96 S170 145 215 112 S260 78 305 92 S345 52 390 74 S440 110 478 70 S535 75 575 38 S620 45 650 20" />
                <path className="spend-line"  d="M0 165 C50 150 75 168 120 143 S170 155 220 146 S260 124 305 139 S355 112 400 126 S450 105 490 120 S540 86 580 104 S620 83 650 90" />
                <circle cx="575" cy="38" r="5" />
              </svg>
              <div className="x-labels"><span>Aug 1</span><span>Aug 8</span><span>Aug 15</span><span>Aug 22</span><span>Aug 29</span></div>
            </div>
          </div>
        </div>
        <div className="panel activity-panel">
          <div className="panel-heading">
            <div><h2>Recent activity</h2><p>Your latest account activity</p></div>
            <button className="text-button" onClick={() => action('Showing all recent transactions')}>View all</button>
          </div>
          <div className="activity-list">
            {displayTransactions.slice(0, 4).map(([name, meta, amount, type], index) => (
              <div className="activity-row" key={name + index}>
                <span className={`transaction-icon ${type}`}>{name[0] || 'T'}</span>
                <div className="activity-copy"><strong>{name}</strong><small>{meta}</small></div>
                <b className={type}>{amount}</b>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="panel table-panel">
        <div className="panel-heading">
          <div>
            <h2>{roleKey === 'Customer' ? 'Upcoming payments' : roleKey === 'Employee' ? 'Customer requests' : 'Pending requests'}</h2>
            <p>{roleKey === 'Customer' ? 'Scheduled in the next 7 days' : 'Items that need your attention'}</p>
          </div>
          <button className="text-button" onClick={() => action('Opening the full list')}>View all</button>
        </div>
        <div className="table-scroll">
          <table>
            <thead><tr><th>{roleKey === 'Customer' ? 'PAYEE' : 'CUSTOMER'}</th><th>DATE</th><th>{roleKey === 'Manager' ? 'TYPE' : 'AMOUNT'}</th><th>STATUS</th><th /></tr></thead>
            <tbody>
              {(roleKey === 'Customer'
                ? [['Adobe Creative Cloud', 'Aug 28', '₹59.99', 'Scheduled'], ['Rent payment', 'Sep 01', '₹1,850.00', 'Scheduled'], ['Electric company', 'Sep 03', '₹124.70', 'Scheduled']]
                : roleKey === 'Manager'
                  ? (managerData?.requests || []).filter(r => r.status === 'PENDING').slice(0, 3).map(r => [r.users?.name || 'Customer', new Date(r.created_at).toLocaleDateString(), r.request_type || '—', r.status])
                  : customers.slice(0, 3).map((c, index) => [c[0], index === 0 ? 'Account review' : 'Transfer request', index === 0 ? '₹3,200.00' : '₹850.00', c[3]])
              ).map((row, rowIdx) => (
                <tr key={row[0] + rowIdx}>
                  {row.map((cell, index) => (
                    <td key={cell + index} className={index === 3 ? 'status-cell' : index === 2 ? 'amount-cell' : ''}>
                      {index === 3 ? <span className={`status ${cell.toLowerCase()}`}>{cell}</span> : cell}
                    </td>
                  ))}
                  <td><button className="more-button" onClick={() => action(`Opening ${row[0]}`)}>•••</button></td>
                </tr>
              ))}
              {roleKey === 'Manager' && (managerData?.requests || []).filter(r => r.status === 'PENDING').length === 0 && (
                <tr><td colSpan="5" style={{textAlign:'center', padding:'20px', color:'#9aa5b5'}}>No pending requests.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}

// ─── Workspace page ────────────────────────────────────────────────────────────
function WorkspacePage({ active, action, customerData, employeeData, managerData, session, refresh, refreshEmployee, refreshManager }) {
  const titles = {
    'Transfer money': ['Send money securely', 'Move money to a saved beneficiary or a new account.'],
    Beneficiaries:   ['Your beneficiaries', 'Manage the people and businesses you send money to.'],
    Transactions:    ['Transaction history', 'Search and review activity across your accounts.'],
    Customers:       ['Customer directory', 'Search, review, and support your customer portfolio.'],
    Employees:       ['Team members', 'Manage access and responsibilities across your branch.'],
    Requests:        ['Requests & approvals', 'Review items waiting for a decision.'],
    Security:        ['Security activity', 'A clear view of important account and team events.'],
    Reports:         ['Reports & insights', 'Understand the performance of your banking operation.'],
    Profile:         ['Your profile', 'Keep your personal details and preferences up to date.'],
  }
  const [title, description] = titles[active] || ['Change password', 'Keep your account secure with a strong, unique password.']

  let Content
  const isCust = session?.user?.role === 'CUSTOMER'
  const isEmp  = session?.user?.role === 'EMPLOYEE'
  const isMgr  = session?.user?.role === 'MANAGER'

  if (active === 'Transfer money')                        Content = <TransferForm action={action} customerData={customerData} session={session} refresh={refresh} />
  else if (active === 'Customers'  && (isEmp || isMgr))  Content = <Directory active={active} action={action} employeeData={isEmp ? employeeData : managerData} session={session} refreshEmployee={isEmp ? refreshEmployee : refreshManager} isMgr={isMgr} />
  else if (active === 'Employees'  && isMgr)             Content = <Directory active={active} action={action} employeeData={managerData} session={session} refreshEmployee={refreshManager} isMgr={isMgr} />
  else if (active === 'Transactions' && isCust)          Content = <TransactionsPanel action={action} customerData={customerData} />
  else if (active === 'Transactions' && isEmp)           Content = <GenericPanel active={active} action={action} employeeData={employeeData} session={session} refreshEmployee={refreshEmployee} />
  else if (active === 'Transactions' && isMgr)           Content = <ManagerTransactionsPanel action={action} managerData={managerData} />
  else if (active === 'Requests'   && isEmp)             Content = <GenericPanel active={active} action={action} employeeData={employeeData} session={session} refreshEmployee={refreshEmployee} />
  else if (active === 'Requests'   && isMgr)             Content = <ManagerRequestsPanel action={action} managerData={managerData} session={session} refreshManager={refreshManager} />
  else if (active === 'Beneficiaries' && isCust)         Content = <BeneficiariesPanel action={action} customerData={customerData} session={session} refresh={refresh} />
  else if (active === 'Profile'    && isCust)            Content = <ProfileForm action={action} customerData={customerData} session={session} refresh={refresh} />
  else if (active === 'Profile'    && isEmp)             Content = <ProfileForm action={action} employeeData={employeeData} session={session} refresh={refreshEmployee} />
  else if (active === 'Profile'    && isMgr)             Content = <ManagerProfileForm action={action} managerData={managerData} session={session} refresh={refreshManager} />
  else if (active === 'Security'   && isMgr)             Content = <ManagerSecurityPanel action={action} managerData={managerData} session={session} refreshManager={refreshManager} />
  else if (active === 'Security')                        Content = <PasswordForm action={action} session={session} />
  else if (active === 'Reports'    && isMgr)             Content = <ManagerReportsPanel action={action} managerData={managerData} />
  else Content = <GenericPanel active={active} action={action} employeeData={employeeData} />

  return (
    <section className="workspace-page">
      {active === 'Bug Lab' ? (
        Content
      ) : (
        <>
          <div className="page-intro">
            <div className="large-symbol">{active === 'Transfer money' ? '↗' : active === 'Security' ? '◈' : active === 'Reports' ? '▥' : '✦'}</div>
            <div><h2>{title}</h2><p>{description}</p></div>
          </div>
          {Content}
        </>
      )}
    </section>
  )
}

function TransferForm({ action, customerData, session, refresh }) {
  const [amount, setAmount] = useState('')
  const [toBeneficiaryId, setToBeneficiaryId] = useState('')
  const [reference, setReference] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const account = customerData?.account
  const beneficiaries = customerData?.beneficiaries || []
  const bal = account ? formatINR(account.balance) : ''
  const accNum = account ? '•• ' + account.account_number.slice(-4) : '••'

  const handleSubmit = async () => {
    if (!amount || !toBeneficiaryId) {
      action('Please enter amount and select beneficiary')
      return
    }
    setError('')
    setLoading(true)
    try {
      await apiPost('/customer/transfer', { beneficiary_id: parseInt(toBeneficiaryId), amount: parseFloat(amount), reference: reference }, session.access_token)
      action('Transfer completed successfully')
      setAmount('')
      setReference('')
      setToBeneficiaryId('')
      if (refresh) refresh()
    } catch (err) {
      setError(err.message || 'Transfer failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="form-panel">
      <div className="form-field"><label>From account</label><div className="fake-input"><span className="account-chip">••</span><span>Everyday account <small>{accNum} • {bal}</small></span><b>⌄</b></div></div>
      <div className="form-field">
        <label>To beneficiary</label>
        <select className="text-input" value={toBeneficiaryId} onChange={(e) => setToBeneficiaryId(e.target.value)}>
          <option value="">Select a beneficiary</option>
          {beneficiaries.map(b => (
            <option key={b.id} value={b.id}>{b.beneficiary_name} (•• {b.account_number.slice(-4)})</option>
          ))}
        </select>
      </div>
      <div className="form-row">
        <div className="form-field"><label>Amount</label><div className="amount-input"><span>₹</span><input type="number" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} /></div></div>
        <div className="form-field"><label>When</label><div className="fake-input compact">Today <b>⌄</b></div></div>
      </div>
      <div className="form-field"><label>Reference <small>(optional)</small></label><input className="text-input" placeholder="What is this for?" value={reference} onChange={e => setReference(e.target.value)} /></div>
      {error && <div className="login-error">{error}</div>}
      <div className="form-footer"><span>Transfers are protected by Northstar Secure.</span><button className="primary-button" onClick={handleSubmit} disabled={loading}>{loading ? 'Processing...' : 'Continue →'}</button></div>
    </div>
  )
}

function TransactionsPanel({ action, customerData }) {
  const transactionsList = customerData?.transactions || []
  return (
    <div className="panel generic-panel">
      <div className="directory-toolbar">
        <div className="search"><span>⌕</span><input placeholder="Search activity..." /></div>
        <button className="select-button">All statuses ⌄</button>
      </div>
      {transactionsList.length === 0 ? (
        <div style={{padding:'20px', textAlign:'center', color:'#9aa5b5'}}>No transactions found.</div>
      ) : transactionsList.map(tx => {
        const isDebit = tx.sender_account_id === customerData?.account?.id
        return (
          <div className="generic-row" key={tx.id}>
            <span className={`transaction-icon ${isDebit ? 'debit' : 'credit'}`}>{tx.transaction_type[0]}</span>
            <div><b>{tx.description || tx.transaction_type}</b><small>{tx.transaction_type} - {new Date(tx.created_at).toLocaleDateString()}</small></div>
            <strong>{(isDebit ? '-' : '+') + formatINR(Math.abs(tx.amount))}</strong>
            <button className="text-button" onClick={() => action(`Opening ${tx.id}`)}>View →</button>
          </div>
        )
      })}
    </div>
  )
}

// ─── Manager Transactions Panel ───────────────────────────────────────────────
function ManagerTransactionsPanel({ action, managerData }) {
  const txList = managerData?.transactions || []
  return (
    <div className="panel generic-panel">
      <div className="directory-toolbar">
        <div className="search"><span>⌕</span><input placeholder="Search transactions..." /></div>
        <button className="select-button">All types ⌄</button>
      </div>
      {txList.length === 0 ? (
        <div style={{padding:'20px', textAlign:'center', color:'#9aa5b5'}}>No transactions found.</div>
      ) : txList.map(tx => {
        const senderName   = tx.sender?.users?.name   || 'Unknown'
        const receiverName = tx.receiver?.users?.name || 'Unknown'
        return (
          <div className="generic-row" key={tx.id}>
            <span className={`transaction-icon ${(tx.amount >= 10000) ? 'debit' : 'credit'}`}>{tx.transaction_type[0]}</span>
            <div>
              <b>{tx.description || tx.transaction_type}</b>
              <small>{senderName} → {receiverName} · {new Date(tx.created_at).toLocaleDateString()}</small>
            </div>
            <strong>{formatINR(Math.abs(tx.amount))}</strong>
            <span className={`status ${(tx.status || 'completed').toLowerCase()}`}>{tx.status || 'COMPLETED'}</span>
            {(tx.amount >= 10000) && <span className="status review" style={{marginLeft:'6px'}}>⚠ Suspicious</span>}
            <button className="text-button" onClick={() => action(`Transaction ${tx.id}`)}>View →</button>
          </div>
        )
      })}
    </div>
  )
}

// ─── Manager Requests Panel ───────────────────────────────────────────────────
function ManagerRequestsPanel({ action, managerData, session, refreshManager }) {
  const [handling, setHandling] = useState(null)
  const requests = managerData?.requests || []

  const handleDecision = async (id, status) => {
    if (!id || !session) return
    setHandling(id)
    try {
      await apiPut(`/manager/requests/${id}`, { status }, session.access_token)
      action(`Request ${status.toLowerCase()} successfully`)
      if (refreshManager) await refreshManager()
    } catch (e) {
      action(e.message || 'Error processing request')
    } finally {
      setHandling(null)
    }
  }

  return (
    <div className="panel generic-panel">
      <div className="directory-toolbar">
        <div className="search"><span>⌕</span><input placeholder="Search requests..." /></div>
        <button className="select-button">All statuses ⌄</button>
      </div>
      {requests.length === 0 ? (
        <div style={{padding:'20px', textAlign:'center', color:'#9aa5b5'}}>No requests found.</div>
      ) : requests.map(req => {
        const custName = req.users?.name || 'Unknown Customer'
        return (
          <div className="generic-row" key={req.id}>
            <span className={`transaction-icon ${req.status === 'PENDING' ? 'warning' : 'credit'}`}>✓</span>
            <div>
              <b>{req.request_type}</b>
              <small>{custName} • {new Date(req.created_at).toLocaleDateString()}{req.description ? ` • ${req.description}` : ''}</small>
            </div>
            <strong>{req.description || '—'}</strong>
            {req.status === 'PENDING' ? (
              <div style={{display:'flex', gap:'10px'}}>
                <button className="text-button" disabled={handling === req.id} style={{color:'var(--coral)'}} onClick={() => handleDecision(req.id, 'REJECTED')}>Reject</button>
                <button className="primary-button" disabled={handling === req.id} style={{padding:'6px 12px', fontSize:'13px'}} onClick={() => handleDecision(req.id, 'APPROVED')}>{handling === req.id ? '...' : 'Approve'}</button>
              </div>
            ) : (
              <span className={`status ${req.status?.toLowerCase()}`}>{req.status}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Manager Security Panel ───────────────────────────────────────────────────
// Shows the live security event log AND the vulnerability control toggles.
function ManagerSecurityPanel({ action, managerData, session, refreshManager }) {
  const events = managerData?.securityEvents || []
  const token = session?.access_token

  const [flags, setFlags] = useState({ BUG_MFA: false, BUG_SQLI: false, BUG_IDOR: false })
  const [flagsLoaded, setFlagsLoaded] = useState(false)
  const [toggling, setToggling] = useState(null)

  useEffect(() => {
    if (!token) return
    apiGet('/bugs/flags', token)
      .then(d => { setFlags(d.flags); setFlagsLoaded(true) })
      .catch(() => setFlagsLoaded(true))
  }, [token])

  async function handleToggle(flag) {
    setToggling(flag)
    try {
      const d = await apiPost('/bugs/toggle', { flag }, token)
      setFlags(d.flags)
      // Refresh security events so new events from the toggle appear
      if (refreshManager) await refreshManager()
      action(`Vulnerability ${flag} ${d.enabled ? 'activated' : 'deactivated'}`)
    } catch (e) {
      action(e.message || 'Failed to toggle')
    } finally {
      setToggling(null)
    }
  }

  const vulnMeta = [
    { flag: 'BUG_MFA',  label: 'MFA Bypass',          risk: 'CRITICAL', cwe: 'CWE-308', detail: 'Disables OTP step on login. All accounts become single-factor.' },
    { flag: 'BUG_SQLI', label: 'SQL Injection',        risk: 'HIGH',     cwe: 'CWE-89',  detail: 'Customer search accepts unsanitized input. Filter injection possible.' },
    { flag: 'BUG_IDOR', label: 'Broken Access Control',risk: 'HIGH',     cwe: 'CWE-639', detail: 'Account endpoint skips ownership check. Any account ID accessible.' },
  ]
  const riskCol = { CRITICAL: '#ff4757', HIGH: '#ff6b35', MEDIUM: '#ffa502', LOW: '#2ed573' }

  return (
    <div>
      {/* Vulnerability Control Panel */}
      <div style={{
        background: 'linear-gradient(135deg, #0f1923, #1a2332)',
        borderRadius: '14px',
        padding: '22px 26px',
        marginBottom: '22px',
        border: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
          <div style={{ fontSize: '18px' }}>🛡️</div>
          <div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: '15px' }}>Vulnerability Controls</div>
            <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: '12px', marginTop: '1px' }}>Risk Assessment Platform · Activate to simulate real attack surface</div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
            {[flags.BUG_MFA, flags.BUG_SQLI, flags.BUG_IDOR].filter(Boolean).length > 0 && (
              <span style={{ padding: '4px 10px', borderRadius: '20px', background: 'rgba(255,71,87,0.2)', border: '1px solid rgba(255,71,87,0.4)', color: '#ff4757', fontSize: '11px', fontWeight: 700 }}>
                ⚠ {[flags.BUG_MFA, flags.BUG_SQLI, flags.BUG_IDOR].filter(Boolean).length} ACTIVE
              </span>
            )}
          </div>
        </div>
        {!flagsLoaded ? (
          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>Loading controls...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {vulnMeta.map(v => (
              <div key={v.flag} style={{
                display: 'flex', alignItems: 'center', gap: '14px',
                padding: '12px 16px', borderRadius: '10px',
                background: flags[v.flag] ? 'rgba(255,71,87,0.1)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${flags[v.flag] ? 'rgba(255,71,87,0.3)' : 'rgba(255,255,255,0.06)'}`,
                transition: 'all 0.25s',
              }}>
                {/* Status dot */}
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                  background: flags[v.flag] ? '#ff4757' : '#2ed573',
                  boxShadow: `0 0 6px ${flags[v.flag] ? '#ff4757' : '#2ed573'}`,
                }} />
                {/* Labels */}
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: '#e8edf2', fontWeight: 600, fontSize: '13px' }}>{v.label}</span>
                    <span style={{ padding: '2px 6px', borderRadius: '5px', fontSize: '10px', fontWeight: 700,
                      background: `${riskCol[v.risk]}22`, color: riskCol[v.risk] }}>{v.risk}</span>
                    <span style={{ padding: '2px 6px', borderRadius: '5px', fontSize: '10px',
                      background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>{v.cwe}</span>
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11.5px', marginTop: '2px' }}>{v.detail}</div>
                </div>
                {/* Toggle */}
                <button
                  onClick={() => handleToggle(v.flag)}
                  disabled={toggling === v.flag}
                  style={{
                    position: 'relative', width: '46px', height: '24px',
                    borderRadius: '12px', border: 'none', cursor: 'pointer',
                    background: flags[v.flag] ? '#ff4757' : 'rgba(255,255,255,0.12)',
                    transition: 'background 0.25s', flexShrink: 0, padding: 0,
                  }}
                  title={flags[v.flag] ? 'Click to deactivate' : 'Click to activate'}
                >
                  <div style={{
                    position: 'absolute', top: '3px',
                    left: flags[v.flag] ? '25px' : '3px',
                    width: '18px', height: '18px', borderRadius: '50%',
                    background: '#fff', transition: 'left 0.25s',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                  }} />
                </button>
              </div>
            ))}
          </div>
        )}
        <div style={{ marginTop: '14px', padding: '10px 14px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', fontSize: '11px', color: 'rgba(255,255,255,0.3)', lineHeight: 1.5 }}>
          All flags reset to OFF on server restart. Events from active vulnerabilities are logged below in real time.
        </div>
      </div>

      {/* Live Security Event Log */}
      <div className="panel generic-panel">
        <div className="directory-toolbar">
          <div className="search"><span>⌕</span><input placeholder="Search security events..." /></div>
          <button className="select-button">All severities ⌄</button>
        </div>
        {events.length === 0 ? (
          <div style={{padding:'20px', textAlign:'center', color:'#9aa5b5'}}>No security events found.</div>
        ) : events.map(ev => (
          <div className="generic-row" key={ev.id}>
            <span className={`transaction-icon ${ev.severity === 'CRITICAL' || ev.severity === 'HIGH' ? 'debit' : ev.severity === 'MEDIUM' ? 'warning' : 'credit'}`}>
              {ev.severity === 'CRITICAL' ? '!!' : ev.severity === 'HIGH' ? '!' : ev.severity === 'MEDIUM' ? '⚠' : '✓'}
            </span>
            <div>
              <b>{ev.event_type}</b>
              <small>{ev.description} • {new Date(ev.created_at).toLocaleString()}{ev.ip_address ? ` • IP: ${ev.ip_address}` : ''}</small>
            </div>
            <span className={`status ${ev.severity === 'CRITICAL' || ev.severity === 'HIGH' ? 'review' : ev.severity === 'MEDIUM' ? 'scheduled' : 'active'}`}>{ev.severity}</span>
            <button className="text-button" onClick={() => action(`Event ${ev.id}`)}>View →</button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Manager Reports Panel ────────────────────────────────────────────────────
function ManagerReportsPanel({ managerData }) {
  const r = managerData?.reports
  const loading = managerData?.loading

  if (loading) return <div style={{padding:'40px', textAlign:'center', color:'#9aa5b5'}}>Loading reports\u2026</div>
  if (!r)      return <div style={{padding:'40px', textAlign:'center', color:'#9aa5b5'}}>No report data available.</div>

  const t = r.totals
  const fmt    = (n) => Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 })
  const fmtCur = (n) => formatINR(n)

  return (
    <div>
      <div style={{marginBottom:'12px', color:'#9aa5b5', fontSize:'13px'}}>
        Report generated: {new Date(r.generated_at).toLocaleString()}
      </div>
      <section className="metric-grid four">
        {[
          ['Total Customers',    fmt(t.customers),     'Registered accounts'],
          ['Total Employees',    fmt(t.employees),     'Active staff'],
          ['Total Transactions', fmt(t.transactions),  'All time'],
          ['Total Deposits',     fmtCur(t.deposits),   'Across all accounts'],
        ].map(([label, value, note]) => (
          <div className="metric-card" key={label}>
            <div className="metric-top"><span>{label}</span><span className="metric-icon tint-0">\u2197</span></div>
            <strong>{value}</strong>
            <small><span>\u2197</span> {note}</small>
          </div>
        ))}
      </section>
      <section className="metric-grid" style={{marginTop:'16px'}}>
        {[
          ['Pending Requests',        fmt(t.pendingRequests),        t.pendingRequests > 0 ? `${t.pendingRequests} need attention` : 'All processed'],
          ['Suspicious Transactions', fmt(t.suspiciousTransactions), t.suspiciousTransactions > 0 ? `${t.suspiciousTransactions} flagged` : 'None flagged'],
        ].map(([label, value, note], index) => (
          <div className="metric-card" key={label}>
            <div className="metric-top"><span>{label}</span><span className={`metric-icon tint-${index + 2}`}>{index === 0 ? '\u25d2' : '!'}</span></div>
            <strong>{value}</strong>
            <small className={note.includes('attention') || note.includes('flagged') ? 'warning-text' : ''}><span>\u2197</span> {note}</small>
          </div>
        ))}
      </section>

      {t.suspiciousTransactions > 0 && (
        <section className="panel table-panel" style={{marginTop:'24px'}}>
          <div className="panel-heading">
            <div><h2>Suspicious Transactions</h2><p>Transactions flagged for review</p></div>
          </div>
          <div className="table-scroll">
            <table>
              <thead><tr><th>ID</th><th>TYPE</th><th>AMOUNT</th><th>DATE</th><th>STATUS</th></tr></thead>
              <tbody>
                {(managerData?.suspiciousTransactions || []).slice(0, 10).map(tx => (
                  <tr key={tx.id}>
                    <td>{tx.id}</td>
                    <td>{tx.transaction_type}</td>
                    <td className="amount-cell">{formatINR(Math.abs(tx.amount))}</td>
                    <td>{new Date(tx.created_at).toLocaleDateString()}</td>
                    <td className="status-cell"><span className="status review">⚠ Suspicious</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}

// ─── Manager Profile Form ─────────────────────────────────────────────────────
function ManagerProfileForm({ action, managerData, session, refresh }) {
  const profile = managerData?.profile
  const [department, setDepartment] = useState('')
  const [branch,     setBranch]     = useState('')
  const [loading,    setLoading]    = useState(false)

  useEffect(() => {
    if (profile) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDepartment(profile.department || '')
      setBranch(profile.branch || '')
    }
  }, [profile])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await apiPut('/manager/profile', { department, branch }, session.access_token)
      action('Profile updated successfully')
      if (refresh) refresh()
    } catch (err) {
      action(err.message || 'Error updating profile')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="form-panel">
      <form onSubmit={handleSubmit}>
        <div className="form-field"><label>Name</label><input className="text-input" value={session?.user?.name || ''} disabled /></div>
        <div className="form-field"><label>Email address</label><input className="text-input" value={session?.user?.email || ''} disabled /></div>
        <div className="form-field"><label>Department</label><input className="text-input" value={department} onChange={e => setDepartment(e.target.value)} /></div>
        <div className="form-field"><label>Branch</label><input className="text-input" value={branch} onChange={e => setBranch(e.target.value)} /></div>
        <div className="form-footer"><span /><button type="submit" disabled={loading} className="primary-button">{loading ? 'Saving...' : 'Save Profile'}</button></div>
      </form>
    </div>
  )
}

function BeneficiariesPanel({ action, customerData, session, refresh }) {
  const beneficiariesList = customerData?.beneficiaries || []
  const [name, setName] = useState('')
  const [accNum, setAccNum] = useState('')
  const [bank, setBank] = useState('')
  const [ifsc, setIfsc] = useState('')
  const [loading, setLoading] = useState(false)

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!name || !accNum || !bank || !ifsc) return
    setLoading(true)
    try {
      await apiPost('/customer/beneficiaries', { beneficiary_name: name, account_number: accNum, bank_name: bank, ifsc }, session.access_token)
      action('Beneficiary added')
      setName(''); setAccNum(''); setBank(''); setIfsc('');
      if (refresh) refresh()
    } catch (err) {
      action(err.message || 'Error adding beneficiary')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete beneficiary?')) return
    try {
      await apiDelete(`/customer/beneficiaries/${id}`, session.access_token)
      action('Beneficiary deleted')
      if (refresh) refresh()
    } catch (err) {
      action(err.message || 'Error deleting beneficiary')
    }
  }

  return (
    <>
      <div className="form-panel" style={{marginBottom: '20px'}}>
        <h3 style={{marginBottom:'15px', fontSize:'14px', color:'#39465d'}}>Add Beneficiary</h3>
        <form onSubmit={handleAdd} className="form-row">
          <div className="form-field"><label>Name</label><input required className="text-input" value={name} onChange={e=>setName(e.target.value)} placeholder="Jane Doe" /></div>
          <div className="form-field"><label>Account Number</label><input required className="text-input" value={accNum} onChange={e=>setAccNum(e.target.value)} placeholder="0000000000" /></div>
          <div className="form-field"><label>Bank Name</label><input required className="text-input" value={bank} onChange={e=>setBank(e.target.value)} placeholder="Bank Name" /></div>
          <div className="form-field"><label>IFSC Code</label><input required className="text-input" value={ifsc} onChange={e=>setIfsc(e.target.value)} placeholder="ABCD0123456" /></div>
          <div className="form-field" style={{display:'flex', alignItems:'flex-end'}}><button type="submit" disabled={loading} className="primary-button" style={{width:'100%', justifyContent:'center'}}>{loading ? 'Adding...' : 'Add Beneficiary'}</button></div>
        </form>
      </div>

      <div className="panel directory-panel">
        <div className="table-scroll">
          <table>
            <thead><tr><th>NAME</th><th>ACCOUNT NUMBER</th><th>BANK NAME</th><th>STATUS</th><th /></tr></thead>
            <tbody>
              {beneficiariesList.map((b) => (
                <tr key={b.id}>
                  <td className="person-cell"><span className="avatar">{(b.beneficiary_name || '').split(' ').map((n) => n[0] || '').join('').slice(0, 2)}</span><b>{b.beneficiary_name}</b></td>
                  <td>•• {b.account_number.slice(-4)}</td>
                  <td>{b.bank_name}</td>
                  <td className="status-cell"><span className="status active">Active</span></td>
                  <td><button className="text-button" style={{color:'var(--coral)'}} onClick={() => handleDelete(b.id)}>Delete</button></td>
                </tr>
              ))}
              {beneficiariesList.length === 0 && <tr><td colSpan="5" style={{textAlign:'center', padding:'20px', color:'#9aa5b5'}}>No beneficiaries found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

function ProfileForm({ action, customerData, employeeData, session, refresh }) {
  const profile = customerData?.profile || employeeData?.profile
  const isEmp = session?.user?.role === 'EMPLOYEE'

  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [department, setDepartment] = useState('')
  const [branch, setBranch] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (profile) {
      if (!isEmp) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPhone(profile.phone_number || '')
        setAddress(profile.address || '')
      } else {
        setDepartment(profile.department || '')
        setBranch(profile.branch || '')
      }
    }
  }, [profile, isEmp])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const endpoint = isEmp ? '/employee/profile' : '/customer/profile'
      const payload = isEmp ? { department, branch } : { phone_number: phone, address }
      await apiPut(endpoint, payload, session.access_token)
      action('Profile updated successfully')
      if (refresh) refresh()
    } catch (err) {
      action(err.message || 'Error updating profile')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="form-panel">
      <form onSubmit={handleSubmit}>
        <div className="form-field"><label>Email address</label><input className="text-input" value={session?.user?.email || ''} disabled /></div>
        {!isEmp && (
          <>
            <div className="form-field"><label>Phone number</label><input className="text-input" value={phone} onChange={e=>setPhone(e.target.value)} /></div>
            <div className="form-field"><label>Address</label><input className="text-input" value={address} onChange={e=>setAddress(e.target.value)} /></div>
          </>
        )}
        {isEmp && (
          <>
            <div className="form-field"><label>Department</label><input className="text-input" value={department} onChange={e=>setDepartment(e.target.value)} /></div>
            <div className="form-field"><label>Branch</label><input className="text-input" value={branch} onChange={e=>setBranch(e.target.value)} /></div>
          </>
        )}
        <div className="form-footer"><span/><button type="submit" disabled={loading} className="primary-button">{loading ? 'Saving...' : 'Save Profile'}</button></div>
      </form>
    </div>
  )
}

function PasswordForm({ action, session }) {
  const [currentPassword, setCurrent] = useState('')
  const [newPassword, setNew] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await apiPut('/customer/password', { currentPassword, newPassword }, session.access_token)
      action('Password updated successfully')
      setCurrent(''); setNew('');
    } catch (err) {
      setError(err.message || 'Error changing password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="form-panel">
      <form onSubmit={handleSubmit}>
        <div className="form-field"><label>Current password</label><input type="password" required className="text-input" value={currentPassword} onChange={e=>setCurrent(e.target.value)} /></div>
        <div className="form-field"><label>New password</label><input type="password" required className="text-input" value={newPassword} onChange={e=>setNew(e.target.value)} /></div>
        {error && <div className="login-error">{error}</div>}
        <div className="form-footer"><span/><button type="submit" disabled={loading} className="primary-button">{loading ? 'Saving...' : 'Change Password'}</button></div>
      </form>
    </div>
  )
}

function NewCustomerForm({ onCancel, onSuccess, session, action }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await apiPost('/employee/customers', { name, email, phone, address }, session.access_token)
      action('Customer created successfully')
      onSuccess()
    } catch (err) {
      setError(err.message || 'Error creating customer')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="form-panel" style={{marginBottom: '20px'}}>
      <h3 style={{marginBottom:'15px', fontSize:'14px', color:'#39465d'}}>Add New Customer</h3>
      <form onSubmit={handleSubmit} className="form-row">
        <div className="form-field"><label>Full Name</label><input required className="text-input" value={name} onChange={e=>setName(e.target.value)} placeholder="Jane Doe" /></div>
        <div className="form-field"><label>Email</label><input required type="email" className="text-input" value={email} onChange={e=>setEmail(e.target.value)} placeholder="jane@example.com" /></div>
        <div className="form-field"><label>Phone</label><input required className="text-input" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+1-555-1234" /></div>
        <div className="form-field"><label>Address</label><input required className="text-input" value={address} onChange={e=>setAddress(e.target.value)} placeholder="123 Main St" /></div>
        <div className="form-field" style={{display:'flex', gap:'10px', alignItems:'flex-end'}}>
          <button type="button" className="text-button" onClick={onCancel}>Cancel</button>
          <button type="submit" disabled={loading} className="primary-button" style={{flex: 1, justifyContent:'center'}}>{loading ? 'Creating...' : 'Create'}</button>
        </div>
      </form>
      {error && <div className="login-error" style={{marginTop: '10px'}}>{error}</div>}
    </div>
  )
}

function Directory({ active, action, employeeData, session, refreshEmployee, isMgr }) {
  const [showAdd, setShowAdd] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [searching, setSearching] = useState(false)
  let rows = customers

  if (active === 'Employees') {
    if (employeeData?.employees && employeeData.employees.length > 0) {
      rows = employeeData.employees.map(e => [
        e.users?.name || `Employee ${e.user_id}`,
        e.department || 'Staff',
        e.branch || '—',
        e.users?.status || 'ACTIVE'
      ])
    } else {
      rows = []
    }
  } else if (active === 'Customers' && employeeData?.customers) {
    rows = employeeData.customers.map(c => [
      c.users?.name || c.name || 'Unknown',
      c.customer_id || c.email || '',
      'Northstar Secure',
      c.users?.status || c.status || 'Active'
    ])
  }

  // If search results exist, display them instead (may include injection results)
  const displayRows = searchResults !== null ? searchResults : rows

  async function handleSearch(e) {
    const val = e.target.value
    setSearchQuery(val)
    if (!val.trim()) { setSearchResults(null); return }
    setSearching(true)
    try {
      const token = session?.access_token
      const endpoint = isMgr ? '/manager/customers' : '/employee/customers'
      const data = await apiGet(`${endpoint}?search=${encodeURIComponent(val)}`, token)
      // Data could be customer_profiles (normal) or raw users (injected) — display whatever came back
      const normalized = Array.isArray(data) ? data.map(r => [
        r.users?.name || r.name || 'Unknown',
        r.customer_id || r.email || r.id || '',
        r.role || 'Northstar Secure',
        r.users?.status || r.status || 'Active'
      ]) : []
      setSearchResults(normalized)
    } catch {
      setSearchResults(null)
    } finally {
      setSearching(false)
    }
  }

  return (
    <>
      {showAdd && active === 'Customers' && !isMgr && (
        <NewCustomerForm
          action={action}
          session={session}
          onCancel={() => setShowAdd(false)}
          onSuccess={() => { setShowAdd(false); refreshEmployee(); }}
        />
      )}
      <div className="panel directory-panel">
        <div className="directory-toolbar">
          <div className="search">
            <span>⌕</span>
            <input
              placeholder={`Search ${active.toLowerCase()}...`}
              value={searchQuery}
              onChange={handleSearch}
            />
            {searching && <span style={{ fontSize: '11px', color: '#9aa5b5', marginLeft: '6px' }}>Searching...</span>}
          </div>
          {!isMgr && (
            <button className="primary-button" onClick={() => {
              if (active === 'Customers') setShowAdd(!showAdd)
              else action('New employee form opened')
            }}>+ Add {active === 'Employees' ? 'employee' : 'customer'}</button>
          )}
        </div>
        <div className="table-scroll">
          <table>
            <thead><tr><th>NAME</th><th>{active === 'Employees' ? 'DEPARTMENT' : 'CUSTOMER ID'}</th><th>{active === 'Employees' ? 'BRANCH' : 'PLAN'}</th><th>STATUS</th><th /></tr></thead>
            <tbody>
              {displayRows.map((row, rIdx) => (
                <tr key={row[0] + rIdx}>
                  <td className="person-cell"><span className="avatar">{(row[0]||'').split(' ').map((n) => n[0]).join('')}</span><b>{row[0]}</b></td>
                  {row.slice(1).map((cell, index) => (
                    <td key={cell + index} className={index === 2 ? 'status-cell' : ''}>
                      {index === 2 ? <span className={`status ${cell.toLowerCase()}`}>{cell}</span> : cell}
                    </td>
                  ))}
                  <td><button className="more-button" onClick={() => action(`Opening ${row[0]}`)}>•••</button></td>
                </tr>
              ))}
              {displayRows.length === 0 && <tr><td colSpan="5" style={{textAlign:'center', padding:'20px', color:'#9aa5b5'}}>No {active.toLowerCase()} found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

function GenericPanel({ active, action, employeeData, session, refreshEmployee }) {
  let items
  if (active === 'Transactions' && employeeData?.transactions) {
    items = employeeData.transactions.map(tx => {
      const senderName = tx.sender?.users?.name || 'Unknown Sender'
      const receiverName = tx.receiver?.users?.name || 'Unknown Receiver'
      return [
        `${tx.transaction_type} - ${tx.description || 'Transfer'}`,
        `${senderName} → ${receiverName} - ${new Date(tx.created_at).toLocaleDateString()}`,
        formatINR(Math.abs(tx.amount)),
        tx.status
      ]
    })
  } else if (active === 'Requests' && employeeData?.requests) {
    items = employeeData.requests.map(req => {
      const custName = req.users?.name || 'Unknown Customer'
      return [
        req.request_type,
        `${custName} - ${new Date(req.created_at).toLocaleDateString()}`,
        req.description,
        req.status,
        req.id
      ]
    })
  } else {
    items = active === 'Transactions'
      ? transactions
      : [['Account review request', 'Olivia Bennett - 5 min ago', 'Needs review', 'PENDING', null]]
  }

  const [handling, setHandling] = useState(null)
  const handleDecision = async (id, status) => {
    if (!id || !session) return
    setHandling(id)
    try {
      await apiPut(`/employee/requests/${id}`, { status }, session.access_token)
      action(`Request ${status.toLowerCase()} successfully`)
      if (refreshEmployee) await refreshEmployee()
    } catch (e) {
      action(e.message || 'Error processing request')
    } finally {
      setHandling(null)
    }
  }

  return (
    <div className="panel generic-panel">
      <div className="directory-toolbar">
        <div className="search"><span>⌕</span><input placeholder="Search activity..." /></div>
        <button className="select-button">All statuses ⌄</button>
      </div>
      {items.map((item, index) => (
        <div className="generic-row" key={item[0] + index}>
          <span className={`transaction-icon ${item[3] === 'PENDING' ? 'warning' : 'credit'}`}>{active === 'Transactions' ? item[0][0] : '✓'}</span>
          <div><b>{item[0]}</b><small>{item[1]}</small></div>
          <strong>{item[2]}</strong>

          {active === 'Requests' && item[3] === 'PENDING' && item[4] ? (
            <div style={{display:'flex', gap:'10px'}}>
              <button className="text-button" disabled={handling === item[4]} style={{color:'var(--coral)'}} onClick={() => handleDecision(item[4], 'REJECTED')}>Reject</button>
              <button className="primary-button" disabled={handling === item[4]} style={{padding: '6px 12px', fontSize: '13px'}} onClick={() => handleDecision(item[4], 'APPROVED')}>{handling === item[4] ? '...' : 'Approve'}</button>
            </div>
          ) : (
            <button className="text-button" onClick={() => action(`Opening ${item[0]}`)}>
              {active === 'Requests' ? <span className={`status ${item[3]?.toLowerCase()}`}>{item[3]}</span> : 'View →'}
            </button>
          )}
        </div>
      ))}
      {items.length === 0 && <div style={{padding:'20px', textAlign:'center', color:'#9aa5b5'}}>No {active.toLowerCase()} found.</div>}
    </div>
  )
}

// ─── Bug Lab Panel ─────────────────────────────────────────────────────────────
// Phase 1 + 2 + 3 vulnerability simulation controls. MANAGER ONLY.
function BugLabPanel({ session, action }) {
  const token = session?.access_token

  // Flags state
  const [flags, setFlags] = useState({ BUG_MFA: false, BUG_SQLI: false, BUG_IDOR: false })
  const [flagsLoading, setFlagsLoading] = useState(true)

  // Phase 1 state
  const [mfaTarget, setMfaTarget] = useState('')
  const [mfaResult, setMfaResult] = useState(null)
  const [mfaLoading, setMfaLoading] = useState(false)
  const [mfaError, setMfaError] = useState('')

  // Phase 2 state
  const [sqliQuery, setSqliQuery] = useState('')
  const [sqliResult, setSqliResult] = useState(null)
  const [sqliLoading, setSqliLoading] = useState(false)
  const [sqliError, setSqliError] = useState('')

  // Phase 3 state
  const [idorAccountId, setIdorAccountId] = useState('')
  const [idorResult, setIdorResult] = useState(null)
  const [idorLoading, setIdorLoading] = useState(false)
  const [idorError, setIdorError] = useState('')
  const [idorAccounts, setIdorAccounts] = useState(null)
  const [idorListLoading, setIdorListLoading] = useState(false)

  // Load flags on mount
  useEffect(() => {
    loadFlags()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadFlags() {
    setFlagsLoading(true)
    try {
      const data = await apiGet('/bugs/flags', token)
      setFlags(data.flags)
    } catch (e) {
      console.error('Failed to load bug flags', e)
    } finally {
      setFlagsLoading(false)
    }
  }

  async function handleToggle(flag) {
    try {
      const data = await apiPost('/bugs/toggle', { flag }, token)
      setFlags(data.flags)
      action(`${flag} ${data.enabled ? 'ENABLED ⚠' : 'disabled ✓'}`)
    } catch (e) {
      action(e.message || 'Toggle failed')
    }
  }

  // Phase 1 – Trigger MFA bypass simulation
  async function handleMfaTrigger(e) {
    e.preventDefault()
    if (!mfaTarget) return
    setMfaLoading(true); setMfaError(''); setMfaResult(null)
    try {
      const data = await apiPost('/bugs/trigger/mfa-bypass', { target_email: mfaTarget }, token)
      setMfaResult(data)
      action('Attack simulation complete — check Security panel')
    } catch (err) {
      setMfaError(err.message || 'Simulation failed')
    } finally {
      setMfaLoading(false)
    }
  }

  // Phase 2 – SQL injection test
  async function handleSqliSearch(e) {
    e.preventDefault()
    if (sqliQuery === '') return
    setSqliLoading(true); setSqliError(''); setSqliResult(null)
    try {
      const data = await apiPost('/bugs/search', { query: sqliQuery }, token)
      setSqliResult(data)
    } catch (err) {
      setSqliError(err.message || 'Search failed')
    } finally {
      setSqliLoading(false)
    }
  }

  // Phase 3 – IDOR account fetch
  async function handleIdorFetch(e) {
    e.preventDefault()
    if (!idorAccountId) return
    setIdorLoading(true); setIdorError(''); setIdorResult(null)
    try {
      const data = await apiGet(`/bugs/account?account_id=${idorAccountId}`, token)
      setIdorResult(data)
    } catch (err) {
      setIdorError(err.message || 'Fetch failed')
    } finally {
      setIdorLoading(false)
    }
  }

  // Phase 3 – Enumerate all accounts (to find targets)
  async function handleIdorList() {
    setIdorListLoading(true); setIdorAccounts(null)
    try {
      const data = await apiGet('/bugs/accounts/list', token)
      setIdorAccounts(data)
    } catch (err) {
      setIdorError(err.message || 'List failed')
    } finally {
      setIdorListLoading(false)
    }
  }

  const bugMeta = [
    {
      flag: 'BUG_MFA',
      phase: 1,
      title: 'MFA Disabled / Account Takeover',
      risk: 'CRITICAL',
      description: 'When enabled, the OTP step is skipped entirely on login. Any valid email+password immediately grants a full session — no MFA challenge issued. Also exposes a trigger to simulate a full brute-force → account takeover attack trail.',
      cve: 'CWE-308: Use of Single-factor Authentication',
    },
    {
      flag: 'BUG_SQLI',
      phase: 2,
      title: 'SQL Injection Vulnerability',
      risk: 'HIGH',
      description: 'When enabled, the search endpoint constructs raw SQL queries using direct string interpolation. User input is never sanitized or parameterized. Payloads like \' OR \'1\'=\'1 or UNION SELECT will return unauthorized data.',
      cve: 'CWE-89: Improper Neutralization of Special Elements in SQL Query',
    },
    {
      flag: 'BUG_IDOR',
      phase: 3,
      title: 'Broken Access Control (IDOR)',
      risk: 'HIGH',
      description: 'When enabled, the account and transaction endpoints do not verify resource ownership. Any authenticated customer can access any other customer\'s account details and full transaction history by guessing or enumerating account IDs.',
      cve: 'CWE-639: Authorization Bypass Through User-Controlled Key',
    },
  ]

  const riskColor = { CRITICAL: '#ff4757', HIGH: '#ff6b35', MEDIUM: '#ffa502', LOW: '#2ed573' }

  return (
    <div style={{ padding: '0', fontFamily: 'inherit' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1a0a2e 0%, #16213e 50%, #0f3460 100%)',
        borderRadius: '16px',
        padding: '28px 32px',
        marginBottom: '24px',
        border: '1px solid rgba(255,71,87,0.3)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: 0, right: 0, width: '300px', height: '100%', background: 'radial-gradient(circle at 80% 50%, rgba(255,71,87,0.15), transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(255,71,87,0.2)', border: '1px solid rgba(255,71,87,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>⚠</div>
          <div>
            <h2 style={{ color: '#fff', margin: 0, fontSize: '22px', fontWeight: 700 }}>Vulnerability Simulation Lab</h2>
            <p style={{ color: 'rgba(255,255,255,0.6)', margin: 0, fontSize: '13px', marginTop: '2px' }}>Internal Risk Assessment Platform · Manager Access Only</p>
          </div>
        </div>
        <p style={{ color: 'rgba(255,255,255,0.75)', margin: 0, fontSize: '13.5px', lineHeight: 1.6 }}>
          Each toggle activates a real, exploitable vulnerability in this banking platform. Use the interactive panels below to trigger and observe each attack. All events are logged to the Security panel for risk scoring.
        </p>
        <div style={{ display: 'flex', gap: '8px', marginTop: '16px', flexWrap: 'wrap' }}>
          {['Northstar Risk Engine v2.1', '3 Vulnerabilities Loaded', 'All Events Logged', 'Manager Auth Required'].map(tag => (
            <span key={tag} style={{ padding: '4px 10px', borderRadius: '20px', background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', fontSize: '11px', border: '1px solid rgba(255,255,255,0.1)' }}>{tag}</span>
          ))}
        </div>
      </div>

      {/* Status bar */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {bugMeta.map(b => (
          <div key={b.flag} style={{
            flex: 1, minWidth: '200px',
            padding: '14px 18px',
            borderRadius: '12px',
            background: flags[b.flag] ? 'rgba(255,71,87,0.12)' : 'rgba(46,213,115,0.08)',
            border: `1px solid ${flags[b.flag] ? 'rgba(255,71,87,0.4)' : 'rgba(46,213,115,0.3)'}`,
            display: 'flex', alignItems: 'center', gap: '12px',
          }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: flags[b.flag] ? '#ff4757' : '#2ed573', boxShadow: `0 0 8px ${flags[b.flag] ? '#ff475780' : '#2ed57380'}`, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: '13px', color: '#39465d' }}>Phase {b.phase}</div>
              <div style={{ fontSize: '11px', color: '#9aa5b5' }}>{flags[b.flag] ? '⚠ VULNERABLE' : '✓ Secure'}</div>
            </div>
            <button
              onClick={() => handleToggle(b.flag)}
              disabled={flagsLoading}
              style={{
                padding: '6px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600,
                background: flags[b.flag] ? '#ff4757' : '#2ed573',
                color: '#fff',
                transition: 'all 0.2s',
              }}
            >
              {flags[b.flag] ? 'Disable' : 'Enable'}
            </button>
          </div>
        ))}
      </div>

      {/* Phase Cards */}
      {bugMeta.map((b) => (
        <div key={b.flag} style={{
          borderRadius: '16px',
          border: `1px solid ${flags[b.flag] ? 'rgba(255,71,87,0.3)' : 'rgba(0,0,0,0.06)'}`,
          background: '#fff',
          marginBottom: '20px',
          overflow: 'hidden',
          boxShadow: flags[b.flag] ? '0 4px 24px rgba(255,71,87,0.1)' : '0 2px 12px rgba(0,0,0,0.04)',
          transition: 'all 0.3s',
        }}>
          {/* Card header */}
          <div style={{
            padding: '20px 24px',
            borderBottom: '1px solid rgba(0,0,0,0.06)',
            display: 'flex', alignItems: 'center', gap: '16px',
            background: flags[b.flag] ? 'linear-gradient(135deg, rgba(255,71,87,0.06), rgba(255,107,53,0.04))' : 'transparent',
          }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: flags[b.flag] ? 'rgba(255,71,87,0.15)' : 'rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>
              {b.phase === 1 ? '🔐' : b.phase === 2 ? '💉' : '🔓'}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#9aa5b5', letterSpacing: '0.08em' }}>PHASE {b.phase}</span>
                <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, background: `${riskColor[b.risk]}22`, color: riskColor[b.risk] }}>{b.risk}</span>
                {flags[b.flag] && <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, background: 'rgba(255,71,87,0.15)', color: '#ff4757', animation: 'none' }}>● ACTIVE</span>}
              </div>
              <h3 style={{ margin: '4px 0 0', fontSize: '16px', fontWeight: 700, color: '#39465d' }}>{b.title}</h3>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => handleToggle(b.flag)}
                style={{
                  padding: '8px 20px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                  fontWeight: 600, fontSize: '13px',
                  background: flags[b.flag] ? '#ff4757' : '#2ed573',
                  color: '#fff',
                  transition: 'all 0.2s',
                  boxShadow: flags[b.flag] ? '0 4px 12px rgba(255,71,87,0.3)' : '0 4px 12px rgba(46,213,115,0.3)',
                }}
              >
                {flags[b.flag] ? '⏹ Disable' : '▶ Enable'}
              </button>
            </div>
          </div>

          {/* Card body */}
          <div style={{ padding: '20px 24px' }}>
            <p style={{ color: '#6b7a8d', fontSize: '13.5px', margin: '0 0 12px', lineHeight: 1.6 }}>{b.description}</p>
            <div style={{ display: 'inline-block', padding: '4px 10px', borderRadius: '6px', background: 'rgba(0,0,0,0.04)', fontSize: '11px', color: '#9aa5b5', fontFamily: 'monospace', marginBottom: '20px' }}>{b.cve}</div>

            {/* Phase 1 controls */}
            {b.phase === 1 && (
              <div>
                <div style={{ background: 'rgba(255,71,87,0.05)', border: '1px solid rgba(255,71,87,0.15)', borderRadius: '10px', padding: '16px 18px', marginBottom: '16px' }}>
                  <p style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 600, color: '#39465d' }}>How to test MFA Bypass:</p>
                  <ol style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: '#6b7a8d', lineHeight: 2 }}>
                    <li>Enable Bug above → <strong>MFA is now disabled for ALL users</strong></li>
                    <li>Open a new tab → go to the login page → sign in with any employee/customer credentials</li>
                    <li>You will land <strong>directly on the dashboard</strong> — no OTP screen appears</li>
                    <li>Use the Trigger panel below to inject a full attack trail into the Security panel</li>
                    <li>Go to <strong>Security</strong> tab → see BRUTE_FORCE, NO_MFA_CONFIGURED, ACCOUNT_TAKEOVER events</li>
                    <li>Disable Bug → try logging in again → OTP screen returns</li>
                  </ol>
                </div>
                {!flags['BUG_MFA'] && (
                  <div style={{ padding: '12px 16px', borderRadius: '8px', background: 'rgba(46,213,115,0.08)', border: '1px solid rgba(46,213,115,0.2)', fontSize: '13px', color: '#6b7a8d', marginBottom: '16px' }}>
                    ✓ Bug is disabled. Enable it above to activate the attack simulation.
                  </div>
                )}
                <div style={{ background: '#f8f9fb', borderRadius: '10px', padding: '18px 20px' }}>
                  <p style={{ margin: '0 0 14px', fontSize: '13.5px', fontWeight: 600, color: '#39465d' }}>🎯 Simulate Attack Trail</p>
                  <p style={{ margin: '0 0 14px', fontSize: '12.5px', color: '#9aa5b5' }}>Enter a target employee/customer email. This writes a realistic attack event chain to the Security panel: 4× failed logins, brute-force detection, ACCOUNT_TAKEOVER, and SUSPICIOUS_LOGIN events.</p>
                  <form onSubmit={handleMfaTrigger} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <input
                      className="text-input" style={{ flex: 1, minWidth: '200px' }}
                      placeholder="victim@northstarbank.com"
                      value={mfaTarget}
                      onChange={e => setMfaTarget(e.target.value)}
                      type="email"
                    />
                    <button type="submit" disabled={mfaLoading || !flags['BUG_MFA']} className="primary-button" style={{ padding: '10px 20px' }}>
                      {mfaLoading ? 'Simulating...' : '⚡ Trigger Attack'}
                    </button>
                  </form>
                  {mfaError && <div className="login-error" style={{ marginTop: '10px' }}>{mfaError}</div>}
                  {mfaResult && (
                    <div style={{ marginTop: '14px', background: 'rgba(255,71,87,0.05)', border: '1px solid rgba(255,71,87,0.2)', borderRadius: '8px', padding: '14px 16px' }}>
                      <p style={{ margin: '0 0 8px', fontWeight: 600, fontSize: '13px', color: '#ff4757' }}>⚠ Simulation Complete</p>
                      <p style={{ margin: '0 0 8px', fontSize: '12.5px', color: '#6b7a8d' }}>{mfaResult.message}</p>
                      <div style={{ fontSize: '12px', fontFamily: 'monospace', color: '#9aa5b5' }}>
                        {(mfaResult.events_generated || []).map((ev, i) => <div key={i} style={{ padding: '2px 0' }}>• {ev}</div>)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Phase 2 controls */}
            {b.phase === 2 && (
              <div>
                <div style={{ background: 'rgba(255,107,53,0.05)', border: '1px solid rgba(255,107,53,0.15)', borderRadius: '10px', padding: '16px 18px', marginBottom: '16px' }}>
                  <p style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 600, color: '#39465d' }}>How to test SQL Injection:</p>
                  <ol style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: '#6b7a8d', lineHeight: 2 }}>
                    <li>Enable Bug above</li>
                    <li>Type a <strong>normal email</strong> in the search box → gets that user only</li>
                    <li>Type <code style={{background:'rgba(0,0,0,0.06)',padding:'1px 6px',borderRadius:'4px'}}>&#x27; OR &#x27;1&#x27;=&#x27;1&#x27; --</code> → all users returned</li>
                    <li>Type <code style={{background:'rgba(0,0,0,0.06)',padding:'1px 6px',borderRadius:'4px'}}>&#x27; UNION SELECT id,email,password_hash,role,status,created_at,last_login,phone FROM users --</code> → password hashes exposed</li>
                    <li>Disable Bug → same payloads return empty results (parameterized)</li>
                  </ol>
                </div>
                {!flags['BUG_SQLI'] && (
                  <div style={{ padding: '12px 16px', borderRadius: '8px', background: 'rgba(46,213,115,0.08)', border: '1px solid rgba(46,213,115,0.2)', fontSize: '13px', color: '#6b7a8d', marginBottom: '16px' }}>
                    ✓ Bug is disabled. Parameterized queries are in use.
                  </div>
                )}
                <div style={{ background: '#f8f9fb', borderRadius: '10px', padding: '18px 20px' }}>
                  <p style={{ margin: '0 0 14px', fontSize: '13.5px', fontWeight: 600, color: '#39465d' }}>💉 SQL Injection Test Console</p>
                  <form onSubmit={handleSqliSearch} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
                    <input
                      className="text-input" style={{ flex: 1, fontFamily: 'monospace', minWidth: '250px' }}
                      placeholder="Enter email or SQL injection payload..."
                      value={sqliQuery}
                      onChange={e => setSqliQuery(e.target.value)}
                    />
                    <button type="submit" disabled={sqliLoading} className="primary-button" style={{ padding: '10px 20px', background: flags['BUG_SQLI'] ? '#ff6b35' : undefined }}>
                      {sqliLoading ? 'Executing...' : '▶ Execute Query'}
                    </button>
                  </form>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
                    {["' OR '1'='1' --", "' OR '1'='1", "admin@northstar.com"].map(p => (
                      <button key={p} onClick={() => setSqliQuery(p)} style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.1)', background: '#fff', fontSize: '11px', fontFamily: 'monospace', cursor: 'pointer', color: '#6b7a8d' }}>{p}</button>
                    ))}
                  </div>
                  {sqliError && <div className="login-error" style={{ marginTop: '10px' }}>{sqliError}</div>}
                  {sqliResult && (
                    <div style={{ marginTop: '14px' }}>
                      <div style={{
                        padding: '10px 14px', borderRadius: '8px',
                        background: sqliResult.mode === 'VULNERABLE' ? 'rgba(255,71,87,0.08)' : 'rgba(46,213,115,0.08)',
                        border: `1px solid ${sqliResult.mode === 'VULNERABLE' ? 'rgba(255,71,87,0.3)' : 'rgba(46,213,115,0.3)'}`,
                        marginBottom: '12px',
                      }}>
                        <div style={{ fontWeight: 700, fontSize: '13px', color: sqliResult.mode === 'VULNERABLE' ? '#ff4757' : '#2ed573', marginBottom: '4px' }}>
                          {sqliResult.mode === 'VULNERABLE' ? '⚠ VULNERABLE MODE' : '✓ SECURE MODE'} — {sqliResult.result_count} row(s) returned
                        </div>
                        <div style={{ fontFamily: 'monospace', fontSize: '11.5px', color: '#6b7a8d', wordBreak: 'break-all' }}>{sqliResult.query_used}</div>
                        {sqliResult.warning && <div style={{ marginTop: '6px', fontSize: '12px', color: '#ff6b35', fontWeight: 600 }}>{sqliResult.warning}</div>}
                      </div>
                      {sqliResult.results && sqliResult.results.length > 0 && (
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                            <thead>
                              <tr style={{ background: 'rgba(0,0,0,0.04)' }}>
                                {Object.keys(sqliResult.results[0]).map(k => (
                                  <th key={k} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#6b7a8d', borderBottom: '1px solid rgba(0,0,0,0.08)', whiteSpace: 'nowrap' }}>{k.toUpperCase()}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {sqliResult.results.map((row, ri) => (
                                <tr key={ri} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                                  {Object.values(row).map((val, vi) => (
                                    <td key={vi} style={{ padding: '8px 12px', color: '#39465d', fontFamily: 'monospace', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {String(val ?? '')}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Phase 3 controls */}
            {b.phase === 3 && (
              <div>
                <div style={{ background: 'rgba(255,107,53,0.05)', border: '1px solid rgba(255,107,53,0.15)', borderRadius: '10px', padding: '16px 18px', marginBottom: '16px' }}>
                  <p style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 600, color: '#39465d' }}>How to test IDOR:</p>
                  <ol style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: '#6b7a8d', lineHeight: 2 }}>
                    <li>Enable Bug above</li>
                    <li>Click <strong>"List All Accounts"</strong> to enumerate all accounts in the system</li>
                    <li>Copy any account ID that belongs to a different customer</li>
                    <li>Paste it in the <strong>"Fetch Account by ID"</strong> field and click Fetch</li>
                    <li>See another customer's full account details + transactions returned without authorization</li>
                    <li>Disable Bug → same request returns <strong>403 Forbidden</strong></li>
                  </ol>
                </div>
                {!flags['BUG_IDOR'] && (
                  <div style={{ padding: '12px 16px', borderRadius: '8px', background: 'rgba(46,213,115,0.08)', border: '1px solid rgba(46,213,115,0.2)', fontSize: '13px', color: '#6b7a8d', marginBottom: '16px' }}>
                    ✓ Bug is disabled. Ownership checks enforced.
                  </div>
                )}
                <div style={{ background: '#f8f9fb', borderRadius: '10px', padding: '18px 20px', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <p style={{ margin: 0, fontSize: '13.5px', fontWeight: 600, color: '#39465d' }}>🔢 Step 1 — Enumerate All Accounts</p>
                    <button onClick={handleIdorList} disabled={idorListLoading || !flags['BUG_IDOR']} className="secondary-button" style={{ padding: '8px 16px' }}>
                      {idorListLoading ? 'Loading...' : '📋 List All Accounts'}
                    </button>
                  </div>
                  {idorAccounts && (
                    <div style={{ overflowX: 'auto' }}>
                      <div style={{ marginBottom: '8px', fontSize: '12px', color: '#ff4757', fontWeight: 600 }}>⚠ {idorAccounts.total_accounts} accounts exposed — click an ID to use it as target</div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                        <thead><tr style={{ background: 'rgba(0,0,0,0.04)' }}>
                          <th style={{ padding: '8px 12px', textAlign:'left', color:'#6b7a8d', borderBottom:'1px solid rgba(0,0,0,0.08)' }}>ACCOUNT ID</th>
                          <th style={{ padding: '8px 12px', textAlign:'left', color:'#6b7a8d', borderBottom:'1px solid rgba(0,0,0,0.08)' }}>ACCOUNT NUMBER</th>
                          <th style={{ padding: '8px 12px', textAlign:'left', color:'#6b7a8d', borderBottom:'1px solid rgba(0,0,0,0.08)' }}>OWNER NAME</th>
                          <th style={{ padding: '8px 12px', textAlign:'left', color:'#6b7a8d', borderBottom:'1px solid rgba(0,0,0,0.08)' }}>OWNER EMAIL</th>
                          <th style={{ padding: '8px 12px', textAlign:'left', color:'#6b7a8d', borderBottom:'1px solid rgba(0,0,0,0.08)' }}>TYPE</th>
                        </tr></thead>
                        <tbody>
                          {(idorAccounts.accounts || []).map((a, i) => (
                            <tr key={a.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)', cursor: 'pointer', background: i%2===0 ? 'transparent' : 'rgba(0,0,0,0.02)' }}
                              onClick={() => setIdorAccountId(String(a.id))}>
                              <td style={{ padding: '8px 12px', fontFamily:'monospace', color:'#4f7dff', fontWeight:600 }}>{a.id}</td>
                              <td style={{ padding: '8px 12px', fontFamily:'monospace', color:'#39465d' }}>{a.account_number}</td>
                              <td style={{ padding: '8px 12px', color:'#39465d' }}>{a.users?.name || '—'}</td>
                              <td style={{ padding: '8px 12px', color:'#9aa5b5' }}>{a.users?.email || '—'}</td>
                              <td style={{ padding: '8px 12px', color:'#9aa5b5' }}>{a.account_type}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                <div style={{ background: '#f8f9fb', borderRadius: '10px', padding: '18px 20px' }}>
                  <p style={{ margin: '0 0 14px', fontSize: '13.5px', fontWeight: 600, color: '#39465d' }}>🔓 Step 2 — Fetch Account by ID (IDOR)</p>
                  <form onSubmit={handleIdorFetch} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <input
                      className="text-input" style={{ flex: 1, fontFamily: 'monospace', minWidth: '150px' }}
                      placeholder="Enter any account ID (e.g. 42)"
                      value={idorAccountId}
                      onChange={e => setIdorAccountId(e.target.value)}
                      type="number"
                    />
                    <button type="submit" disabled={idorLoading} className="primary-button" style={{ padding: '10px 20px', background: flags['BUG_IDOR'] ? '#ff6b35' : undefined }}>
                      {idorLoading ? 'Fetching...' : '🔓 Fetch Account'}
                    </button>
                  </form>
                  {idorError && <div className="login-error" style={{ marginTop: '10px' }}>{idorError}</div>}
                  {idorResult && (
                    <div style={{ marginTop: '14px' }}>
                      <div style={{
                        padding: '10px 14px', borderRadius: '8px', marginBottom: '12px',
                        background: idorResult.mode === 'VULNERABLE' ? 'rgba(255,71,87,0.08)' : 'rgba(46,213,115,0.08)',
                        border: `1px solid ${idorResult.mode === 'VULNERABLE' ? 'rgba(255,71,87,0.3)' : 'rgba(46,213,115,0.3)'}`,
                      }}>
                        <div style={{ fontWeight: 700, fontSize: '13px', color: idorResult.mode === 'VULNERABLE' ? '#ff4757' : '#2ed573', marginBottom: '4px' }}>
                          {idorResult.mode === 'VULNERABLE' ? '⚠ IDOR EXPLOITED' : '✓ SECURE — Access Denied'}
                        </div>
                        {idorResult.warning && <div style={{ fontSize: '12px', color: '#ff6b35' }}>{idorResult.warning}</div>}
                        {idorResult.note && <div style={{ fontSize: '12px', color: '#2ed573' }}>{idorResult.note}</div>}
                      </div>
                      {idorResult.account_owner && (
                        <div style={{ marginBottom: '12px', padding: '12px 16px', borderRadius: '8px', background: 'rgba(255,71,87,0.05)', border: '1px solid rgba(255,71,87,0.15)' }}>
                          <div style={{ fontWeight: 600, fontSize: '12px', color: '#ff4757', marginBottom: '8px' }}>🎯 VICTIM PROFILE EXPOSED:</div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '8px' }}>
                            {Object.entries(idorResult.account_owner).map(([k, v]) => (
                              <div key={k}><div style={{ fontSize: '10px', color: '#9aa5b5', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{k}</div>
                                <div style={{ fontSize: '12.5px', fontFamily: 'monospace', color: '#39465d' }}>{String(v ?? '—')}</div></div>
                            ))}
                          </div>
                        </div>
                      )}
                      {idorResult.account && (
                        <div style={{ marginBottom: '12px', padding: '12px 16px', borderRadius: '8px', background: 'rgba(255,71,87,0.05)', border: '1px solid rgba(255,71,87,0.15)' }}>
                          <div style={{ fontWeight: 600, fontSize: '12px', color: '#ff4757', marginBottom: '8px' }}>💳 VICTIM ACCOUNT EXPOSED:</div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '8px' }}>
                            {Object.entries(idorResult.account).filter(([k]) => k !== '_bug').map(([k, v]) => (
                              <div key={k}><div style={{ fontSize: '10px', color: '#9aa5b5', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{k}</div>
                                <div style={{ fontSize: '12.5px', fontFamily: 'monospace', color: '#39465d' }}>{String(v ?? '—')}</div></div>
                            ))}
                          </div>
                        </div>
                      )}
                      {idorResult.recent_transactions && idorResult.recent_transactions.length > 0 && (
                        <div style={{ padding: '12px 16px', borderRadius: '8px', background: 'rgba(255,71,87,0.05)', border: '1px solid rgba(255,71,87,0.15)' }}>
                          <div style={{ fontWeight: 600, fontSize: '12px', color: '#ff4757', marginBottom: '8px' }}>📜 VICTIM TRANSACTIONS ({idorResult.recent_transactions.length} most recent):</div>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px' }}>
                            <thead><tr style={{ background: 'rgba(0,0,0,0.04)' }}>
                              {['ID', 'TYPE', 'AMOUNT', 'DESCRIPTION', 'STATUS', 'DATE'].map(h => (
                                <th key={h} style={{ padding: '6px 10px', textAlign:'left', color:'#9aa5b5', borderBottom:'1px solid rgba(0,0,0,0.08)', whiteSpace:'nowrap' }}>{h}</th>
                              ))}
                            </tr></thead>
                            <tbody>
                              {idorResult.recent_transactions.map(tx => (
                                <tr key={tx.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                                  <td style={{ padding:'6px 10px', fontFamily:'monospace', color:'#9aa5b5' }}>{tx.id}</td>
                                  <td style={{ padding:'6px 10px', color:'#39465d' }}>{tx.transaction_type}</td>
                                  <td style={{ padding:'6px 10px', fontWeight:600, color:'#39465d' }}>{formatINR(Math.abs(tx.amount))}</td>
                                  <td style={{ padding:'6px 10px', color:'#6b7a8d', maxWidth:'150px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{tx.description || '—'}</td>
                                  <td style={{ padding:'6px 10px' }}><span className={`status ${(tx.status||'').toLowerCase()}`}>{tx.status}</span></td>
                                  <td style={{ padding:'6px 10px', color:'#9aa5b5', whiteSpace:'nowrap' }}>{new Date(tx.created_at).toLocaleDateString()}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      ))}

      {/* Footer note */}
      <div style={{ marginTop: '20px', padding: '16px 20px', borderRadius: '12px', background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.06)', fontSize: '12.5px', color: '#9aa5b5', lineHeight: 1.6 }}>
        <strong style={{ color: '#39465d' }}>Note:</strong> All vulnerability flags are stored in server memory and reset to OFF on every server restart. This ensures the platform is always secure by default. All events triggered in this lab are recorded to the Supabase database and visible in the Security panel for risk scoring.
      </div>
    </div>
  )
}
