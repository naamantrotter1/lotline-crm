/**
 * onboardingData.js
 * Phase 8: Checks completion status for the getting-started checklist.
 */
import { supabase } from './supabase';

export const ONBOARDING_STEPS = [
  {
    id:    'first_deal',
    label: 'Create your first deal',
    desc:  'Add a property to your pipeline',
    link:  '/deals',
  },
  {
    id:    'first_contact',
    label: 'Add your first contact',
    desc:  'Build your network of partners',
    link:  '/contacts',
  },
  {
    id:    'invite_member',
    label: 'Invite a team member',
    desc:  'Collaborate with your team',
    link:  '/settings?tab=team',
  },
  {
    id:    'custom_field',
    label: 'Create a custom field',
    desc:  'Tailor records to your workflow',
    link:  '/settings?tab=custom-fields',
  },
];

/** Returns { step_id: boolean } indicating which steps are complete. */
export async function checkOnboardingStatus(orgId) {
  if (!supabase || !orgId) return {};
  const [d, c, m, f] = await Promise.all([
    supabase.from('deals').select('id', { count: 'exact', head: true }).eq('organization_id', orgId),
    supabase.from('contacts').select('id', { count: 'exact', head: true }).eq('organization_id', orgId),
    supabase.from('memberships').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).eq('status', 'active'),
    supabase.from('custom_field_definitions').select('id', { count: 'exact', head: true }).eq('organization_id', orgId),
  ]);
  return {
    first_deal:    (d.count || 0) > 0,
    first_contact: (c.count || 0) > 0,
    invite_member: (m.count || 0) > 1,
    custom_field:  (f.count || 0) > 0,
  };
}
