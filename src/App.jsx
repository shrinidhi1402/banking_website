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

// ─── Role-specific static config (unchanged from original) ───────────────────
const roleConfig = {
  Customer: {
    nav: ['Overview', 'Transfer money', 'Beneficiaries', 'Transactions', 'Profile', 'Security'],
    metrics: [['Available balance', '$24,860.42', '+$2,840 this month'], ['Total savings', '$41,280.00', '8.2% APY'], ['Credit score', '782', 'Excellent standing']],
  },
  Employee: {
    nav: ['Overview', 'Customers', 'Transactions', 'Requests', 'Profile', 'Security'],
    metrics: [['Customers handled', '284', '+18 this month'], ['Pending requests', '12', '4 need attention'], ['Service rating', '4.9 / 5', '+0.2 this quarter']],
  },
  Manager: {
    nav: ['Overview', 'Customers', 'Employees', 'Transactions', 'Requests', 'Security', 'Reports'],
    metrics: [['Total customers', '12,842', '+6.8% this year'], ['Total deposits', '$84.6M', '+12.4% this year'], ['Transactions', '48,291', 'Last 30 days'], ['Suspicious activity', '7', '2 high priority']],
  },
}

// Capitalise first letter so DB role (CUSTOMER) maps to roleConfig key (Customer)
function toRoleKey(dbRole) {
  if (!dbRole) return null
  return dbRole.charAt(0).toUpperCase() + dbRole.slice(1).toLowerCase()
}

const transactions = [['Whole Foods Market', 'Groceries - Today, 10:42 AM', '-$86.24', 'debit'], ['Acme Studio LLC', 'Incoming transfer - Yesterday', '+$3,200.00', 'credit'], ['Netflix.com', 'Subscription - Aug 21', '-$15.49', 'debit'], ['Cedar & Stone', 'Dining - Aug 20', '-$64.80', 'debit'], ['Direct deposit', 'Payroll - Aug 18', '+$4,850.00', 'credit']]
const customers  = [['Olivia Bennett', '•• 4821', '$18,420.65', 'Active'], ['Noah Williams', '•• 1093', '$42,106.20', 'Active'], ['Ethan Caldwell', '•• 7738', '$8,930.10', 'Review'], ['Sophia Davis', '•• 6204', '$65,240.00', 'Active']]

function Icon({ children }) { return <span className="icon" aria-hidden="true">{children}</span> }

// ─── App root ─────────────────────────────────────────────────────────────────
export default function App() {
  const [session, setSession]   = useState(null)   // { access_token, user }
  const [active, setActive]     = useState('Overview')
  const [notice, setNotice]     = useState('')
  // Demo role-override: lets a logged-in user view other role dashboards for demo purposes.
  // The server NEVER trusts this; all API calls use the real access_token.
  const [demoRole, setDemoRole] = useState(null)

  const [customerData, setCustomerData] = useState({ account: null, transactions: [], beneficiaries: [], profile: null, loading: true })
  const [employeeData, setEmployeeData] = useState({ dashboard: [], customers: [], transactions: [], requests: [], profile: null, loading: true })

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

  useEffect(() => {
    if (session?.user?.role === 'CUSTOMER') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      refreshCustomerData()
    } else if (session?.user?.role === 'EMPLOYEE') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      refreshEmployeeData()
    }
  }, [session, refreshCustomerData, refreshEmployeeData])

  const handleLogin = useCallback((sessionData) => {
    setSession(sessionData)
    setActive('Overview')
    setDemoRole(null)
  }, [])

  const handleLogout = useCallback(async () => {
    try {
      if (session?.access_token) {
        await apiPost('/auth/logout', {}, session.access_token)
      }
    } catch { /* ignore logout errors */ }
    setSession(null)
    setActive('Overview')
    setDemoRole(null)
  }, [session])

  if (!session) return <LoginPage onLogin={handleLogin} />

  const dbRole     = session.user?.role                        // CUSTOMER / EMPLOYEE / MANAGER
  const roleKey    = demoRole ?? toRoleKey(dbRole)             // Customer / Employee / Manager
  const current    = roleConfig[roleKey] ?? roleConfig.Customer
  const userName   = session.user?.name ?? 'You'
  const initials   = userName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()

  function action(message) { setNotice(message); window.setTimeout(() => setNotice(''), 2800) }
  function chooseDemo(key) { setDemoRole(key); setActive('Overview'); setNotice('') }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">N</span><span>northstar<span className="brand-dot">.</span></span></div>
        <div className="workspace-label">Workspace</div>

        {/* Demo role-switcher: only shows roles the authenticated user's role can see.
            The switcher is purely cosmetic – the backend always uses the real token role. */}
        <div className="role-switcher">
          {Object.keys(roleConfig).map((key) => (
            <button
              key={key}
              className={roleKey === key ? 'role active' : 'role'}
              onClick={() => chooseDemo(key)}
              title={key === toRoleKey(dbRole) ? 'Your role' : 'Demo view only'}
            >
              {key}
              <span>{roleKey === key ? '●' : ''}</span>
            </button>
          ))}
        </div>

        <nav className="nav-list">
          <div className="workspace-label">Navigate</div>
          {current.nav.map((item, index) => (
            <button key={item} className={active === item ? 'nav-item selected' : 'nav-item'} onClick={() => setActive(item)}>
              <Icon>{['⌂', '↗', '◇', '≡', '♙', '◈', '▦'][index]}</Icon>
              {item}
              {item === 'Requests' && <span className="nav-count">12</span>}
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
            ? <Dashboard roleKey={roleKey} current={current} action={action} customerData={customerData} employeeData={employeeData} />
            : <WorkspacePage active={active} action={action} customerData={customerData} employeeData={employeeData} session={session} refresh={refreshCustomerData} refreshEmployee={refreshEmployeeData} />}
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
            {loading ? 'Signing in…' : 'Sign in →'}
          </button>
        </form>

        <p className="login-footer">Protected by Northstar Secure&trade;</p>
      </div>
    </div>
  )
}

// ─── Dashboard ─────────────────────────────────────────────────────────────────
function Dashboard({ roleKey, current, action, customerData, employeeData }) {
  let displayMetrics = current.metrics
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
            <h2>{roleKey === 'Customer' ? 'Upcoming payments' : roleKey === 'Employee' ? 'Customer requests' : 'Priority watchlist'}</h2>
            <p>{roleKey === 'Customer' ? 'Scheduled in the next 7 days' : 'Items that need your attention'}</p>
          </div>
          <button className="text-button" onClick={() => action('Opening the full list')}>View all</button>
        </div>
        <div className="table-scroll">
          <table>
            <thead><tr><th>{roleKey === 'Customer' ? 'PAYEE' : 'CUSTOMER'}</th><th>DATE</th><th>AMOUNT</th><th>STATUS</th><th /></tr></thead>
            <tbody>
              {(roleKey === 'Customer'
                ? [['Adobe Creative Cloud', 'Aug 28', '$59.99', 'Scheduled'], ['Rent payment', 'Sep 01', '$1,850.00', 'Scheduled'], ['Electric company', 'Sep 03', '$124.70', 'Scheduled']]
                : customers.slice(0, 3).map((c, index) => [c[0], index === 0 ? 'Account review' : 'Transfer request', index === 0 ? '$3,200.00' : '$850.00', c[3]])
              ).map((row) => (
                <tr key={row[0]}>
                  {row.map((cell, index) => (
                    <td key={cell} className={index === 3 ? 'status-cell' : index === 2 ? 'amount-cell' : ''}>
                      {index === 3 ? <span className={`status ${cell.toLowerCase()}`}>{cell}</span> : cell}
                    </td>
                  ))}
                  <td><button className="more-button" onClick={() => action(`Opening ${row[0]}`)}>•••</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}

// ─── Workspace page (unchanged from original) ─────────────────────────────────
function WorkspacePage({ active, action, customerData, employeeData, session, refresh, refreshEmployee }) {
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

  if (active === 'Transfer money') Content = <TransferForm action={action} customerData={customerData} session={session} refresh={refresh} />
  else if (active === 'Customers' || active === 'Employees') Content = <Directory active={active} action={action} employeeData={employeeData} session={session} refreshEmployee={refreshEmployee} />
  else if (active === 'Transactions' && isCust) Content = <TransactionsPanel action={action} customerData={customerData} />
  else if (active === 'Transactions' && isEmp) Content = <GenericPanel active={active} action={action} employeeData={employeeData} />
  else if (active === 'Requests' && isEmp) Content = <GenericPanel active={active} action={action} employeeData={employeeData} session={session} refreshEmployee={refreshEmployee} />
  else if (active === 'Beneficiaries' && isCust) Content = <BeneficiariesPanel action={action} customerData={customerData} session={session} refresh={refresh} />
  else if (active === 'Profile' && isCust) Content = <ProfileForm action={action} customerData={customerData} session={session} refresh={refresh} />
  else if (active === 'Profile' && isEmp) Content = <ProfileForm action={action} employeeData={employeeData} session={session} refresh={refreshEmployee} />
  else if (active === 'Security') Content = <PasswordForm action={action} session={session} />
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

  // Use optional chaining carefully to avoid errors if customerData is still loading
  const account = customerData?.account
  const beneficiaries = customerData?.beneficiaries || []
  const bal = account ? '$' + Number(account.balance).toLocaleString(undefined, { minimumFractionDigits: 2 }) : ''
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
      <div className="form-field"><label>From account</label><div className="fake-input"><span className="account-chip">••</span><span>Everyday account <small>{accNum} · {bal}</small></span><b>⌄</b></div></div>
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
        <div className="form-field"><label>Amount</label><div className="amount-input"><span>$</span><input type="number" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} /></div></div>
        <div className="form-field"><label>When</label><div className="fake-input compact">Today <b>⌄</b></div></div>
      </div>
      <div className="form-field"><label>Reference <small>(optional)</small></label><input className="text-input" placeholder="What is this for?" value={reference} onChange={e => setReference(e.target.value)} /></div>
      {error && <div className="login-error">{error}</div>}
      <div className="form-footer"><span>Transfers are protected by Northstar Secure.</span><button className="primary-button" onClick={handleSubmit} disabled={loading}>{loading ? 'Processing...' : <>Continue <span>→</span></>}</button></div>
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
            <button className="text-button" onClick={() => action(`Opening ${tx.id}`)}>View →</button>
          </div>
        )
      })}
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
                  <td className="status-cell"><span className={`status active`}>Active</span></td>
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

  // Customer fields
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  
  // Employee fields
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
        // eslint-disable-next-line react-hooks/set-state-in-effect
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

function Directory({ active, action, employeeData, session, refreshEmployee }) {
  const [showAdd, setShowAdd] = useState(false)
  let rows = customers
  if (active === 'Employees') {
    rows = [['Jordan Lee', 'Client success', '284 customers', 'Active'], ['Priya Shah', 'Risk & compliance', '—', 'Active'], ['Marcus Green', 'Relationship manager', '192 customers', 'Away'], ['Lena Ortiz', 'Client success', '241 customers', 'Active']]
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
      {showAdd && active === 'Customers' && (
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
          <button className="primary-button" onClick={() => {
            if (active === 'Customers') setShowAdd(!showAdd)
            else action(`New employee form opened`)
          }}>+ Add {active === 'Employees' ? 'employee' : 'customer'}</button>
        </div>
        <div className="table-scroll">
          <table>
            <thead><tr><th>NAME</th><th>{active === 'Employees' ? 'ROLE' : 'CUSTOMER ID'}</th><th>{active === 'Employees' ? 'PORTFOLIO' : 'PLAN'}</th><th>STATUS</th><th /></tr></thead>
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
        req.id // Keep ID for actions
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
