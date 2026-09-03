import { useState, useEffect, useRef, useCallback } from 'react'

// ─── CRQ platform endpoints ──────────────────────────────────────────────────
// The CRQ (CyberRisk Quantifier) FastAPI service runs independently of the bank
// backend. Override with VITE_CRQ_API in .env when it is not on localhost:8000.
const CRQ_API = (import.meta.env.VITE_CRQ_API || 'http://localhost:8000/api/v1').replace(/\/+$/, '')
const CRQ_WS = CRQ_API.replace(/^http/, 'ws').replace(/\/api\/v1$/, '') + '/ws/updates'
const ORG_ID = Number(import.meta.env.VITE_CRQ_ORG_ID || 1)

const fmtINR = (val) => {
  if (val === undefined || val === null || Number.isNaN(Number(val))) return '—'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
  }).format(Number(val))
}

const fmtWhen = (iso) => {
  if (!iso) return '—'
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return '—'
  const secs = Math.round((Date.now() - then) / 1000)
  if (secs < 60) return `${secs}s ago`
  if (secs < 3600) return `${Math.round(secs / 60)}m ago`
  if (secs < 86400) return `${Math.round(secs / 3600)}h ago`
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

async function crqGet(path) {
  const res = await fetch(`${CRQ_API}${path}`)
  if (!res.ok) {
    const err = new Error(`CRQ ${res.status}`)
    err.status = res.status
    throw err
  }
  return res.json()
}

// ─── Distribution bar (p10 / p50 / p90 from the real loss_distribution) ───────
function LossDistribution({ dist }) {
  if (!dist || dist.p90 === undefined) return null
  const { p10 = 0, p50 = 0, p90 = 0 } = dist
  const span = p90 - p10 || 1
  const pos = (v) => `${Math.min(100, Math.max(0, ((v - p10) / span) * 100))}%`
  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
        Modelled loss distribution
      </div>
      <div style={{ position: 'relative', height: 8, background: '#eef2f8', borderRadius: 4, margin: '10px 0 6px' }}>
        <div style={{ position: 'absolute', left: pos(p10), right: `calc(100% - ${pos(p90)})`, top: 0, bottom: 0, background: '#dfe8fb', borderRadius: 4 }} />
        <div style={{ position: 'absolute', left: pos(p50), width: 2, top: -3, bottom: -3, background: 'var(--blue)' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#5d6a82' }}>
        <span>P10 {fmtINR(p10)}</span>
        <span>P50 {fmtINR(p50)}</span>
        <span>P90 {fmtINR(p90)}</span>
      </div>
    </div>
  )
}

// ─── Sparkline for EAL history (real snapshot points) ─────────────────────────
function Sparkline({ points }) {
  if (!points || points.length < 2) return null
  const vals = points.map((p) => p.eal)
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const span = max - min || 1
  const w = 260
  const h = 44
  const d = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w
      const y = h - ((p.eal - min) / span) * h
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  return (
    <svg width={w} height={h} style={{ display: 'block', marginTop: 8 }}>
      <path d={d} fill="none" stroke="var(--blue)" strokeWidth="2" />
    </svg>
  )
}

// ─── Manual vulnerability finding form (ported from the CRQ analyst UI) ────────
function ReportFindingForm({ onSubmitted, action }) {
  const [form, setForm] = useState({
    asset_id: '', title: '', cve_id: '', cvss_score: '',
    source: 'manual_assessment', description: '', remediation: '',
  })
  const [eventId, setEventId] = useState(() => crypto.randomUUID())
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState(null) // { type, msg }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const validate = () => {
    if (!form.asset_id.trim()) return 'Affected asset / system is required.'
    if (form.title.trim().length < 5) return 'Finding title must be at least 5 characters.'
    if (form.description.trim().length < 10) return 'Please provide a fuller technical description (10+ characters).'
    if (form.remediation.trim().length < 10) return 'Please provide remediation guidance (10+ characters).'
    if (form.cvss_score !== '') {
      const s = Number(form.cvss_score)
      if (Number.isNaN(s) || s < 1 || s > 10) return 'CVSS base score must be between 1.0 and 10.0.'
    }
    return null
  }

  const submit = async (e) => {
    e.preventDefault()
    const problem = validate()
    if (problem) {
      setStatus({ type: 'error', msg: problem })
      return
    }
    setBusy(true)
    setStatus(null)

    const envelope = {
      event_id: eventId,
      event_type: 'vuln.detected',
      org_id: ORG_ID,
      source: `analyst-${form.source}`,
      payload: {
        asset_id: form.asset_id.trim(),
        title: form.title.trim(),
        cve_id: form.cve_id.trim() || undefined,
        cvss_score: form.cvss_score === '' ? undefined : Number(form.cvss_score),
        description: form.description.trim(),
        remediation: form.remediation.trim(),
        detection_source: form.source,
      },
      timestamp: new Date().toISOString(),
    }

    try {
      const res = await fetch(`${CRQ_API}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(envelope),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const detail = Array.isArray(data?.detail)
          ? data.detail.map((d) => d.msg).join('; ')
          : data?.detail
        throw new Error(detail || `CRQ returned ${res.status}`)
      }

      if (data.status === 'duplicate') {
        setStatus({ type: 'duplicate', msg: 'This exact finding was already recorded — duplication prevented.' })
      } else {
        setStatus({ type: 'success', msg: 'Finding recorded. The risk engine is recomputing Expected Annual Loss.' })
        action?.('Vulnerability finding submitted to CRQ')
        setEventId(crypto.randomUUID())
        setForm({ asset_id: '', title: '', cve_id: '', cvss_score: '', source: 'manual_assessment', description: '', remediation: '' })
        // Give the FAIR recompute a moment, then pull fresh numbers.
        setTimeout(() => onSubmitted?.(), 1200)
      }
    } catch (err) {
      setStatus({ type: 'error', msg: err.message || 'Failed to submit finding.' })
    } finally {
      setBusy(false)
    }
  }

  const noteColor = { success: '#0e9f72', duplicate: '#d79422', error: '#c0392b' }[status?.type] || '#5d6a82'
  const noteBg = { success: '#e5f7f1', duplicate: '#fff2d5', error: '#fff2f2' }[status?.type] || '#f6f8fc'

  return (
    <form className="form-panel" onSubmit={submit}>
      <h3 style={{ margin: '0 0 4px', fontFamily: 'Georgia, serif', color: 'var(--navy)', fontWeight: 500 }}>
        Report security finding
      </h3>
      <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 20px' }}>
        Log a manual vulnerability. It is ingested as a <code>vuln.detected</code> event and feeds the real-time EAL engine.
      </p>

      {status && (
        <div style={{ background: noteBg, color: noteColor, border: `1px solid ${noteColor}33`, borderRadius: 6, padding: '10px 13px', fontSize: 11, marginBottom: 16 }}>
          {status.msg}
        </div>
      )}

      <div className="form-row">
        <div className="form-field">
          <label>Affected asset / system</label>
          <input className="text-input" placeholder="e.g. Core Banking Database" value={form.asset_id} onChange={set('asset_id')} />
        </div>
        <div className="form-field">
          <label>Detection source</label>
          <select className="text-input" value={form.source} onChange={set('source')}>
            <option value="manual_assessment">Manual assessment</option>
            <option value="pentest">Penetration test</option>
            <option value="code_review">Code review</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>

      <div className="form-field">
        <label>Finding title</label>
        <input className="text-input" placeholder="Brief summary of the vulnerability" value={form.title} onChange={set('title')} />
      </div>

      <div className="form-row">
        <div className="form-field">
          <label>CVE ID <small>(optional)</small></label>
          <input className="text-input" placeholder="CVE-2024-1234" value={form.cve_id} onChange={set('cve_id')} />
        </div>
        <div className="form-field">
          <label>CVSS base score <small>(optional)</small></label>
          <input className="text-input" type="number" step="0.1" min="1" max="10" placeholder="1.0 – 10.0" value={form.cvss_score} onChange={set('cvss_score')} />
        </div>
      </div>

      <div className="form-field">
        <label>Technical description</label>
        <textarea className="text-input" rows={3} placeholder="Details of the finding, reproduction steps…" value={form.description} onChange={set('description')} style={{ resize: 'vertical', minHeight: 72 }} />
      </div>

      <div className="form-field">
        <label>Remediation recommendation</label>
        <textarea className="text-input" rows={2} placeholder="How to fix this issue…" value={form.remediation} onChange={set('remediation')} style={{ resize: 'vertical', minHeight: 56 }} />
      </div>

      <div className="form-footer">
        <span>Findings post directly to the CRQ risk engine.</span>
        <button className="primary-button" type="submit" disabled={busy}>
          {busy ? 'Submitting…' : 'Submit finding'}
        </button>
      </div>
    </form>
  )
}

export default function CRQDashboard({ session, action }) {
  const [summary, setSummary] = useState(null)
  const [assetSnapshot, setAssetSnapshot] = useState(null)
  const [contributors, setContributors] = useState([])
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [liveUpdate, setLiveUpdate] = useState(null)

  const [wsStatus, setWsStatus] = useState('connecting')
  const wsRef = useRef(null)

  const [chatInput, setChatInput] = useState('')
  const [chatHistory, setChatHistory] = useState([
    { role: 'assistant', text: 'I am the CRQ assistant. Ask about your top risks, an asset’s exposure, or a remediation scenario.' },
  ])
  const [chatBusy, setChatBusy] = useState(false)
  const chatEndRef = useRef(null)

  const fetchRiskData = useCallback(async () => {
    setLoadError(null)
    try {
      const [sum, contrib, hist] = await Promise.allSettled([
        crqGet('/risk/summary?scope=org'),
        crqGet('/risk/contributors?top=8'),
        crqGet('/risk/history?scope=org'),
      ])

      if (sum.status === 'fulfilled') setSummary(sum.value)
      else if (sum.reason?.status === 404) setSummary(null)
      else throw sum.reason

      if (contrib.status === 'fulfilled') setContributors(contrib.value.top_contributors || [])
      if (hist.status === 'fulfilled') setHistory(hist.value.points || [])

      // Latest asset-scoped snapshot (created whenever an event triggers a recompute).
      try {
        setAssetSnapshot(await crqGet('/risk/summary?scope=asset'))
      } catch (e) {
        if (e.status === 404) setAssetSnapshot(null)
      }
    } catch (err) {
      setLoadError(
        err.message === 'Failed to fetch'
          ? `Cannot reach the CRQ service at ${CRQ_API}. Start it, then retry.`
          : err.message || 'Failed to load CRQ data.',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRiskData()

    let ws
    try {
      ws = new WebSocket(`${CRQ_WS}?org_id=${ORG_ID}&token=dev-bypass`)
      ws.onopen = () => setWsStatus('connected')
      ws.onclose = () => setWsStatus('disconnected')
      ws.onerror = () => setWsStatus('disconnected')
      ws.onmessage = (event) => {
        let msg
        try { msg = JSON.parse(event.data) } catch { return }
        if (msg.topic === 'eal.updated' || msg.topic === 'risk.alert') {
          setLiveUpdate({
            eal: msg.new_eal,
            previous: msg.previous_eal,
            orgEal: msg.org_eal,
            deltaPct: msg.delta_pct,
            alert: msg.threshold_alert,
            scope: msg.scope,
            at: msg.timestamp,
          })
          setChatHistory((prev) => [...prev, {
            role: 'system',
            text: `Risk state changed — ${msg.scope} EAL now ${fmtINR(msg.new_eal)} (${msg.delta_pct > 0 ? '+' : ''}${msg.delta_pct}%)`
              + (msg.org_eal != null ? `; portfolio EAL ${fmtINR(msg.org_eal)}` : ''),
          }])
          fetchRiskData()
        }
      }
      wsRef.current = ws
    } catch {
      setWsStatus('disconnected')
    }
    return () => ws && ws.close()
  }, [fetchRiskData])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory])

  const askAI = async (e) => {
    e.preventDefault()
    const query = chatInput.trim()
    if (!query) return
    setChatInput('')
    setChatHistory((prev) => [...prev, { role: 'user', text: query }])
    setChatBusy(true)
    try {
      const res = await fetch(`${CRQ_API}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      })
      if (!res.ok) throw new Error(`CRQ query ${res.status}`)
      const data = await res.json()
      setChatHistory((prev) => [...prev, { role: 'assistant', text: data.answer || '(no answer returned)' }])
    } catch {
      setChatHistory((prev) => [...prev, { role: 'assistant', text: 'Could not reach the CRQ AI gateway.' }])
    } finally {
      setChatBusy(false)
    }
  }

  if (loading) {
    return <div className="form-panel"><p style={{ margin: 0, color: 'var(--muted)' }}>Connecting to the CRQ risk engine…</p></div>
  }

  const wsColor = wsStatus === 'connected' ? 'var(--green)' : '#c0392b'

  return (
    <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <div style={{ flex: '1 1 520px', display: 'flex', flexDirection: 'column', gap: 24, minWidth: 0 }}>

        {loadError && (
          <div className="form-panel" style={{ borderColor: '#f7c5c5' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <span style={{ color: '#c0392b', fontSize: 12 }}>{loadError}</span>
              <button className="secondary-button" onClick={fetchRiskData}>Retry</button>
            </div>
          </div>
        )}

        {/* Portfolio EAL */}
        <div className="form-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--line)', paddingBottom: 12, marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontFamily: 'Georgia, serif', color: 'var(--navy)', fontWeight: 500 }}>Portfolio Expected Annual Loss</h3>
            <span style={{ fontSize: 11, color: wsColor, fontWeight: 700 }}>
              ● {wsStatus === 'connected' ? 'LIVE' : wsStatus === 'connecting' ? 'CONNECTING' : 'OFFLINE'}
            </span>
          </div>

          {summary ? (
            <>
              <div style={{ fontSize: 44, fontWeight: 700, color: 'var(--navy)', letterSpacing: '-1px' }}>{fmtINR(summary.eal)}</div>
              <div style={{ marginTop: 12, color: '#4b5563', display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 12 }}>
                <span>95% VaR: <strong>{fmtINR(summary.var_95)}</strong></span>
                <span>99% VaR: <strong>{fmtINR(summary.var_99)}</strong></span>
                <span>Model <strong>v{summary.calculation_version}</strong></span>
                <span>Computed <strong>{fmtWhen(summary.computed_at)}</strong></span>
              </div>
              <LossDistribution dist={summary.loss_distribution} />
            </>
          ) : (
            <p style={{ color: 'var(--muted)', fontSize: 12, margin: 0 }}>
              No organisation-level snapshot yet. Submit a finding below or run the risk engine to generate one.
            </p>
          )}

          {liveUpdate && (
            <div style={{ marginTop: 16, padding: '10px 13px', borderRadius: 6, fontSize: 11, background: liveUpdate.alert ? '#fff2f2' : '#e5f7f1', color: liveUpdate.alert ? '#c0392b' : '#0e9f72', border: `1px solid ${liveUpdate.alert ? '#f7c5c5' : '#bfe8d9'}` }}>
              Live recompute ({liveUpdate.scope} scope): <strong>{fmtINR(liveUpdate.eal)}</strong>
              {liveUpdate.previous != null && <> — from {fmtINR(liveUpdate.previous)} </>}
              ({liveUpdate.deltaPct > 0 ? '+' : ''}{liveUpdate.deltaPct}%){liveUpdate.alert ? ' · threshold breach' : ''}
              {liveUpdate.orgEal != null && <> · portfolio now <strong>{fmtINR(liveUpdate.orgEal)}</strong></>}
            </div>
          )}

          {history.length > 1 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
                EAL history · {history.length} snapshots
              </div>
              <Sparkline points={history} />
            </div>
          )}
        </div>

        {/* Latest asset recompute */}
        {assetSnapshot && (
          <div className="form-panel">
            <h3 style={{ margin: '0 0 12px', fontFamily: 'Georgia, serif', color: 'var(--navy)', fontWeight: 500 }}>Most recent asset recompute</h3>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 12, color: '#4b5563' }}>
              <span>EAL: <strong style={{ color: 'var(--navy)' }}>{fmtINR(assetSnapshot.eal)}</strong></span>
              <span>95% VaR: <strong>{fmtINR(assetSnapshot.var_95)}</strong></span>
              <span>Computed <strong>{fmtWhen(assetSnapshot.computed_at)}</strong></span>
            </div>
          </div>
        )}

        {/* Top contributors */}
        <div className="form-panel">
          <h3 style={{ marginTop: 0, fontFamily: 'Georgia, serif', color: 'var(--navy)', fontWeight: 500 }}>Top risk contributors</h3>
          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--line)', color: '#69768d' }}>
                <th style={{ padding: '8px 0' }}>Asset / vulnerability</th>
                <th style={{ padding: '8px 0', textAlign: 'right' }}>Share</th>
                <th style={{ padding: '8px 0', textAlign: 'right' }}>EAL contribution</th>
              </tr>
            </thead>
            <tbody>
              {contributors.map((c) => (
                <tr key={`${c.contributor_type}-${c.id}`} style={{ borderBottom: '1px solid var(--line)' }}>
                  <td style={{ padding: '12px 0' }}>
                    <div style={{ fontWeight: 600, color: '#39465d' }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: '#9aa5b5' }}>
                      {c.contributor_type}
                      {c.details?.hostname ? ` · ${c.details.hostname}` : ''}
                      {c.criticality != null ? ` · criticality ${c.criticality}` : ''}
                      {c.cvss_score != null ? ` · CVSS ${c.cvss_score}` : ''}
                    </div>
                  </td>
                  <td style={{ padding: '12px 0', textAlign: 'right', color: '#5d6a82' }}>{c.percentage_of_total}%</td>
                  <td style={{ padding: '12px 0', textAlign: 'right', fontWeight: 700, color: 'var(--navy)' }}>{fmtINR(c.eal_contribution)}</td>
                </tr>
              ))}
              {contributors.length === 0 && (
                <tr><td colSpan="3" style={{ padding: '24px 0', textAlign: 'center', color: '#9aa5b5' }}>No contributors returned by the risk engine.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <ReportFindingForm onSubmitted={fetchRiskData} action={action} />
      </div>

      {/* AI assistant */}
      <div className="form-panel" style={{ width: 380, flexShrink: 0, display: 'flex', flexDirection: 'column', maxWidth: '100%' }}>
        <h3 style={{ marginTop: 0, borderBottom: '1px solid var(--line)', paddingBottom: 12, fontFamily: 'Georgia, serif', color: 'var(--navy)', fontWeight: 500 }}>
          CRQ assistant
        </h3>
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, padding: '14px 0', maxHeight: 460 }}>
          {chatHistory.map((msg, i) => (
            <div key={i} style={{
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              background: msg.role === 'user' ? 'var(--navy)' : msg.role === 'system' ? '#fff2d5' : '#f1f4f9',
              color: msg.role === 'user' ? '#fff' : msg.role === 'system' ? '#8a6d1f' : '#39465d',
              padding: '10px 13px', borderRadius: 8, maxWidth: '88%', fontSize: 12, lineHeight: 1.5,
            }}>
              {msg.text}
            </div>
          ))}
          {chatBusy && <div style={{ alignSelf: 'flex-start', background: '#f1f4f9', color: '#9aa5b5', padding: '10px 13px', borderRadius: 8, fontSize: 12 }}>Thinking…</div>}
          <div ref={chatEndRef} />
        </div>
        <form onSubmit={askAI} style={{ display: 'flex', gap: 8, marginTop: 12, borderTop: '1px solid var(--line)', paddingTop: 14 }}>
          <input className="text-input" placeholder="Ask about your risk…" value={chatInput} onChange={(e) => setChatInput(e.target.value)} disabled={chatBusy} style={{ flex: 1 }} />
          <button className="primary-button" type="submit" disabled={chatBusy || !chatInput.trim()}>Send</button>
        </form>
      </div>
    </div>
  )
}
