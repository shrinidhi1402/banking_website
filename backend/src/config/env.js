import 'dotenv/config'
import { z } from 'zod'

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
})

export const env = envSchema.parse(process.env)
