/**
 * bugFlags.js – In-memory vulnerability simulation flags
 *
 * Northstar Banking – Risk Assessment Platform
 * Internal use only. All flags default to OFF (safe) on every server restart.
 *
 * Flags:
 *  BUG_MFA                      – Phase 1: MFA bypass / Account Takeover simulation
 *  BUG_SQLI                     – Phase 2: SQL Injection vulnerability simulation
 *  BUG_IDOR                     – Phase 3: Broken Access Control (IDOR) simulation
 *  BUG_EXCESSIVE_PRIVILEGES     – Phase 4: Excessive Privileges / Insider Threat
 *  BUG_SECRET_EXPOSURE          – Phase 5: Client-Side Secret Exposure (CWE-798)
 *  BUG_SUPPLY_CHAIN_COMPROMISE  – Phase 6: Vendor/Third-Party Software Supply Chain Compromise
 *  BUG_PAM_JUMP_SERVER          – Phase 7: Compromised Privileged Access / Jump Server
 */

import fs from 'fs'
import path from 'path'

const FLAGS_FILE = path.join(process.cwd(), 'flags.json')

// Default flags
let flags = {
  BUG_MFA:  false,
  BUG_SQLI: false,
  BUG_IDOR: false,
  BUG_EXCESSIVE_PRIVILEGES: false,
  BUG_SECRET_EXPOSURE: false,
  BUG_SUPPLY_CHAIN_COMPROMISE: false,
  BUG_PAM_JUMP_SERVER: false,
}

// Load flags from disk on startup if file exists
try {
  if (fs.existsSync(FLAGS_FILE)) {
    const saved = JSON.parse(fs.readFileSync(FLAGS_FILE, 'utf-8'))
    flags = { ...flags, ...saved }
  }
} catch (e) {
  console.error('[BugLab] Error loading flags from disk:', e.message)
}

function saveFlags() {
  try {
    fs.writeFileSync(FLAGS_FILE, JSON.stringify(flags, null, 2))
  } catch (e) {
    console.error('[BugLab] Error saving flags to disk:', e.message)
  }
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

export function toggleBugFlag(flag) {
  if (!(flag in flags)) throw new Error(`Unknown bug flag: ${flag}`)
  flags[flag] = !flags[flag]
  saveFlags()
  return flags[flag]
}

export function setBugFlag(flag, value) {
  if (!(flag in flags)) throw new Error(`Unknown bug flag: ${flag}`)
  flags[flag] = Boolean(value)
  saveFlags()
  return flags[flag]
}
