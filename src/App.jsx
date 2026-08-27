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

const transactions = [['Whole Foods Market', 'Groceries - Today, 10:42 AM', '-$86.24', 'debit'], ['Acme Studio LLC', 'Incoming transfer - Yesterday', '+$3,200.00', 'credit'], ['Netflix.com', 'Subscription - Aug 21', '-$15.49', 'debit'], ['Cedar & Stone', 'Dining - Aug 20', '-$64.80', 'debit'], ['Direct deposit', 'Payroll - Aug 18', '+$4,850.00', 'credit']]
const customers  = [['Olivia Bennett', '4821', '$18,420.65', 'Active'], ['Noah Williams', '1093', '$42,106.20', 'Active'], ['Ethan Caldwell', '7738', '$8,930.10', 'Review'], ['Sophia Davis', '6204', '$65,240.00', 'Active']]

function Icon({ children }) { return <span className="icon" aria-hidden="true">{children}</span> }

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

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await apiPost('/auth/login', { email, password })
      onLogin({ access_token: data.access_token, user: data.user })
    } catch (err) {
      setError(err.message ?? 'Login failed')
    } finally {
      setLoading(false)
    }
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
    const bal = '$' + Number(acc.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })
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
        (isDebit ? '-' : '+') + '$' + Math.abs(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2 }),
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
        '$' + Math.abs(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2 }),
        'credit'
      ]
    })
  } else if (roleKey === 'Manager') {
    if (managerData && !managerData.loading && managerData.reports) {
      const t = managerData.reports.totals
      displayMetrics = [
        ['Total customers',     t.customers.toLocaleString(),                                    'All registered customers'],
        ['Total deposits',      '$' + Number(t.deposits).toLocaleString(undefined, { maximumFractionDigits: 0 }), 'Across all accounts'],
        ['Transactions',        t.transactions.toLocaleString(),                                 'All time'],
        ['Suspicious activity', t.suspiciousTransactions.toString(),                             t.suspiciousTransactions > 0 ? `${t.suspiciousTransactions} need review` : 'None flagged'],
      ]
    } else {
      displayMetrics = [
        ['Total customers',     '\u2014', 'Loading\u2026'],
        ['Total deposits',      '\u2014', 'Loading\u2026'],
        ['Transactions',        '\u2014', 'Loading\u2026'],
        ['Suspicious activity', '\u2014', 'Loading\u2026'],
      ]
    }
    displayTransactions = (managerData?.transactions || []).slice(0, 5).map(tx => {
      const senderName   = tx.sender?.users?.name   || 'Unknown'
      const receiverName = tx.receiver?.users?.name || 'Unknown'
      return [
        tx.description || tx.transaction_type,
        `${senderName} \u2192 ${receiverName} \u00b7 ${new Date(tx.created_at).toLocaleDateString()}`,
        '$' + Math.abs(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2 }),
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
            <div className="y-labels"><span>$6k</span><span>$4k</span><span>$2k</span><span>$0</span></div>
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
                ? [['Adobe Creative Cloud', 'Aug 28', '$59.99', 'Scheduled'], ['Rent payment', 'Sep 01', '$1,850.00', 'Scheduled'], ['Electric company', 'Sep 03', '$124.70', 'Scheduled']]
                : roleKey === 'Manager'
                  ? (managerData?.requests || []).filter(r => r.status === 'PENDING').slice(0, 3).map(r => [r.users?.name || 'Customer', new Date(r.created_at).toLocaleDateString(), r.request_type || '—', r.status])
                  : customers.slice(0, 3).map((c, index) => [c[0], index === 0 ? 'Account review' : 'Transfer request', index === 0 ? '$3,200.00' : '$850.00', c[3]])
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
  else if (active === 'Security'   && isMgr)             Content = <ManagerSecurityPanel action={action} managerData={managerData} />
  else if (active === 'Security')                        Content = <PasswordForm action={action} session={session} />
  else if (active === 'Reports'    && isMgr)             Content = <ManagerReportsPanel action={action} managerData={managerData} />
  else Content = <GenericPanel active={active} action={action} employeeData={employeeData} />

  return (
    <section className="workspace-page">
      <div className="page-intro">
        <div className="large-symbol">{active === 'Transfer money' ? '↗' : active === 'Security' ? '◈' : active === 'Reports' ? '▥' : '✦'}</div>
        <div><h2>{title}</h2><p>{description}</p></div>
      </div>
      {Content}
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
  const bal = account ? '$' + Number(account.balance).toLocaleString(undefined, { minimumFractionDigits: 2 }) : ''
  const accNum = account ? '\u2022\u2022 ' + account.account_number.slice(-4) : '\u2022\u2022'

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
      <div className="form-field"><label>From account</label><div className="fake-input"><span className="account-chip">\u2022\u2022</span><span>Everyday account <small>{accNum} \u00b7 {bal}</small></span><b>\u2304</b></div></div>
      <div className="form-field">
        <label>To beneficiary</label>
        <select className="text-input" value={toBeneficiaryId} onChange={(e) => setToBeneficiaryId(e.target.value)}>
          <option value="">Select a beneficiary</option>
          {beneficiaries.map(b => (
            <option key={b.id} value={b.id}>{b.beneficiary_name} (\u2022\u2022 {b.account_number.slice(-4)})</option>
          ))}
        </select>
      </div>
      <div className="form-row">
        <div className="form-field"><label>Amount</label><div className="amount-input"><span>$</span><input type="number" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} /></div></div>
        <div className="form-field"><label>When</label><div className="fake-input compact">Today <b>\u2304</b></div></div>
      </div>
      <div className="form-field"><label>Reference <small>(optional)</small></label><input className="text-input" placeholder="What is this for?" value={reference} onChange={e => setReference(e.target.value)} /></div>
      {error && <div className="login-error">{error}</div>}
      <div className="form-footer"><span>Transfers are protected by Northstar Secure.</span><button className="primary-button" onClick={handleSubmit} disabled={loading}>{loading ? 'Processing...' : 'Continue \u2192'}</button></div>
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
            <strong>{(isDebit ? '-' : '+') + '$' + Math.abs(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
            <button className="text-button" onClick={() => action(`Opening ${tx.id}`)}>View \u2192</button>
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
              <small>{senderName} \u2192 {receiverName} \u00b7 {new Date(tx.created_at).toLocaleDateString()}</small>
            </div>
            <strong>${Math.abs(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
            <span className={`status ${(tx.status || 'completed').toLowerCase()}`}>{tx.status || 'COMPLETED'}</span>
            {(tx.amount >= 10000) && <span className="status review" style={{marginLeft:'6px'}}>\u26a0 Suspicious</span>}
            <button className="text-button" onClick={() => action(`Transaction ${tx.id}`)}>View \u2192</button>
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
            <span className={`transaction-icon ${req.status === 'PENDING' ? 'warning' : 'credit'}`}>\u2713</span>
            <div>
              <b>{req.request_type}</b>
              <small>{custName} \u00b7 {new Date(req.created_at).toLocaleDateString()}{req.description ? ` \u00b7 ${req.description}` : ''}</small>
            </div>
            <strong>{req.description || '\u2014'}</strong>
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
function ManagerSecurityPanel({ action, managerData }) {
  const events = managerData?.securityEvents || []
  return (
    <div className="panel generic-panel">
      <div className="directory-toolbar">
        <div className="search"><span>⌕</span><input placeholder="Search security events..." /></div>
        <button className="select-button">All severities ⌄</button>
      </div>
      {events.length === 0 ? (
        <div style={{padding:'20px', textAlign:'center', color:'#9aa5b5'}}>No security events found.</div>
      ) : events.map(ev => (
        <div className="generic-row" key={ev.id}>
          <span className={`transaction-icon ${ev.severity === 'HIGH' ? 'debit' : ev.severity === 'MEDIUM' ? 'warning' : 'credit'}`}>
            {ev.severity === 'HIGH' ? '!' : ev.severity === 'MEDIUM' ? '\u26a0' : '\u2713'}
          </span>
          <div>
            <b>{ev.event_type}</b>
            <small>{ev.description} \u00b7 {new Date(ev.created_at).toLocaleDateString()}{ev.ip_address ? ` \u00b7 IP: ${ev.ip_address}` : ''}</small>
          </div>
          <span className={`status ${ev.severity === 'HIGH' ? 'review' : ev.severity === 'MEDIUM' ? 'scheduled' : 'active'}`}>{ev.severity}</span>
          <button className="text-button" onClick={() => action(`Event ${ev.id}`)}>View \u2192</button>
        </div>
      ))}
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
  const fmtCur = (n) => '$' + Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

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
                    <td className="amount-cell">${Math.abs(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td>{new Date(tx.created_at).toLocaleDateString()}</td>
                    <td className="status-cell"><span className="status review">\u26a0 Suspicious</span></td>
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
                  <td>\u2022\u2022 {b.account_number.slice(-4)}</td>
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
  let rows = customers

  if (active === 'Employees') {
    // Real employee data (passed as employeeData for manager)
    if (employeeData?.employees && employeeData.employees.length > 0) {
      rows = employeeData.employees.map(e => [
        e.users?.name || `Employee ${e.user_id}`,
        e.department || 'Staff',
        e.branch || '\u2014',
        e.users?.status || 'ACTIVE'
      ])
    } else {
      rows = []
    }
  } else if (active === 'Customers' && employeeData?.customers) {
    rows = employeeData.customers.map(c => [
      c.users?.name || 'Unknown',
      c.customer_id,
      'Northstar Secure',
      c.users?.status || 'Active'
    ])
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
          <div className="search"><span>⌕</span><input placeholder={`Search ${active.toLowerCase()}...`} /></div>
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
              {rows.map((row, rIdx) => (
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
              {rows.length === 0 && <tr><td colSpan="5" style={{textAlign:'center', padding:'20px', color:'#9aa5b5'}}>No {active.toLowerCase()} found.</td></tr>}
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
        `${senderName} \u2192 ${receiverName} - ${new Date(tx.created_at).toLocaleDateString()}`,
        '$' + Math.abs(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2 }),
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
          <span className={`transaction-icon ${item[3] === 'PENDING' ? 'warning' : 'credit'}`}>{active === 'Transactions' ? item[0][0] : '\u2713'}</span>
          <div><b>{item[0]}</b><small>{item[1]}</small></div>
          <strong>{item[2]}</strong>

          {active === 'Requests' && item[3] === 'PENDING' && item[4] ? (
            <div style={{display:'flex', gap:'10px'}}>
              <button className="text-button" disabled={handling === item[4]} style={{color:'var(--coral)'}} onClick={() => handleDecision(item[4], 'REJECTED')}>Reject</button>
              <button className="primary-button" disabled={handling === item[4]} style={{padding: '6px 12px', fontSize: '13px'}} onClick={() => handleDecision(item[4], 'APPROVED')}>{handling === item[4] ? '...' : 'Approve'}</button>
            </div>
          ) : (
            <button className="text-button" onClick={() => action(`Opening ${item[0]}`)}>
              {active === 'Requests' ? <span className={`status ${item[3]?.toLowerCase()}`}>{item[3]}</span> : 'View \u2192'}
            </button>
          )}
        </div>
      ))}
      {items.length === 0 && <div style={{padding:'20px', textAlign:'center', color:'#9aa5b5'}}>No {active.toLowerCase()} found.</div>}
    </div>
  )
}
