import { getSupabaseClient } from '@/lib/supabase';

export interface Doctor {
  id: string;
  name: string;
  type: 'primary' | 'extern' | 'custom';
  custom_percentage: number | null;
  custom_label: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const getAllDoctors = async (): Promise<Doctor[]> => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('doctors')
    .select('*')
    .order('name');

  if (error) throw error;
  return data || [];
};

export const getActiveDoctors = async (): Promise<Doctor[]> => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('doctors')
    .select('*')
    .eq('is_active', true)
    .order('name');

  if (error) throw error;
  return data || [];
};

export const getDoctorById = async (id: string): Promise<Doctor | null> => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('doctors')
    .select('*')
    .eq('id', id)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data || null;
};

export const createDoctor = async (data: Omit<Doctor, 'id' | 'created_at' | 'updated_at'>): Promise<Doctor> => {
  const supabase = getSupabaseClient();
  const { data: result, error } = await supabase
    .from('doctors')
    .insert([data])
    .select()
    .single();

  if (error) throw error;
  return result;
};

export const updateDoctor = async (id: string, updates: Partial<Omit<Doctor, 'id' | 'created_at' | 'updated_at'>>): Promise<Doctor> => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('doctors')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const deactivateDoctor = async (id: string): Promise<Doctor> => {
  return updateDoctor(id, { is_active: false });
};
