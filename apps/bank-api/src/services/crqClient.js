import { randomUUID } from 'node:crypto'
import { env } from '../config/env.js'

/**
 * Emits a security / control event to the CRQ platform.
 *
 * Fire-and-forget: a slow or unreachable CRQ must never block or crash a
 * banking request. Failures are logged and swallowed.
 *
 * @param {string} eventType  CRQ event type, e.g. "control.disabled", "vuln.detected"
 * @param {object} payload    event-specific body (asset_id, control, cve_id, cvss_score, status…)
 * @returns {Promise<{ok: boolean, status?: number, error?: string}>}
 */
export async function emitCRQEvent(eventType, payload = {}) {
  const base = env.CRQ_BASE_URL?.replace(/\/+$/, '')
  if (!base) {
    console.warn(`[CRQ] CRQ_BASE_URL not set — event ${eventType} skipped`)
    return { ok: false, error: 'not configured' }
  }

  const envelope = {
    event_id: randomUUID(),
    event_type: eventType,
    org_id: env.CRQ_ORG_ID, // integer — matches crq_organizations.id
    source: 'bank-site',
    payload,
    timestamp: new Date().toISOString(),
  }

  const url = `${base}/api/v1/events`

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(envelope),
        signal: AbortSignal.timeout(3000),
      })

      if (!res.ok) {
        const body = await res.text().catch(() => '')
        throw new Error(`CRQ ${res.status} ${res.statusText} ${body}`.trim())
      }

      const data = await res.json().catch(() => ({}))
      console.log(`[CRQ] ${eventType} → ${data.status ?? 'ok'} (event ${envelope.event_id})`)
      return { ok: true, status: res.status }
    } catch (err) {
      const msg = err?.message || String(err)
      if (attempt === 2) {
        console.error(`[CRQ] ${eventType} failed after ${attempt} attempts: ${msg}`)
        return { ok: false, error: msg }
      }
      console.warn(`[CRQ] ${eventType} attempt ${attempt} failed: ${msg} — retrying`)
    }
  }
  return { ok: false, error: 'unreachable' }
}
