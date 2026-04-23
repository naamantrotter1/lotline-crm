import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { loadAllDeals, loadArchivedDeals, saveDeal as syncSaveDeal, deleteDeal as syncDeleteDeal, archiveDeal as syncArchiveDeal, subscribeToDeals, lsKey } from './dealsSync';
import { useAuth } from './AuthContext';

const DealsContext = createContext(null);

export function DealsProvider({ children }) {
  // No LS hydration at render time — we need orgId first to pick the right key.
  // The org-specific LS data is loaded once orgId is available (see effect below).
  const [deals, setDeals] = useState([]);
  const [archivedDeals, setArchivedDeals] = useState([]);
  const [dealsLoading, setDealsLoading] = useState(true);

  const { session, activeOrgId, orgSlug } = useAuth();

  useEffect(() => {
    // Clear deals and restart whenever session or org changes (handles org-switch + logout)
    setDeals([]);
    setArchivedDeals([]);

    if (!session || !activeOrgId) {
      setDealsLoading(false);
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
    // Load active deals from Supabase (RLS already scopes to current org)
    loadAllDeals(activeOrgId).then(d => { setDeals(d); setDealsLoading(false); });
    // Load archived deals
    loadArchivedDeals(activeOrgId).then(setArchivedDeals);

    // ONE real-time subscription for the whole app
    const unsub = subscribeToDeals(
      (updated) => {
        if (updated.isArchived) {
          // Move to archived list
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
            return [...prev, updated];
          });
        }
      },
      (deletedId) => {
        setDeals(prev => prev.filter(d => String(d.id) !== deletedId));
        setArchivedDeals(prev => prev.filter(d => String(d.id) !== deletedId));
      }
    );

    return unsub;
  }, [session, activeOrgId]);

  // Bind orgId so callers don't need to pass it
  const saveDeal    = useCallback((deal)   => syncSaveDeal(deal, activeOrgId),    [activeOrgId]);
  const deleteDeal  = useCallback((id)     => syncDeleteDeal(id, activeOrgId),     [activeOrgId]);
  const archiveDeal = useCallback((deal)   => syncArchiveDeal(deal, activeOrgId),  [activeOrgId]);

  return (
    <DealsContext.Provider value={{ deals, setDeals, archivedDeals, setArchivedDeals, dealsLoading, saveDeal, deleteDeal, archiveDeal }}>
      {children}
    </DealsContext.Provider>
  );
}

export function useDeals() {
  return useContext(DealsContext);
}
