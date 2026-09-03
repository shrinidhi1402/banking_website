import { v4 as uuidv4 } from 'uuid';

/**
 * Emits a security or control event to the CRQ platform backend.
 * This is a fire-and-forget style integration that will not crash
 * the calling application if CRQ is unreachable.
 * 
 * @param {string} eventType - The CRQ event type (e.g. control.disabled, vuln.detected)
 * @param {object} payload - The event-specific payload
 */
export async function emitCRQEvent(eventType, payload) {
  const crqUrl = process.env.CRQ_BASE_URL;
  const orgId = process.env.CRQ_ORG_ID;

  if (!crqUrl || !orgId) {
    console.warn(`[CRQ Client] CRQ_BASE_URL or CRQ_ORG_ID not configured. Event ${eventType} skipped.`);
    return;
  }

  const envelope = {
    event_id: uuidv4(),
    event_type: eventType,
    org_id: orgId,
    source: 'bank-site',
    payload: payload,
    timestamp: new Date().toISOString()
  };

  const url = `${crqUrl.replace(/\/+$/, '')}/api/v1/events`;

  // Simple retry wrapper (retry once)
  let attempt = 0;
  while (attempt < 2) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(envelope),
        timeout: 3000 // 3s timeout
      });

      if (!response.ok) {
        throw new Error(`CRQ returned ${response.status} ${response.statusText}`);
      }

      console.log(`[CRQ Client] Event ${eventType} emitted successfully to CRQ.`);
      
      // Local audit log (fire and forget)
      logEventToAudit(eventType, payload, response.status);
      return; // Success
    } catch (error) {
      attempt++;
      console.warn(`[CRQ Client] Attempt ${attempt} failed for event ${eventType}: ${error.message}`);
      if (attempt >= 2) {
        console.error(`[CRQ Client] Exhausted retries. Event ${eventType} could not be delivered.`);
        logEventToAudit(eventType, payload, 'failed');
      }
    }
  }
}

async function logEventToAudit(eventType, payload, status) {
  try {
    // Import dynamically to avoid circular dependencies if any,
    // or just assume supabaseAdmin is available.
    const { supabaseAdmin } = await import('../config/supabase.js');
    
    // We create a new table 'crq_event_audit' or just use 'security_events'.
    // The prompt says: "keep a simple table or log of {event_type, payload, sent_at, crq_response_status} in the bank site's own Supabase"
    // Assuming we insert into 'crq_event_logs'
    await supabaseAdmin.from('crq_event_logs').insert({
      event_type: eventType,
      payload: payload,
      sent_at: new Date().toISOString(),
      crq_response_status: status.toString()
    });
  } catch (err) {
    console.error(`[CRQ Client] Failed to write local audit log: ${err.message}`);
  }
}
