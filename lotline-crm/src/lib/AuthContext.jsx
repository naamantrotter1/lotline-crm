import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from './supabase';

const AuthContext = createContext(null);

// ── Impersonation context (operator "view as investor") ───────
export const ImpersonationContext = createContext({ impersonating: null, setImpersonating: () => {} });

export function AuthProvider({ children }) {
  const [session, setSession]         = useState(null);
  const [profile, setProfile]         = useState(null);
  const [orgSlug, setOrgSlug]         = useState(null); // slug of the active org (e.g. 'lotline-homes')
  const [investorRecord, setInvestorRecord] = useState(null); // { id, name, ... } for investor-role users
  const [loading, setLoading]         = useState(true);
  // Operator impersonation: { investor, logId }
  const [impersonating, setImpersonating] = useState(null);

  async function fetchProfile(userId) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (!error && data) {
        setProfile(data);
        localStorage.setItem('crm_user', JSON.stringify({ name: data.name, email: data.email, phone: data.phone || '' }));

        // Resolve the active org's slug (needed for org-scoped seeding + display)
        if (data.active_organization_id) {
          supabase
            .from('organizations')
            .select('slug')
            .eq('id', data.active_organization_id)
            .single()
            .then(({ data: org }) => setOrgSlug(org?.slug ?? null));
        } else {
          setOrgSlug(null);
        }

        // If investor role, resolve their linked investor record
        if (data.role === 'investor') {
          const { data: link } = await supabase
            .from('investor_users')
            .select('investor_id, investors(*)')
            .eq('user_id', userId)
            .single();
          setInvestorRecord(link?.investors ?? null);
        } else {
          setInvestorRecord(null);
        }
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
        if (_event === 'PASSWORD_RECOVERY') {
          // Don't log in — redirect to the reset-password page so user can set a new password
          if (window.location.pathname !== '/reset-password') {
            window.location.href = '/reset-password';
          }
          return;
        }
        setSession(session);
        if (session) {
          fetchProfile(session.user.id);
        } else {
          setProfile(null);
          setOrgSlug(null);
          setInvestorRecord(null);
          setImpersonating(null);
          localStorage.removeItem('crm_user');
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
        phone: updates.phone ?? profile?.phone ?? '',
      }));
    }
    return { error };
  };

  const refreshProfile = (userId) => fetchProfile(userId);

  return (
    <ImpersonationContext.Provider value={{ impersonating, setImpersonating }}>
      <AuthContext.Provider value={{
        session,
        profile,
        role: profile?.role ?? null,
        activeOrgId: profile?.active_organization_id ?? null,
        orgSlug,          // slug of the active org, e.g. 'lotline-homes'
        investorRecord,   // { id, name, ... } — only non-null for investor-role users
        loading,
        signIn,
        signOut,
        updateProfile,
        refreshProfile,
      }}>
        {children}
      </AuthContext.Provider>
    </ImpersonationContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export function useImpersonation() {
  return useContext(ImpersonationContext);
}
