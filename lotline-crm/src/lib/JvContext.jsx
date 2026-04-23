/**
 * JvContext — Joint Venture scope state for the LotLine Homes CRM.
 *
 * Provides:
 *   isJvHub          — true only for LotLine Homes org
 *   activeJVs        — list of active JV partner orgs (with org info)
 *   jvScope          — { mode, selectedPartnerIds, includeOwn }
 *   setJvScope(opts) — updates scope + persists to jv_scope_preferences
 *   jvScopeOrgIds    — resolved org UUID array for the current scope (use in queries)
 *   jvPermissionsFor(orgId) — returns permissions JSONB for a specific partner org
 *   refreshJvs()     — re-fetches JV list (call after propose/accept/terminate)
 */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';
import { useAuth } from './AuthContext';

const JvContext = createContext(null);

export function JvProvider({ children }) {
  const { session, profile, activeOrgId, orgRole } = useAuth();

  const [isJvHub,   setIsJvHub]   = useState(false);
  const [activeJVs, setActiveJVs] = useState([]); // [{jv, partner_org}]
  const [jvScope,   setJvScopeState] = useState({
    mode:               'own_only',
    selectedPartnerIds: [],
    includeOwn:         true,
  });
  const [loaded, setLoaded] = useState(false);

  // ── Fetch active JVs + hub flag ──────────────────────────────────────────────
  const refreshJvs = useCallback(async () => {
    if (!activeOrgId || !session) return;

    // Check hub flag
    const { data: org } = await supabase
      .from('organizations')
      .select('is_jv_hub')
      .eq('id', activeOrgId)
      .single();

    const hub = !!org?.is_jv_hub;
    setIsJvHub(hub);

    if (!hub) {
      setActiveJVs([]);
      setLoaded(true);
      return;
    }

    // Fetch active JVs via the list API
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const res = await fetch('/api/jv/list', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { setActiveJVs([]); setLoaded(true); return; }
      const { jvs } = await res.json();
      const active = (jvs || []).filter(jv => jv.status === 'active');
      setActiveJVs(active);
    } catch {
      setActiveJVs([]);
    }

    setLoaded(true);
  }, [activeOrgId, session]);

  // ── Load scope preferences ───────────────────────────────────────────────────
  const loadScopePrefs = useCallback(async () => {
    if (!activeOrgId || !session?.user?.id) return;
    const { data } = await supabase
      .from('jv_scope_preferences')
      .select('*')
      .eq('user_id',       session.user.id)
      .eq('organization_id', activeOrgId)
      .maybeSingle();
    if (data) {
      setJvScopeState({
        mode:               data.scope_mode,
        selectedPartnerIds: data.selected_partner_ids || [],
        includeOwn:         data.include_own_data,
      });
    }
  }, [activeOrgId, session]);

  useEffect(() => {
    if (activeOrgId && session) {
      refreshJvs();
      loadScopePrefs();
    } else {
      setIsJvHub(false);
      setActiveJVs([]);
      setLoaded(false);
    }
  }, [activeOrgId, session, refreshJvs, loadScopePrefs]);

  // ── setJvScope — updates state + persists to DB ──────────────────────────────
  const setJvScope = useCallback(async (opts) => {
    const next = { ...jvScope, ...opts };
    setJvScopeState(next);

    if (!activeOrgId || !session?.user?.id) return;
    await supabase
      .from('jv_scope_preferences')
      .upsert({
        user_id:             session.user.id,
        organization_id:     activeOrgId,
        scope_mode:          next.mode,
        selected_partner_ids: next.selectedPartnerIds,
        include_own_data:    next.includeOwn,
        updated_at:          new Date().toISOString(),
      }, { onConflict: 'user_id,organization_id' });
  }, [jvScope, activeOrgId, session]);

  // ── Resolve org IDs in scope ─────────────────────────────────────────────────
  const partnerOrgIds = activeJVs.map(jv => jv.partner_organization_id);

  const jvScopeOrgIds = (() => {
    if (!isJvHub || activeJVs.length === 0) return [activeOrgId].filter(Boolean);
    const { mode, selectedPartnerIds, includeOwn } = jvScope;
    switch (mode) {
      case 'own_only':
        return [activeOrgId];
      case 'single_partner':
        return [
          ...(includeOwn ? [activeOrgId] : []),
          ...(selectedPartnerIds.length ? [selectedPartnerIds[0]] : []),
        ];
      case 'multi_partner':
        return [
          ...(includeOwn ? [activeOrgId] : []),
          ...selectedPartnerIds,
        ];
      case 'all_partners_combined':
        return [activeOrgId, ...partnerOrgIds];
      case 'all_partners_excluding_own':
        return partnerOrgIds;
      default:
        return [activeOrgId];
    }
  })();

  // ── Helper: permissions for a specific partner org ───────────────────────────
  const jvPermissionsFor = useCallback((orgId) => {
    const jv = activeJVs.find(j => j.partner_organization_id === orgId);
    return jv?.permissions_on_partner ?? null;
  }, [activeJVs]);

  const jvCanOnPartner = useCallback((partnerOrgId, action) => {
    const perms = jvPermissionsFor(partnerOrgId);
    return perms ? !!perms[action] : false;
  }, [jvPermissionsFor]);

  return (
    <JvContext.Provider value={{
      isJvHub,
      activeJVs,
      jvScope,
      setJvScope,
      jvScopeOrgIds,
      jvScopeIsMultiOrg: jvScopeOrgIds.length > 1,
      jvPermissionsFor,
      jvCanOnPartner,
      refreshJvs,
      jvLoaded: loaded,
    }}>
      {children}
    </JvContext.Provider>
  );
}

export function useJv() {
  return useContext(JvContext);
}
