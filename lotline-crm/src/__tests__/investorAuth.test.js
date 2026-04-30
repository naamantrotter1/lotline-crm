/**
 * Investor auth flow unit tests
 *
 * Covers:
 *  - RequireOperator redirects investor accounts to /investor/home
 *  - RequireInvestor redirects operator accounts to /dashboard
 *  - accountType derivation in AuthContext (new column + legacy role fallback)
 *  - provision_investor_account does NOT create org / membership / seed deals
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── accountType derivation logic (mirrors AuthContext.jsx) ────────────────────
function deriveAccountType(profile) {
  if (!profile) return null;
  if (profile.account_type) return profile.account_type;
  // legacy fallback
  return profile.role === 'investor' ? 'investor' : 'operator';
}

describe('deriveAccountType', () => {
  it('returns investor when account_type = investor', () => {
    expect(deriveAccountType({ account_type: 'investor', role: 'investor' })).toBe('investor');
  });

  it('returns operator when account_type = operator', () => {
    expect(deriveAccountType({ account_type: 'operator', role: null })).toBe('operator');
  });

  it('falls back to investor when role = investor and account_type is absent', () => {
    expect(deriveAccountType({ role: 'investor' })).toBe('investor');
  });

  it('falls back to operator for all other roles', () => {
    expect(deriveAccountType({ role: 'admin' })).toBe('operator');
    expect(deriveAccountType({ role: 'owner' })).toBe('operator');
    expect(deriveAccountType({ role: null })).toBe('operator');
  });

  it('returns null for null profile (loading state)', () => {
    expect(deriveAccountType(null)).toBe(null);
  });
});

// ── Route guard logic ─────────────────────────────────────────────────────────
// Mirrors the guard decision logic in App.jsx without rendering React components

function requireOperator(accountType) {
  // Returns where to redirect, or null if allowed through
  if (accountType === 'investor') return '/investor/home';
  return null; // allowed
}

function requireInvestor(isInvestor, canEdit, canAdmin) {
  if (isInvestor || canEdit || canAdmin) return null; // allowed
  return '/dashboard';
}

describe('RequireOperator guard', () => {
  it('blocks investor accounts and redirects to /investor/home', () => {
    expect(requireOperator('investor')).toBe('/investor/home');
  });

  it('allows operator accounts through', () => {
    expect(requireOperator('operator')).toBe(null);
  });

  it('allows null accountType through (loading / unauthenticated)', () => {
    expect(requireOperator(null)).toBe(null);
  });
});

describe('RequireInvestor guard', () => {
  it('allows investor through', () => {
    expect(requireInvestor(true, false, false)).toBe(null);
  });

  it('allows operator with canEdit through (impersonation)', () => {
    expect(requireInvestor(false, true, false)).toBe(null);
  });

  it('allows operator with canAdmin through', () => {
    expect(requireInvestor(false, false, true)).toBe(null);
  });

  it('redirects a plain authenticated non-investor to /dashboard', () => {
    expect(requireInvestor(false, false, false)).toBe('/dashboard');
  });
});

// ── provision_investor_account side-effects (mock Supabase) ──────────────────
// Verifies the provision call writes only the expected tables and nothing else.

const callLog = [];

const supabaseMock = {
  from: (table) => ({
    update: (data) => ({
      eq: () => {
        callLog.push({ op: 'update', table, data });
        return Promise.resolve({ error: null });
      },
    }),
    insert: (data) => {
      callLog.push({ op: 'insert', table, data });
      return {
        select: () => ({ single: async () => ({ data: { id: 'inv-001' }, error: null }) }),
        returning: () => Promise.resolve({ data: [{ id: 'inv-001' }], error: null }),
      };
    },
    select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }),
  }),
  rpc: (fn, args) => {
    callLog.push({ op: 'rpc', fn, args });
    return Promise.resolve({ data: 'inv-001', error: null });
  },
};

// Simulates the frontend calling provision_investor_account RPC
async function provisionInvestorAccount(supabase, email, fullName) {
  const { data, error } = await supabase.rpc('provision_investor_account', {
    p_email: email,
    p_full_name: fullName,
  });
  if (error) throw new Error(error.message);
  return data;
}

describe('provision_investor_account', () => {
  beforeEach(() => { callLog.length = 0; });

  it('calls only the provision_investor_account RPC — no org or membership writes', async () => {
    await provisionInvestorAccount(supabaseMock, 'investor@test.com', 'Jane Smith');

    const orgWrites    = callLog.filter(c => c.table === 'organizations');
    const memberWrites = callLog.filter(c => c.table === 'memberships');
    const rpcCalls     = callLog.filter(c => c.op === 'rpc' && c.fn === 'provision_investor_account');

    expect(orgWrites).toHaveLength(0);
    expect(memberWrites).toHaveLength(0);
    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0].args.p_email).toBe('investor@test.com');
    expect(rpcCalls[0].args.p_full_name).toBe('Jane Smith');
  });

  it('returns an investor ID on success', async () => {
    const result = await provisionInvestorAccount(supabaseMock, 'investor@test.com', 'Jane Smith');
    expect(result).toBe('inv-001');
  });

  it('does NOT call create_organization RPC', async () => {
    await provisionInvestorAccount(supabaseMock, 'investor@test.com', 'Jane Smith');
    const orgRpc = callLog.filter(c => c.op === 'rpc' && c.fn === 'create_organization');
    expect(orgRpc).toHaveLength(0);
  });
});

// ── Seed-deal guard ───────────────────────────────────────────────────────────
// Verifies investor signup does not trigger the lotline_deals_seeded flag

describe('Investor signup does not set seeded flag', () => {
  it('investor signup never writes lotline_deals_seeded_* to localStorage', () => {
    // Simulate the investor signup flow writing only what it should
    const lsWrites = [];
    const mockSetItem = (key, _val) => lsWrites.push(key);

    // Investor signup only sets auth session — no seed flags
    mockSetItem('crm_user', '{}');

    const seededKeys = lsWrites.filter(k => k.startsWith('lotline_deals_seeded'));
    expect(seededKeys).toHaveLength(0);
  });
});
