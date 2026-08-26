import { z } from 'zod'
import { ApiError } from './errors.js'

export const idSchema = z.string().uuid()
export const roleSchema = z.enum(['CUSTOMER', 'EMPLOYEE', 'MANAGER'])
export const transferSchema = z.object({ beneficiary_id: z.number().int().positive(), amount: z.number().positive().finite(), reference: z.string().trim().max(140).optional() })
export const beneficiarySchema = z.object({ beneficiary_name: z.string().trim().min(2).max(120), account_number: z.string().trim().min(4).max(40), bank_name: z.string().trim().min(2).max(120), ifsc: z.string().trim().max(20) })
export const requestDecisionSchema = z.object({ status: z.enum(['APPROVED', 'REJECTED']), note: z.string().trim().max(500).optional() })

export function parse(schema, value) {
  const result = schema.safeParse(value)
  if (!result.success) throw new ApiError(400, 'Validation failed', result.error.issues)
  return result.data
}
