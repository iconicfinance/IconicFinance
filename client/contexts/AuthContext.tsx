import {
  createContext,
  useContext,
  useState,
  useEffect,
  type FC,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
} from 'react';
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

export const AuthProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let initialized = false;
    let mounted = true;

    const finishLoading = () => {
      if (!initialized && mounted) {
        initialized = true;
        setLoading(false);
      }
    };

    // Safety net: if auth state never resolves (offline / network failure),
    // force loading=false after 6 seconds so the user isn't stuck on a blank screen.
    const safetyTimeout = setTimeout(() => {
      if (mounted) {
        setUser(null);
        finishLoading();
      }
    }, 6000);

    let supabase: ReturnType<typeof getSupabaseClient>;
    try {
      supabase = getSupabaseClient();
    } catch {
      // Supabase not configured — clear loading immediately
      clearTimeout(safetyTimeout);
      setUser(null);
      setLoading(false);
      return;
    }

    // Use onAuthStateChange as the single source of truth.
    // In Supabase v2 this fires immediately with INITIAL_SESSION on mount,
    // so we don't need a separate getSession() call.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        try {
          if (session?.user && event !== 'SIGNED_OUT' && event !== 'USER_DELETED') {
            await loadProfile(session.user.id, supabase, mounted, setUser);
          } else {
            if (mounted) setUser(null);
          }
        } catch {
          if (mounted) setUser(null);
        }

        // Mark loading done after the very first event (INITIAL_SESSION).
        // Subsequent events (TOKEN_REFRESHED, SIGNED_OUT) don't change loading.
        clearTimeout(safetyTimeout);
        finishLoading();
      }
    );

    return () => {
      mounted = false;
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
    };
  }, []);

  const login = async (username: string, password: string): Promise<void> => {
    const supabase = getSupabaseClient();
    const email = `${username}@iconicfinance.app`;

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) throw error;
    if (!data.user) throw new Error('Login failed. Please try again.');

    try {
      await loadProfile(data.user.id, supabase, true, setUser);
    } catch (profileError: any) {
      await supabase.auth.signOut().catch(() => {});
      throw new Error(profileError.message || 'Could not load user profile. Contact your administrator.');
    }
  };

  const logout = async () => {
    const supabase = getSupabaseClient();
    setUser(null);
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, loading, isAuthenticated: !!user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

async function loadProfile(
  userId: string,
  supabase: ReturnType<typeof getSupabaseClient>,
  mounted: boolean,
  setUser: Dispatch<SetStateAction<UserProfile | null>>
): Promise<UserProfile> {
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

  if (mounted) setUser(data);
  return data;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
