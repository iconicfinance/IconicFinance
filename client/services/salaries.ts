import { getSupabaseClient } from '@/lib/supabase';

export interface Salary {
  id: string;
  month: number;
  year: number;
  person_name: string;
  amount: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const getSalariesForMonth = async (year: number, month: number): Promise<Salary[]> => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('salaries')
    .select('*')
    .eq('year', year)
    .eq('month', month)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
};

export const createSalary = async (data: {
  month: number;
  year: number;
  person_name: string;
  amount: number;
  notes?: string | null;
  created_by: string;
}): Promise<Salary> => {
  const supabase = getSupabaseClient();
  const { data: result, error } = await supabase
    .from('salaries')
    .insert([data])
    .select()
    .single();

  if (error) throw error;
  return result;
};

export const updateSalary = async (
  id: string,
  updates: Partial<Pick<Salary, 'person_name' | 'amount' | 'notes'>>
): Promise<Salary> => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('salaries')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const deleteSalary = async (id: string): Promise<void> => {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('salaries').delete().eq('id', id);
  if (error) throw error;
};
