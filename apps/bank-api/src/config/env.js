import 'dotenv/config'
import { z } from 'zod'

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  EMAILJS_SERVICE_ID: z.string().min(1),
  EMAILJS_TEMPLATE_ID: z.string().min(1),
  EMAILJS_PUBLIC_KEY: z.string().min(1),
  EMAILJS_PRIVATE_KEY: z.string().min(1),
  OTP_SECRET: z.string().min(16),
  // Optional – used ONLY by the SQL injection simulation (Phase 2 bug lab).
  // Format: postgresql://postgres.[ref]:[password]@aws-0-region.pooler.supabase.com:5432/postgres
  SUPABASE_DB_URL: z.string().optional(),
  // CRQ platform — Bug Lab toggles emit control/vuln events here so the
  // CyberRisk Quantifier recomputes Expected Annual Loss in real time.
  CRQ_BASE_URL: z.string().url().default('http://localhost:8000'),
  CRQ_ORG_ID: z.coerce.number().int().positive().default(1),
})

export const env = envSchema.parse(process.env)
