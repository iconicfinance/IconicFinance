import { getSupabaseClient } from '@/lib/supabase';

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
    supabase.from('doctors').select('id, name').in('id', doctorIds),
  ]);
  const pm = new Map((patients || []).map((p: any) => [p.id, p]));
  const dm = new Map((doctors  || []).map((d: any) => [d.id, d]));

  return balances.map((b) => ({
    ...b,
    patient_name: pm.get(b.patient_id)?.full_name    ?? '',
    patient_code: pm.get(b.patient_id)?.patient_code ?? '',
    doctor_name:  dm.get(b.doctor_id)?.name           ?? '',
  }));
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
  const { data: doctors } = await supabase.from('doctors').select('id, name').in('id', doctorIds);
  const dm = new Map((doctors || []).map((d: any) => [d.id, d.name]));
  return new Map(balances.map((b: any) => [b.patient_id, { ...b, doctor_name: dm.get(b.doctor_id) ?? '' }]));
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
 * Re-derives total_due/total_paid for a patient+doctor balance by replaying its
 * remaining event history (in order). Used after a transaction is deleted so its
 * balance_created/total_updated/payment events no longer count toward the total.
 */
export const recomputeAndSyncBalance = async (patientId: string, doctorId: string): Promise<void> => {
  const supabase = getSupabaseClient();

  const { data: balance, error: balanceError } = await supabase
    .from('patient_balance')
    .select('*')
    .eq('patient_id', patientId)
    .eq('doctor_id', doctorId)
    .maybeSingle();
  if (balanceError) throw balanceError;
  if (!balance) return;

  const events = await getBalanceEvents(patientId, doctorId);

  let totalDue = 0;
  let totalPaid = 0;
  for (const e of events) {
    if (e.event_type === 'balance_created') {
      totalDue = e.new_total ?? totalDue;
      totalPaid = e.payment_amount ?? 0;
    } else if (e.event_type === 'total_updated') {
      totalDue = e.new_total ?? totalDue;
    } else if (e.event_type === 'payment') {
      totalPaid += e.payment_amount ?? 0;
    }
  }
  totalPaid = Math.max(0, Math.min(totalPaid, totalDue));

  if (totalDue <= 0 && totalPaid <= 0) {
    await supabase.from('patient_balance').delete().eq('id', balance.id);
    return;
  }

  await supabase
    .from('patient_balance')
    .update({
      total_due: totalDue,
      total_paid: totalPaid,
      is_settled: totalPaid >= totalDue,
      updated_at: new Date().toISOString(),
    })
    .eq('id', balance.id);
};

/**
 * Keeps patient_balance in sync when a payment_in transaction is edited.
 * Syncs this transaction's own balance events to the corrected credited amount
 * (and moves them if the transaction's patient/doctor changed), then recomputes
 * whichever balance(s) were affected.
 */
export const reconcileBalanceForEditedTransaction = async (
  transactionId: string,
  before: { patient_id: string | null; doctor_id: string | null },
  after: { patient_id: string | null; doctor_id: string | null; creditedAmount: number }
): Promise<void> => {
  const supabase = getSupabaseClient();

  const { data: events, error: eventsError } = await supabase
    .from('patient_balance_events')
    .select('*')
    .eq('transaction_id', transactionId);
  if (eventsError) throw eventsError;
  if (!events || events.length === 0) return;

  const moved = before.patient_id !== after.patient_id || before.doctor_id !== after.doctor_id;

  for (const e of events as any[]) {
    const patch: Record<string, any> = {};
    if (e.event_type === 'payment' || e.event_type === 'balance_created') {
      patch.payment_amount = after.creditedAmount;
    }
    if (moved) {
      patch.patient_id = after.patient_id;
      patch.doctor_id = after.doctor_id;
    }
    if (Object.keys(patch).length > 0) {
      await supabase.from('patient_balance_events').update(patch).eq('id', e.id);
    }
  }

  if (before.patient_id && before.doctor_id) {
    await recomputeAndSyncBalance(before.patient_id, before.doctor_id);
  }

  if (moved && after.patient_id && after.doctor_id) {
    const { data: existing } = await supabase
      .from('patient_balance')
      .select('id')
      .eq('patient_id', after.patient_id)
      .eq('doctor_id', after.doctor_id)
      .maybeSingle();
    if (!existing) {
      await supabase.from('patient_balance').insert({
        patient_id: after.patient_id, doctor_id: after.doctor_id,
        total_due: 0, total_paid: 0, is_settled: true,
      });
    }
    await recomputeAndSyncBalance(after.patient_id, after.doctor_id);
  }
};

// ── Writes ────────────────────────────────────────────────────────────────────

export const upsertPatientBalance = async (data: {
  patient_id: string;
  doctor_id: string;
  total_due: number;
  total_paid: number;
  is_settled: boolean;
  notes?: string | null;
}): Promise<PatientBalance> => {
  const supabase = getSupabaseClient();
  const { data: result, error } = await supabase
    .from('patient_balance')
    .upsert({ ...data, updated_at: new Date().toISOString() }, { onConflict: 'patient_id,doctor_id' })
    .select()
    .single();
  if (error) throw error;
  return result;
};

export const updatePatientBalance = async (
  id: string,
  updates: Partial<Pick<PatientBalance, 'total_due' | 'total_paid' | 'is_settled' | 'notes'>>
): Promise<PatientBalance> => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('patient_balance')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const logBalanceEvent = async (
  event: Omit<BalanceEvent, 'id' | 'created_at'>
): Promise<void> => {
  const supabase = getSupabaseClient();
  // Fire-and-forget — don't break payment flow if event log fails
  supabase.from('patient_balance_events').insert([event]).then(() => {});
};
