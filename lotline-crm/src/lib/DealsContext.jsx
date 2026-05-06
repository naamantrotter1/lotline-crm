import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { loadAllDeals, loadArchivedDeals, saveDeal as syncSaveDeal, deleteDeal as syncDeleteDeal, archiveDeal as syncArchiveDeal, subscribeToDeals, lsKey } from './dealsSync';
import { fetchCostSummary } from './costBreakdownData';
import { supabase } from './supabase';
import { useAuth } from './AuthContext';
import { useJv } from './JvContext';
import { runLocalStorageMigration } from './lsMigration';

const DealsContext = createContext(null);

export function DealsProvider({ children }) {
  // No LS hydration at render time — we need orgId first to pick the right key.
  // The org-specific LS data is loaded once orgId is available (see effect below).
  const [deals, setDeals] = useState([]);
  const [archivedDeals, setArchivedDeals] = useState([]);
  const [dealsLoading, setDealsLoading] = useState(true);
  // 'connecting' | 'live' | 'error' | 'closed' | 'offline'
  const [realtimeStatus, setRealtimeStatus] = useState('connecting');

  const { session, activeOrgId, orgSlug } = useAuth();
  const { jvScopeOrgIds, jvLoaded } = useJv();

  // The org IDs to query — uses JV scope when hub has partners selected, else own org only
  const scopeIds = jvScopeOrgIds?.length > 0 ? jvScopeOrgIds : (activeOrgId ? [activeOrgId] : []);

  // On login, clear any stale workaround keys that are no longer needed
  useEffect(() => {
    if (!session?.user?.id) return;
    Object.keys(localStorage)
      .filter(k => k.startsWith('lotline_deleted_deal_ids_'))
      .forEach(k => localStorage.removeItem(k));
  }, [session?.user?.id]);

  // One-time localStorage → Supabase migration
  useEffect(() => {
    if (session && activeOrgId) runLocalStorageMigration(activeOrgId);
  }, [session?.user?.id, activeOrgId]);

  useEffect(() => {
    // Clear deals and restart whenever the logged-in user, org, or JV scope changes.
    // Deliberately depends on session?.user?.id (a stable primitive) rather than the
    // full session object — the session reference changes on every TOKEN_REFRESHED event
    // (~hourly) which would otherwise cause loadAllDeals to re-run and re-surface deals
    // that were optimistically removed from state (but still is_archived=false in DB).
    setDeals([]);
    setArchivedDeals([]);

    if (!session?.user?.id || !activeOrgId || !jvLoaded) {
      setDealsLoading(false);
      setRealtimeStatus('offline');
      return;
    }

    // Seed static deals into localStorage for LotLine only (never for other tenants)
    if (orgSlug === 'lotline-homes') {
      import('../utils/seedDeals').then(({ seedDeals, migrateContractSignedAt }) => {
        seedDeals(activeOrgId);
        migrateContractSignedAt(activeOrgId);
      });
    }

    // Hydrate from org-specific localStorage immediately for zero-flash rendering
    try {
      const cached = JSON.parse(localStorage.getItem(lsKey(activeOrgId)) || '[]');
      if (cached.length > 0) setDeals(cached);
    } catch {}

    setDealsLoading(true);
    // Load active deals — pass all scoped org IDs so JV partner deals are included
    loadAllDeals(scopeIds).then(d => { setDeals(d); setDealsLoading(false); });
    // Load archived deals (own org only)
    loadArchivedDeals(activeOrgId).then(setArchivedDeals);

    // ONE real-time subscription for deal row changes
    const unsub = subscribeToDeals(
      (updated, eventType) => {
        if (updated.isArchived) {
          // Deal was archived by anyone — remove from ALL users' active views immediately
          setArchivedDeals(prev => {
            const idx = prev.findIndex(d => String(d.id) === String(updated.id));
            if (idx >= 0) { const next = [...prev]; next[idx] = updated; return next; }
            return [...prev, updated];
          });
          setDeals(prev => prev.filter(d => String(d.id) !== String(updated.id)));
        } else {
          setDeals(prev => {
            const idx = prev.findIndex(d => String(d.id) === String(updated.id));
            if (idx >= 0) { const next = [...prev]; next[idx] = updated; return next; }
            // Only add to active list for INSERT events (new deal created).
            // For UPDATE events, if the deal isn't already in active state, leave it out —
            // it may have been archived or hidden and we must not re-surface it.
            if (eventType === 'INSERT') return [...prev, updated];
            return prev;
          });
        }
      },
      (deletedId) => {
        setDeals(prev => prev.filter(d => String(d.id) !== deletedId));
        setArchivedDeals(prev => prev.filter(d => String(d.id) !== deletedId));
      },
      {
        orgId: activeOrgId,
        onStatus: setRealtimeStatus,
      }
    );

    // Subscribe to deal_cost_lines changes so every page always reflects the
    // current canonical cost total without a full page reload.
    // On any INSERT/UPDATE/DELETE to deal_cost_lines, re-fetch the cost summary
    // for that deal and update deal.totalActual in state.
    let costChannel = null;
    if (supabase) {
      costChannel = supabase
        .channel('deal-cost-lines-totals')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'deal_cost_lines' }, async (payload) => {
          const dealId = payload.new?.deal_id ?? payload.old?.deal_id;
          if (!dealId) return;
          const summary = await fetchCostSummary(dealId);
          if (!summary) return;
          const totalActual    = Number(summary.total_actual    ?? 0);
          const totalEstimated = Number(summary.total_estimated ?? 0);
          setDeals(prev => prev.map(d =>
            String(d.id) === String(dealId)
              ? { ...d, totalActual, totalEstimated }
              : d
          ));
        })
        .subscribe();
    }

    return () => {
      unsub();
      if (costChannel) supabase.removeChannel(costChannel);
    };
  }, [session?.user?.id, activeOrgId, jvLoaded, JSON.stringify(scopeIds)]);

  // Bind orgId so callers don't need to pass it
  const saveDeal    = useCallback((deal)   => syncSaveDeal(deal, activeOrgId),    [activeOrgId]);
  const deleteDeal  = useCallback((id)     => syncDeleteDeal(id, activeOrgId),     [activeOrgId]);
  const archiveDeal = useCallback((deal)   => syncArchiveDeal(deal, activeOrgId),  [activeOrgId]);

  return (
    <DealsContext.Provider value={{ deals, setDeals, archivedDeals, setArchivedDeals, dealsLoading, realtimeStatus, saveDeal, deleteDeal, archiveDeal }}>
      {children}
    </DealsContext.Provider>
  );
}

export function useDeals() {
  return useContext(DealsContext);
}
