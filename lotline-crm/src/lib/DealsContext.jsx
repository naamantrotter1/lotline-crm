import { createContext, useContext, useState, useEffect } from 'react';
import { loadAllDeals, loadArchivedDeals, saveDeal as syncSaveDeal, deleteDeal as syncDeleteDeal, subscribeToDeals } from './dealsSync';
import { useAuth } from './AuthContext';

const DealsContext = createContext(null);

export function DealsProvider({ children }) {
  // Instantly populate from localStorage cache (will refresh from Supabase once authed)
  const [deals, setDeals] = useState(() => {
    try { return JSON.parse(localStorage.getItem('lotline_custom_deals') || '[]'); } catch { return []; }
  });
  const [archivedDeals, setArchivedDeals] = useState([]);

  const { session } = useAuth();

  useEffect(() => {
    // Only load from Supabase (and subscribe) when authenticated
    if (!session) {
      setDeals([]);
      setArchivedDeals([]);
      return;
    }

    // Load active deals from Supabase
    loadAllDeals().then(setDeals);
    // Load archived deals
    loadArchivedDeals().then(setArchivedDeals);

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
  }, [session]);

  return (
    <DealsContext.Provider value={{ deals, setDeals, archivedDeals, setArchivedDeals, saveDeal: syncSaveDeal, deleteDeal: syncDeleteDeal }}>
      {children}
    </DealsContext.Provider>
  );
}

export function useDeals() {
  return useContext(DealsContext);
}
