import { getSupabaseClient } from '@/lib/supabase';

export interface TransactionLabFee {
  id: string;
  transaction_id: string;
  lab_id: string;
  amount: number;
  created_at: string;
}

export interface TransactionLabFeeWithName extends TransactionLabFee {
  lab_name: string;
}

export const getLabFeesForTransaction = async (transactionId: string): Promise<TransactionLabFeeWithName[]> => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('transaction_lab_fees')
    .select('*')
    .eq('transaction_id', transactionId);
  if (error) throw error;
  if (!data || data.length === 0) return [];

  const labIds = [...new Set(data.map((r: any) => r.lab_id))];
  const { data: labs } = await supabase.from('labs').select('id, name').in('id', labIds);
  const lm = new Map((labs || []).map((l: any) => [l.id, l.name]));

  return data.map((r: any) => ({ ...r, lab_name: lm.get(r.lab_id) ?? '' }));
};

export const getLabFeesForRange = async (
  start: Date,
  end: Date
): Promise<{ lab_id: string; lab_name: string; total: number }[]> => {
  const supabase = getSupabaseClient();

  // Step 1: get payment_in transaction IDs in range
  const { data: txs } = await supabase
    .from('transactions')
    .select('id')
    .eq('type', 'payment_in')
    .gte('created_at', start.toISOString())
    .lt('created_at', end.toISOString());

  if (!txs || txs.length === 0) return [];
  const txIds = txs.map((t: any) => t.id);

  // Step 2: get lab fee breakdown for those transactions
  const { data: fees, error } = await supabase
    .from('transaction_lab_fees')
    .select('lab_id, amount')
    .in('transaction_id', txIds);

  if (error) throw error;
  if (!fees || fees.length === 0) return [];

  // Step 3: get lab names
  const labIds = [...new Set(fees.map((f: any) => f.lab_id))];
  const { data: labs } = await supabase.from('labs').select('id, name').in('id', labIds);
  const lm = new Map((labs || []).map((l: any) => [l.id, l.name]));

  // Aggregate by lab
  const map = new Map<string, number>();
  fees.forEach((f: any) => {
    map.set(f.lab_id, (map.get(f.lab_id) ?? 0) + Number(f.amount));
  });

  return Array.from(map.entries()).map(([lab_id, total]) => ({
    lab_id,
    lab_name: lm.get(lab_id) ?? '',
    total,
  }));
};

export const getLabFeesForMonth = (year: number, month: number) =>
  getLabFeesForRange(new Date(year, month - 1, 1), new Date(year, month, 1));

export const saveLabFeesForTransaction = async (
  transactionId: string,
  entries: { lab_id: string; amount: number }[]
): Promise<void> => {
  const supabase = getSupabaseClient();
  await supabase.from('transaction_lab_fees').delete().eq('transaction_id', transactionId);
  if (entries.length === 0) return;
  const rows = entries.map((e) => ({ transaction_id: transactionId, lab_id: e.lab_id, amount: e.amount }));
  const { error } = await supabase.from('transaction_lab_fees').insert(rows);
  if (error) throw error;
};
