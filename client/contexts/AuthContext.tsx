import {
  createContext,
  useContext,
  useState,
  useEffect,
  type FC,
  type ReactNode,
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

// ── Local-storage profile cache ───────────────────────────────────────────────
// Keeps a copy of the user profile so on refresh we can show the app instantly
// without waiting for a Supabase DB round-trip (which can be slow on mobile).

const PROFILE_KEY = 'iconic_user';
const ACTIVE_KEY  = 'iconic_last_active';
const INACTIVITY_MS = 2 * 60 * 60 * 1000; // 2 hours

const saveCache = (p: UserProfile) => {
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); } catch {}
};
const loadCache = (uid: string): UserProfile | null => {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    const p: UserProfile = JSON.parse(raw);
    return p.id === uid ? p : null;
  } catch { return null; }
};
const clearCache = () => {
  try {
    localStorage.removeItem(PROFILE_KEY);
    localStorage.removeItem(ACTIVE_KEY);
  } catch {}
};
const touchActive = () => {
  try { localStorage.setItem(ACTIVE_KEY, Date.now().toString()); } catch {}
};
const isInactive = (): boolean => {
  try {
    const t = localStorage.getItem(ACTIVE_KEY);
    if (!t) return false; // first-ever load → don't expire
    return Date.now() - Number(t) > INACTIVITY_MS;
  } catch { return false; }
};

// ── Profile fetcher ───────────────────────────────────────────────────────────

async function fetchProfile(
  userId: string,
  supabase: ReturnType<typeof getSupabaseClient>
): Promise<UserProfile> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) throw error;
  if (!data) throw new Error('User profile not found.');

  if (!data.is_active) {
    await supabase.auth.signOut().catch(() => {});
    const err = new Error('Account disabled. Contact your administrator.');
    (err as any).isBusinessError = true;
    throw err;
  }

  return data as UserProfile;
}

// ── Context ───────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    let supabase: ReturnType<typeof getSupabaseClient>;
    try {
      supabase = getSupabaseClient();
    } catch {
      setUser(null);
      setLoading(false);
      return;
    }

    // ── Phase 1: read session from localStorage (no network) ─────────────────
    supabase.auth.getSession()
      .then(async ({ data: { session } }) => {
        if (!mounted) return;

        if (!session?.user) {
          clearCache();
          setUser(null);
          setLoading(false);
          return;
        }

        // 2-hour inactivity check
        if (isInactive()) {
          clearCache();
          await supabase.auth.signOut().catch(() => {});
          setUser(null);
          setLoading(false);
          return;
        }

        touchActive();

        // ── Fast path: use cached profile → instant, zero network ──
        const cached = loadCache(session.user.id);
        if (cached) {
          if (mounted) {
            setUser(cached);
            setLoading(false);
          }
          // Silently refresh from DB in background; failure is OK
          fetchProfile(session.user.id, supabase)
            .then(fresh => { saveCache(fresh); if (mounted) setUser(fresh); })
            .catch(() => {});
          return;
        }

        // ── Slow path: no cache (e.g. just cleared), must wait for DB ──
        try {
          const profile = await fetchProfile(session.user.id, supabase);
          saveCache(profile);
          if (mounted) setUser(profile);
        } catch (err: any) {
          if (mounted) {
            // Only clear auth for real business errors, NOT network failures.
            // Network failures leave user null → login page, but don't sign out
            // the Supabase session so next reload can try the fast path again.
            if (!(err as any).isBusinessError) clearCache();
            setUser(null);
          }
        }

        if (mounted) setLoading(false);
      })
      .catch(() => {
        if (mounted) { setUser(null); setLoading(false); }
      });

    // ── Phase 2: listen for subsequent auth changes ───────────────────────────
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        if (event === 'INITIAL_SESSION') return; // handled in Phase 1

        if (event === 'SIGNED_OUT' || event === 'USER_DELETED' || !session?.user) {
          clearCache();
          setUser(null);
          setLoading(false);
          return;
        }

        if (event === 'TOKEN_REFRESHED') {
          touchActive();
          fetchProfile(session.user.id, supabase)
            .then(fresh => { saveCache(fresh); if (mounted) setUser(fresh); })
            .catch(() => { /* keep showing cached user */ });
        }
      }
    );

    // Track activity for inactivity timeout
    const onActivity = () => touchActive();
    window.addEventListener('click', onActivity, { passive: true });
    window.addEventListener('keydown', onActivity, { passive: true });
    window.addEventListener('touchstart', onActivity, { passive: true });

    return () => {
      mounted = false;
      subscription.unsubscribe();
      window.removeEventListener('click', onActivity);
      window.removeEventListener('keydown', onActivity);
      window.removeEventListener('touchstart', onActivity);
    };
  }, []);

  const login = async (username: string, password: string): Promise<void> => {
    const supabase = getSupabaseClient();
    const email = `${username}@iconicfinance.app`;

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (!data.user) throw new Error('Login failed. Please try again.');

    try {
      const profile = await fetchProfile(data.user.id, supabase);
      saveCache(profile);
      touchActive();
      setUser(profile);
    } catch (profileError: any) {
      await supabase.auth.signOut().catch(() => {});
      throw new Error(profileError.message || 'Could not load user profile. Contact your administrator.');
    }
  };

  const logout = async () => {
    const supabase = getSupabaseClient();
    clearCache();
    setUser(null);
    await supabase.auth.signOut();
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
