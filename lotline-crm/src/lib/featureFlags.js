/**
 * featureFlags.js
 * Feature flags for phased rollout. Each flag is a VITE_ env var
 * (true in staging, disabled by default in prod until verified).
 *
 * Usage:
 *   import { isEnabled } from '../lib/featureFlags';
 *   if (isEnabled('WORKFLOWS')) { ... }
 */

const FLAGS = {
  WORKFLOWS:      import.meta.env.VITE_FLAG_WORKFLOWS      !== 'false', // Phase 11 — on by default in dev
  SMS:            import.meta.env.VITE_FLAG_SMS             === 'true',  // Phase 12
  VOICE:          import.meta.env.VITE_FLAG_VOICE           === 'true',  // Phase 13
  CALENDAR:       import.meta.env.VITE_FLAG_CALENDAR        === 'true',  // Phase 14
  PWA_PUSH:       import.meta.env.VITE_FLAG_PWA_PUSH        === 'true',  // Phase 15
  ESIGN:          import.meta.env.VITE_FLAG_ESIGN           === 'true',  // Phase 16
  LEAD_FORMS:     import.meta.env.VITE_FLAG_LEAD_FORMS      === 'true',  // Phase 17
  DEDUPE:         import.meta.env.VITE_FLAG_DEDUPE          === 'true',  // Phase 18
  AI:             import.meta.env.VITE_FLAG_AI              === 'true',  // Phase 19
  PROPERTY_DATA:  import.meta.env.VITE_FLAG_PROPERTY_DATA   === 'true',  // Phase 20
};

export function isEnabled(flag) {
  return !!FLAGS[flag];
}

export default FLAGS;
