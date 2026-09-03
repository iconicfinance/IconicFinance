import { getSupabaseClient } from '@/lib/supabase';
import { getDoctorDisplayName } from '@/services/doctors';

export interface PatientBalance {
  id: string;
  patient_id: string;
  doctor_id: string;
  total_due: number;
  total_paid: number;
  is_settled: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PatientBalanceFull extends PatientBalance {
  patient_name: string;
  patient_code: string;
  doctor_name: string;
}

export interface BalanceEvent {
  id: string;
  patient_id: string;
  doctor_id: string;
  event_type: 'balance_created' | 'total_updated' | 'payment';
  old_total: number | null;
  new_total: number | null;
  payment_amount: number | null;
  new_remaining: number | null;
  transaction_id: string | null;
  notes: string | null;
  created_at: string;
}

// ── Reads ─────────────────────────────────────────────────────────────────────

export const getPatientBalance = async (
  patientId: string,
  doctorId: string
): Promise<PatientBalance | null> => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('patient_balance')
    .select('*')
    .eq('patient_id', patientId)
    .eq('doctor_id', doctorId)
    .maybeSingle();
  if (error) throw error;
  return data;
};

const enrichBalances = async (
  balances: PatientBalance[],
  doctorIdOverride?: string
): Promise<PatientBalanceFull[]> => {
  if (balances.length === 0) return [];
  const supabase = getSupabaseClient();
  const patientIds = [...new Set(balances.map((b) => b.patient_id))];
  const doctorIds  = [...new Set(balances.map((b) => b.doctor_id))];

  const [{ data: patients }, { data: doctors }] = await Promise.all([
    supabase.from('patients').select('id, full_name, patient_code').in('id', patientIds),
    supabase.from('doctors').select('id, name, type, custom_label').in('id', doctorIds),
  ]);
  const pm = new Map((patients || []).map((p: any) => [p.id, p]));
  const dm = new Map((doctors  || []).map((d: any) => [d.id, d]));

  return balances.map((b) => {
    const doc = dm.get(b.doctor_id);
    return {
      ...b,
      patient_name: pm.get(b.patient_id)?.full_name    ?? '',
      patient_code: pm.get(b.patient_id)?.patient_code ?? '',
      doctor_name:  doc ? getDoctorDisplayName(doc) : '',
    };
  });
};

export const getAllOutstandingBalances = async (): Promise<PatientBalanceFull[]> => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('patient_balance')
    .select('*')
    .eq('is_settled', false)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return enrichBalances(data || []);
};

export const getOutstandingBalancesByDoctor = async (
  doctorId: string
): Promise<PatientBalanceFull[]> => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('patient_balance')
    .select('*')
    .eq('doctor_id', doctorId)
    .eq('is_settled', false)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return enrichBalances(data || []);
};

export const getBalancesForPatientIds = async (
  patientIds: string[]
): Promise<Map<string, PatientBalance & { doctor_name: string }>> => {
  if (patientIds.length === 0) return new Map();
  const supabase = getSupabaseClient();
  const { data: balances } = await supabase
    .from('patient_balance')
    .select('*')
    .in('patient_id', patientIds)
    .eq('is_settled', false);
  if (!balances || balances.length === 0) return new Map();

  const doctorIds = [...new Set(balances.map((b: any) => b.doctor_id))];
  const { data: doctors } = await supabase.from('doctors').select('id, name, type, custom_label').in('id', doctorIds);
  const dm = new Map((doctors || []).map((d: any) => [d.id, d]));
  return new Map(balances.map((b: any) => {
    const doc = dm.get(b.doctor_id);
    return [b.patient_id, { ...b, doctor_name: doc ? getDoctorDisplayName(doc) : '' }];
  }));
};

/**
 * Fetches current patient_balance rows for a set of (patient_id, doctor_id) pairs,
 * keyed by `${patient_id}_${doctor_id}` for lookup.
 */
export const getBalancesForPatientDoctorPairs = async (
  pairs: { patient_id: string | null; doctor_id: string | null }[]
): Promise<Map<string, PatientBalance>> => {
  const patientIds = [...new Set(
    pairs.filter((p) => p.patient_id && p.doctor_id).map((p) => p.patient_id as string)
  )];
  if (patientIds.length === 0) return new Map();

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('patient_balance')
    .select('*')
    .in('patient_id', patientIds);
  if (error) throw error;

  return new Map((data || []).map((b: any) => [`${b.patient_id}_${b.doctor_id}`, b]));
};

export const getAllBalancesForPatient = async (patientId: string): Promise<PatientBalanceFull[]> => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('patient_balance')
    .select('*')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return enrichBalances(data || []);
};

export const getBalanceEvents = async (
  patientId: string,
  doctorId: string
): Promise<BalanceEvent[]> => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('patient_balance_events')
    .select('*')
    .eq('patient_id', patientId)
    .eq('doctor_id', doctorId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
};

/**
 * Fetches the patient_balance_events tied to a set of transaction IDs — used to
 * show the balance as it stood right after each specific transaction (its
 * new_total/new_remaining at that point), instead of the patient's current
 * balance repeated on every row. A transaction with no linked event was never
 * part of a tracked balance (e.g. a one-off, paid-in-full visit).
 */
export const getBalanceEventsForTransactionIds = async (
  transactionIds: string[]
): Promise<BalanceEvent[]> => {
  if (transactionIds.length === 0) return [];
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('patient_balance_events')
    .select('*')
    .in('transaction_id', transactionIds)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
};

/**
 * Re-derives total_due/total_paid for a patient+doctor balance by replaying its
 * event history, atomically in a single DB statement (public.recompute_patient_balance).
 * Used after a transaction is deleted so its balance_created/total_updated/payment
 * events no longer count toward the total.
 */
export const recomputeAndSyncBalance = async (patientId: string, doctorId: string): Promise<void> => {
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc('recompute_patient_balance', {
    p_patient_id: patientId,
    p_doctor_id: doctorId,
  });
  if (error) throw error;
};

/**
 * Keeps patient_balance in sync when a payment_in transaction is edited.
 * Atomically (public.reconcile_transaction_balance) syncs this transaction's own
 * balance event to the corrected credited amount (moving it if the transaction's
 * patient/doctor changed), then recomputes whichever balance(s) were affected.
 * No-ops if this transaction was never linked to a balance event.
 */
export const reconcileBalanceForEditedTransaction = async (
  transactionId: string,
  before: { patient_id: string | null; doctor_id: string | null },
  after: { patient_id: string | null; doctor_id: string | null; creditedAmount: number }
): Promise<void> => {
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc('reconcile_transaction_balance', {
    p_transaction_id: transactionId,
    p_before_patient_id: before.patient_id,
    p_before_doctor_id: before.doctor_id,
    p_after_patient_id: after.patient_id,
    p_after_doctor_id: after.doctor_id,
    p_credited_amount: after.creditedAmount,
  });
  if (error) throw error;
};

// ── Writes ────────────────────────────────────────────────────────────────────

/**
 * Atomically creates or credits a patient's balance (public.credit_patient_balance):
 * increments total_paid by `amount`, optionally sets a new total_due, and logs the
 * matching patient_balance_events row — all in one DB statement, so a slow network
 * or a second concurrent user can never cause a lost update. This is the only way
 * payments should be credited to a balance; do not read-modify-write from the client.
 *
 * Pass `reset: true` whenever the caller found no *active* balance client-side
 * (balance was null, or was_settled) and is starting a fresh treatment cycle —
 * the underlying row may still exist from a prior, fully-paid cycle, and its
 * stale total_paid must be overwritten, not added to.
 */
export const creditPatientBalance = async (params: {
  patient_id: string;
  doctor_id: string;
  amount: number;
  new_total_due?: number | null;
  transaction_id?: string | null;
  notes?: string | null;
  reset?: boolean;
}): Promise<PatientBalance> => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('credit_patient_balance', {
    p_patient_id: params.patient_id,
    p_doctor_id: params.doctor_id,
    p_amount: params.amount,
    p_new_total_due: params.new_total_due ?? null,
    p_transaction_id: params.transaction_id ?? null,
    p_notes: params.notes ?? null,
    p_reset: params.reset ?? false,
  });
  if (error) throw error;
  return data;
};
