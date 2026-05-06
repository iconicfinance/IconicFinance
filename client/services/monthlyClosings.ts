import { getSupabaseClient } from '@/lib/supabase';

export interface MonthlyClosing {
  id: string;
  month: number;
  year: number;
  doctor_id: string;
  case_count: number | null;
  total_revenue: number;
  total_lab_fees: number;
  doctor_gross_earnings: number;
  clinic_remaining_share: number | null;
  amount_to_pay: number | null;
  comment: string | null;
  is_confirmed: boolean;
  confirmed_by: string | null;
  confirmed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MonthlySummaryRow {
  doctor_id: string;
  doctor_name: string;
  doctor_type: 'primary' | 'extern' | 'custom';
  custom_percentage: number | null;
  custom_label: string | null;
  case_count: number;
  total_revenue: number;
  total_lab_fees: number;
  doctor_gross_earnings: number;
  clinic_total_revenue: number;
  clinic_total_expenses: number;
  clinic_total_salaries: number;
  clinic_extern_custom_cut: number;
  clinic_remaining: number;
  primary_doctor_count: number;
  primary_doctor_share: number;
}

export const getClosingsByDoctor = async (doctorId: string): Promise<MonthlyClosing[]> => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('monthly_closings')
    .select('*')
    .eq('doctor_id', doctorId)
    .order('year', { ascending: false })
    .order('month', { ascending: false });

  if (error) throw error;
  return data || [];
};

export const getConfirmedClosingsByDoctor = async (doctorId: string): Promise<MonthlyClosing[]> => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('monthly_closings')
    .select('*')
    .eq('doctor_id', doctorId)
    .eq('is_confirmed', true)
    .order('year', { ascending: false })
    .order('month', { ascending: false });

  if (error) throw error;
  return data || [];
};

export const getClosingsForMonth = async (
  year: number,
  month: number
): Promise<MonthlyClosing[]> => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('monthly_closings')
    .select('*')
    .eq('year', year)
    .eq('month', month);

  if (error) throw error;
  return data || [];
};

export const getMonthlySummary = async (
  year: number,
  month: number
): Promise<MonthlySummaryRow[]> => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('get_monthly_closing_summary', {
    p_year: year,
    p_month: month,
  });

  if (error) throw error;
  return data || [];
};

export const saveClosing = async (data: {
  month: number;
  year: number;
  doctor_id: string;
  case_count: number;
  total_revenue: number;
  total_lab_fees: number;
  doctor_gross_earnings: number;
  clinic_remaining_share: number | null;
  amount_to_pay: number | null;
  comment: string | null;
  is_confirmed: boolean;
}): Promise<MonthlyClosing> => {
  const supabase = getSupabaseClient();
  const { data: result, error } = await supabase
    .from('monthly_closings')
    .upsert(data, { onConflict: 'doctor_id,month,year' })
    .select()
    .single();

  if (error) throw error;
  return result;
};

export const confirmClosing = async (
  id: string,
  confirmedByUserId: string
): Promise<MonthlyClosing> => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('monthly_closings')
    .update({
      is_confirmed: true,
      confirmed_by: confirmedByUserId,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const reopenClosing = async (id: string): Promise<MonthlyClosing> => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('monthly_closings')
    .update({ is_confirmed: false })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
};
