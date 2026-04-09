const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

async function apiFetch(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

function qs(params) {
  const p = Object.entries(params || {})
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  return p.length ? '?' + p.join('&') : '';
}

// ─── Counties ──────────────────────────────────────────────────────────────
export const api = {
  counties: {
    list:  (params) => apiFetch(`/api/counties${qs(params)}`),
    get:   (fips)   => apiFetch(`/api/counties/${fips}`),
    trend: (fips, params) => apiFetch(`/api/counties/${fips}/trend${qs(params)}`),
  },

  listings: {
    list: (params) => apiFetch(`/api/listings${qs(params)}`),
    get:  (id)     => apiFetch(`/api/listings/${id}`),
  },

  comps: {
    list:    (params) => apiFetch(`/api/comps${qs(params)}`),
    summary: (params) => apiFetch(`/api/comps/summary${qs(params)}`),
  },

  deals: {
    list:   (params)       => apiFetch(`/api/deals${qs(params)}`),
    get:    (id)           => apiFetch(`/api/deals/${id}`),
    create: (body)         => apiFetch('/api/deals', { method: 'POST', body: JSON.stringify(body) }),
    update: (id, body)     => apiFetch(`/api/deals/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  },

  stats: {
    counties:   (params) => apiFetch(`/api/stats/counties${qs(params)}`),
    topMarkets: (params) => apiFetch(`/api/stats/top-markets${qs(params)}`),
    overview:   (params) => apiFetch(`/api/stats/overview${qs(params)}`),
  },

  reports: {
    county:      (fips, params) => apiFetch(`/api/reports/county/${fips}${qs(params)}`),
    bestMarkets: (params)       => apiFetch(`/api/reports/best-markets${qs(params)}`),
  },

  zipStats: {
    list: (params) => apiFetch(`/api/zip-stats${qs(params)}`),
  },
};

export default api;
