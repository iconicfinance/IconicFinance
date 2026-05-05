import { getSupabaseClient } from '@/lib/supabase';

export interface Lab {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export const getAllLabs = async (): Promise<Lab[]> => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('labs')
    .select('*')
    .order('name');
  if (error) throw error;
  return data || [];
};

export const getActiveLabs = async (): Promise<Lab[]> => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('labs')
    .select('*')
    .eq('is_active', true)
    .order('name');
  if (error) throw error;
  return data || [];
};

export const createLab = async (name: string): Promise<Lab> => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('labs')
    .insert([{ name }])
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const updateLab = async (id: string, updates: { name?: string; is_active?: boolean }): Promise<Lab> => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('labs')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const deleteLab = async (id: string): Promise<void> => {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('labs').delete().eq('id', id);
  if (error) throw error;
};
