import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { loadAllDeals, loadArchivedDeals, saveDeal as syncSaveDeal, deleteDeal as syncDeleteDeal, archiveDeal as syncArchiveDeal, subscribeToDeals, lsKey, removeFromLS } from './dealsSync';
import { fetchCostSummary } from './costBreakdownData';
import { fetchAllocationsForDeals } from './dealAllocationsClient';
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
  // Per-deal active allocations (status != 'returned', amount > 0).
  // Source of truth for "which investor(s) is on this deal" — replaces the
  // legacy deals.investor text field. Keyed by deal_id.
  const [allocationsByDealId, setAllocationsByDealId] = useState({});
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
    setAllocationsByDealId({});

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
    loadAllDeals(scopeIds).then(d => {
      setDeals(d);
      setDealsLoading(false);
      // Fetch active allocations for every loaded deal in one round-trip.
      // The result is merged onto the deal objects below via useMemo.
      const ids = d.map(x => x.id).filter(Boolean);
      if (ids.length > 0) {
        fetchAllocationsForDeals(ids).then(setAllocationsByDealId);
      }
    });
    // Load archived deals (own org only)
    loadArchivedDeals(activeOrgId).then(setArchivedDeals);

    // ONE real-time subscription for deal row changes
    const unsub = subscribeToDeals(
      (updated, eventType) => {
        if (updated.isArchived) {
          // Deal was archived by anyone — remove from ALL users' active views immediately.
          // Also clean LS so the stale entry doesn't re-surface on the next loadAllDeals.
          removeFromLS(updated.id, activeOrgId);
          setArchivedDeals(prev => {
            const idx = prev.findIndex(d => String(d.id) === String(updated.id));
            if (idx >= 0) { const next = [...prev]; next[idx] = updated; return next; }
            return [...prev, updated];
          });
          setDeals(prev => prev.filter(d => String(d.id) !== String(updated.id)));
        } else {
          setDeals(prev => {
            const idx = prev.findIndex(d => String(d.id) === String(updated.id));
            if (idx >= 0) {
              const existing = prev[idx];
              // Guard against a race condition where a realtime UPDATE event fires
              // before the close_date (or other date) write has committed to the DB.
              // payload.new.close_date can be null even if the user just saved a date —
              // the DB reflects the old value until the write transaction commits.
              // Using ?? preserves the existing non-null value in that window while
              // still allowing legitimate clears (null → null stays null).
              const merged = {
                ...updated,
                closeDate:    updated.closeDate    ?? existing.closeDate,
                contractDate: updated.contractDate ?? existing.contractDate,
                closingDate:  updated.closingDate  ?? existing.closingDate,
                deliveryDate: updated.deliveryDate ?? existing.deliveryDate,
                ddDeadline:   updated.ddDeadline   ?? existing.ddDeadline,
                appraisalDate: updated.appraisalDate ?? existing.appraisalDate,
                financingContingency: updated.financingContingency ?? existing.financingContingency,
                // Financing fields race the same way close_date did — a realtime
                // echo can carry a stale `null` value milliseconds after the
                // user has picked a new scenario but before the write commits.
                // ?? preserves the optimistic value the auto-save already set
                // on context, so the dropdown can't revert to "Cash" on echo.
                financingScenarioType: updated.financingScenarioType ?? existing.financingScenarioType,
                financing:             updated.financing             ?? existing.financing,
                scenarioData:          updated.scenarioData          ?? existing.scenarioData,
              };
              const next = [...prev]; next[idx] = merged; return next;
            }
            // Only add to active list for INSERT events (new deal created).
            // For UPDATE events, if the deal isn't already in active state, leave it out —
            // it may have been archived or hidden and we must not re-surface it.
            if (eventType === 'INSERT') return [...prev, updated];
            return prev;
          });
        }
      },
      (deletedId) => {
        removeFromLS(deletedId, activeOrgId);
        setDeals(prev => prev.filter(d => String(d.id) !== deletedId));
        setArchivedDeals(prev => prev.filter(d => String(d.id) !== deletedId));
      },
      {
        orgId: activeOrgId,
        onStatus: setRealtimeStatus,
        accessToken: session?.access_token,
      }
    );

    // Subscribe to deal_cost_lines changes so every page always reflects the
    // current canonical cost total without a full page reload.
    // On any INSERT/UPDATE/DELETE to deal_cost_lines, re-fetch the cost summary
    // for that deal and update deal.totalActual in state.
    let costChannel = null;
    if (supabase) {
      costChannel = supabase
        .channel(`deal-cost-lines-totals-${activeOrgId || 'anon'}`)
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

    // Subscribe to deal_allocations changes so the operator UI's "primary
    // investor" display refreshes the instant an allocation is added,
    // returned, or amount-updated. Re-fetches the affected deal's allocations.
    let allocChannel = null;
    if (supabase) {
      allocChannel = supabase
        .channel(`deal-allocations-${activeOrgId || 'anon'}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'deal_allocations' }, async (payload) => {
          const dealId = payload.new?.deal_id ?? payload.old?.deal_id;
          if (!dealId) return;
          const map = await fetchAllocationsForDeals([dealId]);
          setAllocationsByDealId(prev => ({ ...prev, [dealId]: map[dealId] ?? [] }));
        })
        .subscribe();
    }

    return () => {
      unsub();
      if (costChannel) supabase.removeChannel(costChannel);
      if (allocChannel) supabase.removeChannel(allocChannel);
    };
  }, [session?.user?.id, activeOrgId, jvLoaded, JSON.stringify(scopeIds)]);

  // Auto-promote deals past their close date to "Development"
  useEffect(() => {
    if (!deals.length || !activeOrgId) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const PRE_DEV = new Set(['Contract Signed', 'Due Diligence']);
    const toPromote = deals.filter(d =>
      PRE_DEV.has(d.stage) &&
      d.closeDate &&
      new Date(d.closeDate) < today
    );
    if (!toPromote.length) return;
    // Update state immediately
    setDeals(prev => prev.map(d =>
      toPromote.some(p => p.id === d.id) ? { ...d, stage: 'Development' } : d
    ));
    // Persist to DB / LS
    toPromote.forEach(d => syncSaveDeal({ ...d, stage: 'Development' }, activeOrgId));
  }, [deals.length, activeOrgId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Bind orgId so callers don't need to pass it
  const saveDeal    = useCallback((deal)   => syncSaveDeal(deal, activeOrgId),    [activeOrgId]);
  const deleteDeal  = useCallback((id)     => syncDeleteDeal(id, activeOrgId),     [activeOrgId]);
  const archiveDeal = useCallback((deal)   => syncArchiveDeal(deal, activeOrgId),  [activeOrgId]);

  // Merge allocations onto each deal so consumers can read deal.allocations
  // without doing their own fetch. This is the post-deals.investor source
  // of truth for "which investor(s) is on this deal".
  const dealsWithAllocations = useMemo(
    () => deals.map(d => ({ ...d, allocations: allocationsByDealId[d.id] ?? [] })),
    [deals, allocationsByDealId]
  );

  return (
    <DealsContext.Provider value={{ deals: dealsWithAllocations, setDeals, archivedDeals, setArchivedDeals, dealsLoading, realtimeStatus, saveDeal, deleteDeal, archiveDeal }}>
      {children}
    </DealsContext.Provider>
  );
}

export function useDeals() {
  return useContext(DealsContext);
}
