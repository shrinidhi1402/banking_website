/**
 * pgClient.js – Raw PostgreSQL pool for SQL injection simulation (Phase 2)
 *
 * This client connects directly to Supabase's Postgres database.
 * It is ONLY used in the bug simulation lab — never in production paths.
 *
 * The pool is lazily initialised so the server still starts correctly
 * even if SUPABASE_DB_URL is not configured (Phase 2 will return a 
 * degraded-mode simulation in that case).
 */

import pg from 'pg'
import { env } from './env.js'

const { Pool } = pg

let _pool = null

export function getPgPool() {
  if (!env.SUPABASE_DB_URL) return null
  if (!_pool) {
    _pool = new Pool({
      connectionString: env.SUPABASE_DB_URL,
      ssl: { rejectUnauthorized: false },
      max: 3,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    })
    _pool.on('error', (err) => {
      console.error('[pgClient] Unexpected pool error:', err.message)
    })
  }
  return _pool
}
