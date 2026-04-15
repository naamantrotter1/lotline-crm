import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from './supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession]   = useState(null);
  const [profile, setProfile]   = useState(null);
  const [loading, setLoading]   = useState(true);

  async function fetchProfile(userId) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (!error && data) {
        setProfile(data);
        // Update crm_user so Homes iframe pre-fill still works
        localStorage.setItem('crm_user', JSON.stringify({ name: data.name, email: data.email }));
      }
    } catch {
      // profile fetch failed — user still logged in, just no role data yet
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Hydrate from current session immediately (prevents flash on page reload)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else setLoading(false);
    });

    // Subscribe to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        if (session) {
          fetchProfile(session.user.id);
        } else {
          setProfile(null);
          localStorage.removeItem('crm_user');
          // Clear cached deals on logout so next user starts fresh
          localStorage.removeItem('lotline_custom_deals');
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signIn = (email, password) =>
    supabase.auth.signInWithPassword({ email, password });

  const signOut = () => supabase.auth.signOut();

  const updateProfile = async (updates) => {
    if (!session?.user?.id) return { error: 'Not logged in' };
    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', session.user.id);
    if (!error) {
      setProfile(prev => ({ ...prev, ...updates }));
      localStorage.setItem('crm_user', JSON.stringify({
        name: updates.name ?? profile?.name,
        email: profile?.email,
      }));
    }
    return { error };
  };

  const refreshProfile = (userId) => fetchProfile(userId);

  return (
    <AuthContext.Provider value={{
      session,
      profile,
      role: profile?.role ?? null,
      loading,
      signIn,
      signOut,
      updateProfile,
      refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
