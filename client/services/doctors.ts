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

export interface DoctorTypeInfo {
  type: string;
  custom_label?: string | null;
  custom_percentage?: number | null;
}

// Canonical label for a doctor's type, used everywhere a doctor's type is shown —
// custom doctors always show "Custom" plus whatever label was set for them.
export const getDoctorTypeLabel = (d: DoctorTypeInfo): string => {
  if (d.type === 'primary') return 'Primary';
  if (d.type === 'extern') return 'Extern (40%)';
  if (d.type === 'custom') return d.custom_label ? `Custom — ${d.custom_label}` : `Custom (${d.custom_percentage ?? 0}%)`;
  return d.type;
};

export interface DoctorNameInfo {
  name: string;
  type: string;
  custom_label?: string | null;
}

// Canonical doctor display name, used everywhere a doctor's name is shown —
// custom doctors show their custom label in brackets so same-named custom
// doctors (e.g. one doctor with two different custom rates) stay distinguishable.
export const getDoctorDisplayName = (d: DoctorNameInfo): string =>
  d.type === 'custom' && d.custom_label ? `${d.name} (${d.custom_label})` : d.name;

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
