import { z } from 'zod'
import { supabaseAdmin } from '../config/supabase.js'
import { ApiError, assertNoDatabaseError } from '../utils/errors.js'
import { beneficiarySchema, parse, transferSchema } from '../utils/validation.js'
import { recordAudit, recordSecurity } from '../middleware/telemetry.js'
import { getOne, getRows } from '../services/dataService.js'

// Shorthand: integer user id from the application users table
const uid = (req) => req.auth.profile.id

export async function profile(req, res, next) {
  try { const row = await getOne('customer_profiles', (q) => q.eq('user_id', uid(req))); res.json(row) } catch (e) { next(e) }
}

export async function updateProfile(req, res, next) {
  try {
    const { data: row, error } = await supabaseAdmin.from('customer_profiles').update(req.body).eq('user_id', uid(req)).select().single()
    if (error?.code === 'PGRST116') throw new ApiError(404, 'Customer profile not found')
    assertNoDatabaseError(error, 'Unable to update customer profile')
    await recordAudit(req, 'UPDATE_PROFILE', 'customer_profiles', row.id)
    res.json(row)
  } catch (e) { next(e) }
}

export async function account(req, res, next) {
  try { const rows = await getRows('accounts', (q) => q.eq('user_id', uid(req))); res.json(rows) } catch (e) { next(e) }
}

export async function transactions(req, res, next) {
  try {
    const accountIds = await getAccountIds(uid(req))
    if (!accountIds.length) return res.json([])
    const rows = await getRows('transactions', (q) =>
      q.or(`sender_account_id.in.(${accountIds.join(',')}),receiver_account_id.in.(${accountIds.join(',')})`).order('created_at', { ascending: false }))
    res.json(rows)
  } catch (e) { next(e) }
}

export async function beneficiaries(req, res, next) {
  try { res.json(await getRows('beneficiaries', (q) => q.eq('user_id', uid(req)).order('created_at', { ascending: false }))) } catch (e) { next(e) }
}

export async function addBeneficiary(req, res, next) {
  try {
    const input = parse(beneficiarySchema, req.body)
    const { data, error } = await supabaseAdmin.from('beneficiaries').insert({ ...input, user_id: uid(req) }).select().single()
    assertNoDatabaseError(error, 'Unable to add beneficiary')
    await recordAudit(req, 'CREATE_BENEFICIARY', 'beneficiaries', data.id)
    await recordSecurity(req, 'NEW_BENEFICIARY', 'LOW', 'New beneficiary created')
    res.status(201).json(data)
  } catch (e) { next(e) }
}

export async function deleteBeneficiary(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin.from('beneficiaries').delete().eq('id', req.params.id).eq('user_id', uid(req)).select().single()
    if (error?.code === 'PGRST116') throw new ApiError(404, 'Beneficiary not found')
    assertNoDatabaseError(error, 'Unable to delete beneficiary')
    await recordAudit(req, 'DELETE_BENEFICIARY', 'beneficiaries', data.id)
    res.status(204).send()
  } catch (e) { next(e) }
}

export async function transfer(req, res, next) {
  try {
    const input = parse(transferSchema, req.body)
    
    // 1. Check sender balance
    const { data: senderAcc, error: err1 } = await supabaseAdmin
      .from('accounts')
      .select('id, balance')
      .eq('user_id', uid(req))
      .single()
    assertNoDatabaseError(err1, 'Sender account not found')
    
    if (senderAcc.balance < input.amount) {
      throw new ApiError(400, 'Insufficient funds')
    }

    // 2. Validate beneficiary
    const { data: beneficiary, error: err2 } = await supabaseAdmin
      .from('beneficiaries')
      .select('id, account_number')
      .eq('id', input.beneficiary_id)
      .eq('user_id', uid(req))
      .single()
    assertNoDatabaseError(err2, 'Beneficiary not found')

    // 3. Find receiver account (if internal)
    const { data: receiverAcc } = await supabaseAdmin
      .from('accounts')
      .select('id, balance')
      .eq('account_number', beneficiary.account_number)
      .single()
      
    const receiverAccountId = receiverAcc ? receiverAcc.id : null

    // ATOMICITY FIX (Saga Pattern)
    // Step A: Insert transaction as PENDING. If this fails (e.g. constraints), balance is untouched.
    const { data: tx, error: txError } = await supabaseAdmin
      .from('transactions')
      .insert({
        sender_account_id: senderAcc.id,
        receiver_account_id: receiverAccountId,
        amount: input.amount,
        transaction_type: 'TRANSFER',
        description: input.reference || 'Transfer to beneficiary',
        status: 'PENDING'
      })
      .select()
      .single()

    assertNoDatabaseError(txError, 'Failed to initiate transfer')

    // Step B: Update Sender Balance
    const { error: senderErr } = await supabaseAdmin
      .from('accounts')
      .update({ balance: senderAcc.balance - input.amount })
      .eq('id', senderAcc.id)

    if (senderErr) {
      // Rollback transaction state
      await supabaseAdmin.from('transactions').update({ status: 'FAILED' }).eq('id', tx.id)
      throw new ApiError(500, 'Failed to deduct from sender. Transfer aborted.')
    }

    // Step C: Update Receiver Balance
    if (receiverAccountId) {
      const { error: receiverErr } = await supabaseAdmin
        .from('accounts')
        .update({ balance: receiverAcc.balance + input.amount })
        .eq('id', receiverAccountId)
        
      if (receiverErr) {
        // Rollback sender balance and transaction state
        await supabaseAdmin.from('accounts').update({ balance: senderAcc.balance }).eq('id', senderAcc.id)
        await supabaseAdmin.from('transactions').update({ status: 'FAILED' }).eq('id', tx.id)
        throw new ApiError(500, 'Failed to credit receiver. Transfer rolled back.')
      }
    }

    // Step D: Mark transaction as SUCCESS
    await supabaseAdmin.from('transactions').update({ status: 'SUCCESS' }).eq('id', tx.id)

    await recordAudit(req, 'EXECUTE_TRANSFER', 'transactions', tx.id)
    res.status(201).json({ message: 'Transfer successful', transaction_id: tx.id })
  } catch (err) {
    next(err)
  }
}

export async function password(req, res, next) {
  try {
    const input = parse(zPassword, req.body)
    // Update the Supabase Auth password using the auth user's UUID (req.auth.user.id is the Auth UUID)
    const { error } = await supabaseAdmin.auth.admin.updateUserById(req.auth.user.id, { password: input.new_password })
    if (error) throw new ApiError(400, 'Unable to update password')
    await recordAudit(req, 'CHANGE_PASSWORD', 'users', uid(req))
    res.status(204).send()
  } catch (e) { next(e) }
}

// Helper: get integer account ids for a user (used by transactions filter)
async function getAccountIds(userId) {
  const { data } = await supabaseAdmin.from('accounts').select('id').eq('user_id', userId)
  return (data ?? []).map((r) => r.id)
}

const zPassword = z.object({ new_password: z.string().min(8).max(128) })
