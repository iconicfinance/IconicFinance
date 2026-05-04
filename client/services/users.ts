import { getSupabaseClient } from '@/lib/supabase';

export interface User {
  id: string;
  username: string;
  full_name: string;
  role: 'admin' | 'doctor' | 'assistant';
  doctor_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const getAllUsers = async (): Promise<User[]> => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

export const getUserById = async (id: string): Promise<User | null> => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data || null;
};

export const getUserByUsername = async (username: string): Promise<User | null> => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('username', username)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data || null;
};

export const createUser = async (data: {
  username: string;
  full_name: string;
  password: string;
  role: 'admin' | 'doctor' | 'assistant';
  doctor_id: string | null;
}): Promise<User> => {
  const response = await fetch('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || 'Failed to create user');
  }

  return result as User;
};

export const updateUser = async (
  id: string,
  updates: Partial<Omit<User, 'id' | 'created_at' | 'updated_at'>>
): Promise<User> => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const deactivateUser = async (id: string): Promise<User> => {
  return updateUser(id, { is_active: false });
};
