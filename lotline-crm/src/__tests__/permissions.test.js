import { describe, it, expect } from 'vitest';
import { canUser, canUserServer, CAPABILITIES, PLAN_SEAT_LIMITS, seatLimitMessage } from '../lib/permissions';

describe('canUser', () => {
  it('returns false for null role', () => {
    expect(canUser(null, 'deal.view')).toBe(false);
  });

  it('owner can do everything', () => {
    for (const cap of Object.keys(CAPABILITIES)) {
      expect(canUser('owner', cap)).toBe(true);
    }
  });

  it('viewer can view but not create/edit', () => {
    expect(canUser('viewer', 'deal.view')).toBe(true);
    expect(canUser('viewer', 'deal.create')).toBe(false);
    expect(canUser('viewer', 'deal.edit')).toBe(false);
    expect(canUser('viewer', 'deal.delete')).toBe(false);
  });

  it('operator can create/edit deals but not delete', () => {
    expect(canUser('operator', 'deal.create')).toBe(true);
    expect(canUser('operator', 'deal.edit')).toBe(true);
    expect(canUser('operator', 'deal.delete')).toBe(false);
  });

  it('admin cannot transfer ownership or delete org', () => {
    expect(canUser('admin', 'team.transfer_ownership')).toBe(false);
    expect(canUser('admin', 'org.delete')).toBe(false);
  });

  it('viewer cannot send SMS or make calls', () => {
    expect(canUser('viewer', 'sms.send')).toBe(false);
    expect(canUser('viewer', 'voice.call')).toBe(false);
  });

  it('returns false for unknown capability', () => {
    expect(canUser('owner', 'nonexistent.capability')).toBe(false);
  });

  it('thread permissions: operator can create and reply', () => {
    expect(canUser('operator', 'thread.create')).toBe(true);
    expect(canUser('operator', 'thread.reply')).toBe(true);
    expect(canUser('operator', 'thread.delete_any')).toBe(false);
  });

  it('pipeline: only owner/admin can configure', () => {
    expect(canUser('admin', 'pipeline.configure')).toBe(true);
    expect(canUser('operator', 'pipeline.configure')).toBe(false);
    expect(canUser('viewer', 'pipeline.configure')).toBe(false);
  });

  it('esign.provider_connect: owner only', () => {
    expect(canUser('owner', 'esign.provider_connect')).toBe(true);
    expect(canUser('admin', 'esign.provider_connect')).toBe(false);
  });
});

describe('canUserServer', () => {
  it('mirrors canUser logic without import.meta', () => {
    expect(canUserServer('admin', 'deal.view')).toBe(true);
    expect(canUserServer(null, 'deal.view')).toBe(false);
    expect(canUserServer('viewer', 'deal.create')).toBe(false);
  });
});

describe('PLAN_SEAT_LIMITS', () => {
  it('starter has 1 seat, pro has 6, scale has 20', () => {
    expect(PLAN_SEAT_LIMITS.starter).toBe(1);
    expect(PLAN_SEAT_LIMITS.pro).toBe(6);
    expect(PLAN_SEAT_LIMITS.scale).toBe(20);
  });
});

describe('seatLimitMessage', () => {
  it('starter always returns upgrade message', () => {
    const msg = seatLimitMessage('starter', 1, 1);
    expect(msg).toContain('Upgrade to Pro');
  });

  it('pro includes active member count', () => {
    const msg = seatLimitMessage('pro', 4, 6);
    expect(msg).toContain('3 active members');
  });

  it('scale at limit shows invoice warning', () => {
    const msg = seatLimitMessage('scale', 20, 20);
    expect(msg).toContain('next invoice');
  });
});
