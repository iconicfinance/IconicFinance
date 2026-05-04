import React, { createContext, useContext, useState, useEffect } from 'react';
import { getSupabaseClient } from '@/lib/supabase';

export type UserRole = 'admin' | 'doctor' | 'assistant';

export interface UserProfile {
  id: string;
  username: string;
  full_name: string;
  role: UserRole;
  doctor_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = getSupabaseClient();

    // Check for existing session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        loadProfile(session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    // Keep session alive across tab changes / token refreshes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        // Re-check active status on token refresh
        loadProfile(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Internal: loads a profile and sets user state. Returns the profile or throws.
  const loadProfile = async (userId: string): Promise<UserProfile> => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) throw error;
    if (!data) throw new Error('User profile not found.');

    if (!data.is_active) {
      await supabase.auth.signOut();
      throw new Error('Account disabled. Contact your administrator.');
    }

    setUser(data);
    return data;
  };

  const login = async (username: string, password: string): Promise<void> => {
    const supabase = getSupabaseClient();
    const email = `${username}@iconicfinance.app`;

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) throw error;
    if (!data.user) throw new Error('Login failed. Please try again.');

    try {
      await loadProfile(data.user.id);
    } catch (profileError: any) {
      // Sign out of Supabase Auth if we can't load the profile
      await supabase.auth.signOut().catch(() => {});
      throw new Error(profileError.message || 'Could not load user profile. Contact your administrator.');
    }
  };

  const logout = async () => {
    const supabase = getSupabaseClient();
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, isAuthenticated: !!user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
