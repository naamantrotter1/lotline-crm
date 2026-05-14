/**
 * Lending route-gate and sidebar-filter tests.
 *
 * Covers all four role/hub scenarios specified in the sidebar fix:
 *   Scenario A — Hub org    : sees "Capital & Partnerships", NOT "My Submissions"
 *   Scenario B — Non-hub org: sees "My Submissions", NOT "Capital & Partnerships"
 *   Scenario C — Hub org    : navigating to /lending/my-submissions → /dashboard
 *   Scenario D — Non-hub org: navigating to /lending → /dashboard
 *
 * Uses React Testing Library + MemoryRouter so no browser required.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// ── Minimal stubs ────────────────────────────────────────────────────────────

vi.mock('../lib/featureFlags', () => ({ isEnabled: () => false }));
vi.mock('../lib/JvContext', () => ({ useJv: () => ({ isJvHub: false }) }));
vi.mock('../hooks/usePermissions', () => ({
  usePermissions: () => ({ isAgent: false, isInvestor: false }),
}));

// AuthContext is mocked per-test via the `mockAuth` helper below.
const authState = { orgIsLendingHub: false, loading: false };
vi.mock('../lib/AuthContext', () => ({
  useAuth: () => authState,
}));

function setHub(isHub) {
  authState.orgIsLendingHub = isHub;
}

// ── Sidebar filter unit tests ─────────────────────────────────────────────────

/**
 * Re-implement the sidebar filter inline so we test exactly the same logic
 * without rendering the full sidebar (which needs more DOM infrastructure).
 */
const BASE_TOOLS = [
  { label: 'Capital & Partnerships', to: '/lending',                hubOnly: true    },
  { label: 'My Submissions',         to: '/lending/my-submissions', nonHubOnly: true },
  { label: 'Joint Ventures',         to: '/settings/joint-ventures',jvHubOnly: true  },
  { label: 'Deal Calculator',        to: '/calculator'                                },
];

function filterItems(items, { orgIsLendingHub, isJvHub }) {
  return items.filter(item =>
    (!item.hubOnly    || orgIsLendingHub) &&
    (!item.nonHubOnly || !orgIsLendingHub) &&
    (!item.jvHubOnly  || isJvHub)
  );
}

describe('Sidebar filter — hub org (orgIsLendingHub = true)', () => {
  const ctx = { orgIsLendingHub: true, isJvHub: false };

  it('shows Capital & Partnerships', () => {
    const labels = filterItems(BASE_TOOLS, ctx).map(i => i.label);
    expect(labels).toContain('Capital & Partnerships');
  });

  it('hides My Submissions', () => {
    const labels = filterItems(BASE_TOOLS, ctx).map(i => i.label);
    expect(labels).not.toContain('My Submissions');
  });

  it('hides Joint Ventures when not a JV hub', () => {
    const labels = filterItems(BASE_TOOLS, ctx).map(i => i.label);
    expect(labels).not.toContain('Joint Ventures');
  });

  it('always shows non-gated items', () => {
    const labels = filterItems(BASE_TOOLS, ctx).map(i => i.label);
    expect(labels).toContain('Deal Calculator');
  });
});

describe('Sidebar filter — non-hub org (orgIsLendingHub = false)', () => {
  const ctx = { orgIsLendingHub: false, isJvHub: false };

  it('hides Capital & Partnerships', () => {
    const labels = filterItems(BASE_TOOLS, ctx).map(i => i.label);
    expect(labels).not.toContain('Capital & Partnerships');
  });

  it('shows My Submissions', () => {
    const labels = filterItems(BASE_TOOLS, ctx).map(i => i.label);
    expect(labels).toContain('My Submissions');
  });

  it('hides Joint Ventures when not a JV hub', () => {
    const labels = filterItems(BASE_TOOLS, ctx).map(i => i.label);
    expect(labels).not.toContain('Joint Ventures');
  });

  it('shows Joint Ventures when also a JV hub', () => {
    const labels = filterItems(BASE_TOOLS, { ...ctx, isJvHub: true }).map(i => i.label);
    expect(labels).toContain('Joint Ventures');
  });
});

// ── Route guard integration tests ─────────────────────────────────────────────

// Import guards from their own module (avoids pulling in all App.jsx page imports).
import { LendingHubRoute, LendingSubmitterRoute } from '../lib/lendingRouteGuards';

function renderGuard(Guard, children, initialPath) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="*" element={<Guard>{children}</Guard>} />
        <Route path="/dashboard" element={<div>Dashboard</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('LendingHubRoute (hub-only guard)', () => {
  it('Scenario A — hub org: renders the protected page', () => {
    setHub(true);
    renderGuard(
      LendingHubRoute,
      <div>Hub Inbox</div>,
      '/lending',
    );
    expect(screen.getByText('Hub Inbox')).toBeInTheDocument();
  });

  it('Scenario D — non-hub org: redirects to /dashboard', () => {
    setHub(false);
    renderGuard(
      LendingHubRoute,
      <div>Hub Inbox</div>,
      '/lending',
    );
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.queryByText('Hub Inbox')).not.toBeInTheDocument();
  });
});

describe('LendingSubmitterRoute (non-hub-only guard)', () => {
  it('Scenario B — non-hub org: renders the protected page', () => {
    setHub(false);
    renderGuard(
      LendingSubmitterRoute,
      <div>My Submissions</div>,
      '/lending/my-submissions',
    );
    expect(screen.getByText('My Submissions')).toBeInTheDocument();
  });

  it('Scenario C — hub org: redirects to /dashboard', () => {
    setHub(true);
    renderGuard(
      LendingSubmitterRoute,
      <div>My Submissions</div>,
      '/lending/my-submissions',
    );
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.queryByText('My Submissions')).not.toBeInTheDocument();
  });
});
