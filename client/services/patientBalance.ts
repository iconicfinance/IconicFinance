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
