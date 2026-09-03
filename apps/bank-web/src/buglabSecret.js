/**
 * buglabSecret.js
 *
 * Northstar Banking – Risk Assessment Platform
 * Internal BugLab Module · Phase 5 · CWE-798
 *
 * ══════════════════════════════════════════════════════════════════════
 * INTENTIONALLY FAKE CREDENTIAL — FOR SIMULATION PURPOSES ONLY
 *
 * This module is lazy-loaded ONLY when BUG_SECRET_EXPOSURE is active.
 * It is NOT loaded during normal application operation.
 *
 * The credential below is entirely fictional and non-functional.
 * It does not correspond to any real Supabase project, API, database,
 * or production system. It exists solely to simulate CWE-798
 * (Use of Hard-coded Credentials) in the BugLab environment.
 * ══════════════════════════════════════════════════════════════════════
 */

// *** FAKE — NOT A REAL CREDENTIAL ***
export const FAKE_SUPABASE_SERVICE_ROLE_KEY = 'BUGLAB_FAKE_ONLY_NOT_A_REAL_CREDENTIAL'

// *** FAKE FLAG — FOR RISK ASSESSMENT DEMONSTRATION ***
export const EXPOSURE_FLAG = 'FLAG{CLIENT_SIDE_SECRET_EXPOSURE}'

export const BUGLAB_META = {
  phase: 5,
  vulnerability: 'Client-Side Secret Exposure',
  cwe: 'CWE-798',
  severity: 'CRITICAL',
  note: 'Simulated hard-coded credential. No real secret is present in this module.',
  FAKE_SUPABASE_SERVICE_ROLE_KEY,
  EXPOSURE_FLAG,
}
