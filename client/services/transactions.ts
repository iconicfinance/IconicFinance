import { getSupabaseClient } from '@/lib/supabase';

export interface Transaction {
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

export const getTodayTransactions = async (): Promise<Transaction[]> => {
  const supabase = getSupabaseClient();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .gte('created_at', today.toISOString())
    .lt('created_at', tomorrow.toISOString())
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

export const getTransactionsByDateRange = async (from: Date, to: Date): Promise<Transaction[]> => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .gte('created_at', from.toISOString())
    .lt('created_at', to.toISOString())
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

export const getTransactionsByDoctor = async (
  doctorId: string,
  from: Date,
  to: Date
): Promise<Transaction[]> => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('doctor_id', doctorId)
    .eq('type', 'payment_in')
    .gte('created_at', from.toISOString())
    .lt('created_at', to.toISOString())
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

export const getTransactionsByAssistant = async (
  assistantId: string,
  from: Date,
  to: Date
): Promise<Transaction[]> => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('assistant_id', assistantId)
    .gte('created_at', from.toISOString())
    .lt('created_at', to.toISOString())
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

export const getPendingLabFees = async (): Promise<Transaction[]> => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('type', 'payment_in')
    .eq('lab_fees_pending', true)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

export const createPaymentIn = async (data: {
  assistant_id: string;
  assistant_name: string;
  patient_id: string;
  patient_name: string;
  doctor_id: string;
  payment_method: 'cash' | 'vodafone_cash' | 'instapay';
  base_amount: number;
  final_amount: number;
  has_lab_fees: boolean;
  lab_fees_amount: number | null;
  expense_description?: string | null;
  created_at?: string;
}): Promise<Transaction> => {
  const supabase = getSupabaseClient();
  const { data: result, error } = await supabase
    .from('transactions')
    .insert([{ ...data, type: 'payment_in' }])
    .select()
    .single();

  if (error) throw error;
  return result;
};

export const createExpenseOut = async (data: {
  assistant_id: string;
  assistant_name: string;
  final_amount: number;
  expense_description: string;
  payment_method?: 'cash' | 'vodafone_cash' | 'instapay';
  created_at?: string;
}): Promise<Transaction> => {
  const supabase = getSupabaseClient();
  const { data: result, error } = await supabase
    .from('transactions')
    .insert([
      {
        ...data,
        type: 'expense_out',
        base_amount: data.final_amount,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return result;
};

export const updateTransaction = async (
  id: string,
  updates: Partial<{
    patient_id: string | null;
    patient_name: string | null;
    doctor_id: string | null;
    payment_method: 'cash' | 'vodafone_cash' | 'instapay' | null;
    base_amount: number | null;
    final_amount: number;
    has_lab_fees: boolean;
    lab_fees_amount: number | null;
    expense_description: string | null;
    created_at: string;
  }>
): Promise<Transaction> => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('transactions')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const updateLabFees = async (
  transactionId: string,
  labFeesAmount: number
): Promise<Transaction> => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('transactions')
    .update({ lab_fees_amount: labFeesAmount })
    .eq('id', transactionId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const getDailyTotals = async (date: Date) => {
  const supabase = getSupabaseClient();
  const startDate = new Date(date);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(date);
  endDate.setDate(endDate.getDate() + 1);

  const { data, error } = await supabase
    .from('transactions')
    .select('payment_method, final_amount, type')
    .gte('created_at', startDate.toISOString())
    .lt('created_at', endDate.toISOString());

  if (error) throw error;

  const totals = { cash: 0, vodafone_cash: 0, instapay: 0, expenses: 0 };
  data?.forEach((tx: any) => {
    if (tx.type === 'payment_in') {
      if (tx.payment_method === 'cash') totals.cash += Number(tx.final_amount);
      else if (tx.payment_method === 'vodafone_cash') totals.vodafone_cash += Number(tx.final_amount);
      else if (tx.payment_method === 'instapay') totals.instapay += Number(tx.final_amount);
    } else if (tx.type === 'expense_out') {
      totals.expenses += Number(tx.final_amount);
    }
  });

  return totals;
};

export const getMonthlyTotals = async (year: number, month: number) => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('get_monthly_totals', {
    p_year: year,
    p_month: month,
  });

  if (error) throw error;
  return data?.[0] || null;
};
