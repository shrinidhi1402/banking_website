import { supabaseAdmin } from '../config/supabase.js'
import { ApiError, assertNoDatabaseError } from '../utils/errors.js'

export async function getRows(table, queryBuilder) {
  let query = supabaseAdmin.from(table).select('*')
  query = queryBuilder ? queryBuilder(query) : query
  const { data, error } = await query
  assertNoDatabaseError(error, `Unable to load ${table}`)
  return data ?? []
}

export async function getOne(table, queryBuilder) {
  let query = supabaseAdmin.from(table).select('*')
  query = queryBuilder(query)
  const { data, error } = await query.single()
  if (error?.code === 'PGRST116') throw new ApiError(404, `${table} record not found`)
  assertNoDatabaseError(error, `Unable to load ${table}`)
  return data
}

export async function updateOne(table, id, patch) {
  const { data, error } = await supabaseAdmin.from(table).update(patch).eq('id', id).select().single()
  if (error?.code === 'PGRST116') throw new ApiError(404, `${table} record not found`)
  assertNoDatabaseError(error, `Unable to update ${table}`)
  return data
}
