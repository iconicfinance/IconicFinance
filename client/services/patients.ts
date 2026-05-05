import { getSupabaseClient } from '@/lib/supabase';
import { normalizeNumbers } from '@/lib/i18n';

export interface Patient {
  id: string;
  patient_code: string;
  full_name: string;
  created_at: string;
  updated_at: string;
}

export interface PatientTransaction {
  id: string;
  type: 'payment_in' | 'expense_out';
  assistant_id: string;
  assistant_name: string;
  patient_id: string | null;
  patient_name: string | null;
  doctor_id: string | null;
  payment_method: 'cash' | 'vodafone_cash' | 'instapay' | null;
  base_amount: number | null;
  final_amount: number;
  has_lab_fees: boolean;
  lab_fees_amount: number | null;
  lab_fees_pending: boolean;
  doctor_earnings: number;
  expense_description: string | null;
  created_at: string;
  updated_at: string;
}

export const searchPatients = async (query: string): Promise<Patient[]> => {
  const supabase = getSupabaseClient();
  // Normalize Arabic/Hindi digits so searching "٢٠" finds "20" in the DB
  const q = normalizeNumbers(query.trim());
  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .or(`patient_code.ilike.%${q}%,full_name.ilike.%${q}%`)
    .order('full_name')
    .limit(50);

  if (error) throw error;
  return data || [];
};

export const getPatientById = async (id: string): Promise<Patient | null> => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .eq('id', id)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data || null;
};

export const getPatientByCode = async (code: string): Promise<Patient | null> => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .eq('patient_code', code)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data || null;
};

export const createPatient = async (data: {
  patient_code: string;
  full_name: string;
}): Promise<Patient> => {
  const supabase = getSupabaseClient();
  const { data: result, error } = await supabase
    .from('patients')
    .insert([data])
    .select()
    .single();

  if (error) throw error;
  return result;
};

export const getPatientTransactions = async (patientId: string): Promise<PatientTransaction[]> => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('patient_id', patientId)
    .eq('type', 'payment_in')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

export const getPatientTransactionsByDoctor = async (
  patientId: string,
  doctorId: string
): Promise<PatientTransaction[]> => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('patient_id', patientId)
    .eq('doctor_id', doctorId)
    .eq('type', 'payment_in')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
};
