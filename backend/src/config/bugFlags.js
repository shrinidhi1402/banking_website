/**
 * bugFlags.js – In-memory vulnerability simulation flags
 *
 * Northstar Banking – Risk Assessment Platform
 * Internal use only. All flags default to OFF (safe) on every server restart.
 *
 * Flags:
 *  BUG_MFA                – Phase 1: MFA bypass / Account Takeover simulation
 *  BUG_SQLI               – Phase 2: SQL Injection vulnerability simulation
 *  BUG_IDOR               – Phase 3: Broken Access Control (IDOR) simulation
 *  BUG_EXCESSIVE_PRIVILEGES – Phase 4: Excessive Privileges / Insider Threat
 *  BUG_SECRET_EXPOSURE    – Phase 5: Client-Side Secret Exposure (CWE-798)
 */

const flags = {
  BUG_MFA:  false,
  BUG_SQLI: false,
  BUG_IDOR: false,
  BUG_EXCESSIVE_PRIVILEGES: false,
  BUG_SECRET_EXPOSURE: false,
}

/**
 * Returns the current state of all bug flags.
 */
export function getBugFlags() {
  return { ...flags }
}

/**
 * Returns true if a specific bug flag is enabled.
 * @param {'BUG_MFA'|'BUG_SQLI'|'BUG_IDOR'|'BUG_EXCESSIVE_PRIVILEGES'} flag
 */
export function isBugEnabled(flag) {
  return flags[flag] === true
}

/**
 * Toggles a specific bug flag on/off and returns the new state.
 * @param {'BUG_MFA'|'BUG_SQLI'|'BUG_IDOR'|'BUG_EXCESSIVE_PRIVILEGES'} flag
 */
export function toggleBugFlag(flag) {
  if (!(flag in flags)) throw new Error(`Unknown bug flag: ${flag}`)
  flags[flag] = !flags[flag]
  return flags[flag]
}

/**
 * Explicitly sets a bug flag.
 * @param {'BUG_MFA'|'BUG_SQLI'|'BUG_IDOR'|'BUG_EXCESSIVE_PRIVILEGES'} flag
 * @param {boolean} value
 */
export function setBugFlag(flag, value) {
  if (!(flag in flags)) throw new Error(`Unknown bug flag: ${flag}`)
  flags[flag] = Boolean(value)
  return flags[flag]
}
