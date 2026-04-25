import '@testing-library/jest-dom';

// Stub out Supabase so tests don't need real credentials
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }),
      upsert: async () => ({}),
      insert: async () => ({}),
      update: async () => ({}),
      delete: async () => ({}),
    }),
  },
}));

// Stub AuthContext
vi.mock('../lib/AuthContext', () => ({
  useAuth: () => ({
    profile: { id: 'test-user-id', name: 'Test User' },
    activeOrgId: 'test-org-id',
  }),
}));
