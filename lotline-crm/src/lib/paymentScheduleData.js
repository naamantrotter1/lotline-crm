/**
 * paymentScheduleData.js
 *
 * Generation + persistence of investor payment schedules (interest payments,
 * principal returns, origination fees, profit splits) for a deal+investor.
 *
 * Source of truth: the `investor_payment_schedule` Postgres table. A SECURITY
 * DEFINER trigger projects each row into `deal_events` so the schedule appears
 * on both the deal calendar and the global Calendar overview without us having
 * to manage two writes from JS.
 *
 * Generator inputs (all fields tolerate strings or numbers — we coerce):
 *   deal       — full deal object (must have id, organization_id,
 *                financingScenarioType, scenarioData, capitalDeployedDate, arv, all_in_cost)
 *   investor   — { id, name }                — required
 *   allocation — deal_allocations row        — optional (CCP scenario)
 */

import { supabase } from './supabase';

// ── Helpers ──────────────────────────────────────────────────────────────────
const toNumber = (v) => {
  if (v === null || v === undefined || v === '') return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const round2 = (n) => Math.round(n * 100) / 100;
const isoDate = (d) => d.toISOString().slice(0, 10);
const today = () => new Date().toISOString().slice(0, 10);

/**
 * Adjust a payment date so its day-of-month matches the lender's payment_due_day.
 * Accepts: 'same_as_closing' | 'last_day' | numeric day string ('1'..'28').
 * Falls back to no-op for unrecognized values.
 */
function applyDueDay(date, dueDay) {
  if (!dueDay || dueDay === 'same_as_closing') return date;
  const d = new Date(date);
  if (dueDay === 'last_day') {
    d.setDate(1);
    d.setMonth(d.getMonth() + 1);
    d.setDate(0);
    return d;
  }
  const day = parseInt(dueDay, 10);
  if (!Number.isFinite(day) || day < 1) return date;
  const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, daysInMonth));
  return d;
}

const PAYMENT_TYPE_LABELS = {
  interest:        'Interest Payment',
  principal:       'Principal Return',
  origination_fee: 'Origination Fee',
  profit_share:    'Profit Share',
  draw_fee:        'Draw Fee',
  other:           'Payment',
};

export const formatPaymentType = (type) => PAYMENT_TYPE_LABELS[type] || 'Payment';

/** Map our payment_type → distributions.type when "Mark Paid" inserts a distribution. */
const distributionTypeFor = (paymentType) => {
  switch (paymentType) {
    case 'principal':       return 'return_of_capital';
    case 'profit_share':    return 'profit';
    case 'interest':
    case 'origination_fee':
    case 'draw_fee':
    default:                return 'preferred_return';
  }
};

/** Status pill colors (Tailwind utilities — match InvestorDistributions.jsx pattern). */
export const STATUS_PILL = {
  scheduled: 'bg-gray-500/15 text-gray-400',
  overdue:   'bg-red-500/15 text-red-400',
  paid:      'bg-green-500/15 text-green-400',
  waived:    'bg-yellow-500/15 text-yellow-500',
};

export const STATUS_LABEL = {
  scheduled: 'Scheduled',
  overdue:   'Overdue',
  paid:      'Paid',
  waived:    'Waived',
};

// ── Generator ────────────────────────────────────────────────────────────────
/**
 * Pure function: returns an array of payment-schedule objects ready to insert.
 * Caller is responsible for stamping organization_id / deal_id / investor_id.
 */
export function generatePaymentSchedule(deal, investor, allocation) {
  if (!deal || !investor) return [];

  const scenarioData = (() => {
    const sd = deal.scenarioData ?? deal.scenario_data;
    if (!sd) return {};
    if (typeof sd === 'string') {
      try { return JSON.parse(sd); } catch { return {}; }
    }
    return sd;
  })();

  // Normalise scenario type — accept both UI ids (hard-money-loan) and DB enums (hard_money_loan)
  const rawType = deal.financingScenarioType || deal.financing_scenario_type || '';
  const scenarioType = String(rawType).replace(/_/g, '-');

  const deployedRaw =
    allocation?.capital_deployed_date ||
    deal.capitalDeployedDate ||
    deal.capital_deployed_date;
  if (!deployedRaw) return [];

  const startDate = new Date(deployedRaw);
  if (Number.isNaN(startDate.getTime())) return [];

  const payments = [];

  // ── HARD MONEY (loan, land+home, construction holdback) ───────────────────
  if (['hard-money-loan', 'hard-money-land-home', 'hmcb'].includes(scenarioType)) {
    const data = scenarioData?.[scenarioType] || scenarioData || {};
    const principal = toNumber(
      allocation?.amount ?? data.purchasePrice ?? data.totalLoanAmount ?? data.loanAmountOverride ?? 0
    );
    const annualRate = toNumber(data.interestRate ?? scenarioData.interestRate) / 100;
    const monthlyRate = annualRate / 12;
    const holdMonths = Math.max(
      1,
      Math.round(toNumber(data.holdPeriod ?? scenarioData.holdPeriod ?? data.termMonths ?? deal.holding_months ?? 6))
    );
    const monthlyInterest = round2(principal * monthlyRate);
    const originationPct = toNumber(data.originationFeePct ?? scenarioData.originationFeePct) / 100;
    const originationFlat = toNumber(data.originationFeeFlat ?? scenarioData.originationFeeFlat);
    const originationFee = round2(originationFlat || principal * originationPct);
    const paymentDueDay = data.paymentDueDay ?? scenarioData.paymentDueDay ?? 'same_as_closing';
    const firstPaymentDateRaw = data.firstPaymentDate ?? scenarioData.firstPaymentDate ?? null;
    const firstPaymentAnchor = firstPaymentDateRaw && !Number.isNaN(new Date(firstPaymentDateRaw).getTime())
      ? new Date(firstPaymentDateRaw)
      : null;

    if (originationFee > 0) {
      payments.push({
        payment_type: 'origination_fee',
        payment_number: 0,
        amount: originationFee,
        due_date: isoDate(startDate),
      });
    }

    if (monthlyInterest > 0) {
      for (let m = 1; m <= holdMonths; m++) {
        let due;
        if (firstPaymentAnchor) {
          due = new Date(firstPaymentAnchor);
          if (m > 1) {
            due.setMonth(due.getMonth() + (m - 1));
            due = applyDueDay(due, paymentDueDay);
          }
        } else {
          due = new Date(startDate);
          due.setMonth(due.getMonth() + m);
          due = applyDueDay(due, paymentDueDay);
        }
        payments.push({
          payment_type: 'interest',
          payment_number: m,
          amount: monthlyInterest,
          due_date: isoDate(due),
        });
      }
    }

    if (principal > 0) {
      let maturity;
      if (firstPaymentAnchor) {
        maturity = new Date(firstPaymentAnchor);
        maturity.setMonth(maturity.getMonth() + (holdMonths - 1));
        maturity = applyDueDay(maturity, paymentDueDay);
      } else {
        maturity = new Date(startDate);
        maturity.setMonth(maturity.getMonth() + holdMonths);
        maturity = applyDueDay(maturity, paymentDueDay);
      }
      payments.push({
        payment_type: 'principal',
        payment_number: holdMonths + 1,
        amount: principal,
        due_date: isoDate(maturity),
      });
    }
  }

  // ── PROFIT SPLIT ──────────────────────────────────────────────────────────
  if (scenarioType === 'profit-split') {
    const data = scenarioData?.['profit-split'] || scenarioData || {};
    const capital = toNumber(
      allocation?.amount ?? data.capitalContributed ?? data.investorCapital ?? 0
    );
    const splitPct = toNumber(
      data.investorSplitPct ??
        data.investorProfitSplitPct ??
        scenarioData.investorProfitSplitPct ??
        allocation?.profit_share_pct ??
        0
    ) / 100;
    const projectedProfit = toNumber(deal.arv) - toNumber(deal.all_in_cost);
    const investorShare = round2(projectedProfit * splitPct);
    const payoutDate =
      data.projectedPayoutDate || deal.home_close_date || deal.homeCloseDate || isoDate(startDate);

    if (capital > 0) {
      payments.push({
        payment_type: 'principal',
        payment_number: 1,
        amount: capital,
        due_date: payoutDate,
      });
    }
    if (investorShare > 0) {
      payments.push({
        payment_type: 'profit_share',
        payment_number: 2,
        amount: investorShare,
        due_date: payoutDate,
      });
    }
  }

  // ── LINE OF CREDIT ────────────────────────────────────────────────────────
  if (scenarioType === 'loc') {
    const data = scenarioData?.['loc'] || scenarioData || {};
    const drawn = toNumber(data.amountDrawn ?? data.drawAmount ?? scenarioData.drawAmount ?? 0);
    const annualRate = toNumber(data.annualRate ?? data.interestRate ?? scenarioData.interestRate) / 100;
    const monthlyInterest = round2((drawn * annualRate) / 12);
    const months = Math.max(1, Math.round(toNumber(deal.holding_months ?? data.holdPeriod ?? 6)));
    const paymentDueDay = data.paymentDueDay ?? scenarioData.paymentDueDay ?? 'same_as_closing';
    const firstPaymentDateRaw = data.firstPaymentDate ?? scenarioData.firstPaymentDate ?? null;
    const firstPaymentAnchor = firstPaymentDateRaw && !Number.isNaN(new Date(firstPaymentDateRaw).getTime())
      ? new Date(firstPaymentDateRaw)
      : null;

    if (monthlyInterest > 0) {
      for (let m = 1; m <= months; m++) {
        let due;
        if (firstPaymentAnchor) {
          due = new Date(firstPaymentAnchor);
          if (m > 1) {
            due.setMonth(due.getMonth() + (m - 1));
            due = applyDueDay(due, paymentDueDay);
          }
        } else {
          due = new Date(startDate);
          due.setMonth(due.getMonth() + m);
          due = applyDueDay(due, paymentDueDay);
        }
        payments.push({
          payment_type: 'interest',
          payment_number: m,
          amount: monthlyInterest,
          due_date: isoDate(due),
        });
      }
    }
  }

  // Stamp common fields. Status is set on save; we leave it scheduled here so
  // applyOverdue() (read-time) can promote past-due rows uniformly.
  return payments.map((p) => ({
    ...p,
    organization_id: deal.organization_id || deal.organizationId,
    deal_id: String(deal.id),
    investor_id: investor.id,
    deal_allocation_id: allocation?.id || null,
    status: 'scheduled',
  }));
}

// ── Persistence ──────────────────────────────────────────────────────────────

/**
 * Look up an investor by name within an org. Used when a non-CCP scenario
 * stores only the investor name in scenario_data (the dropdown shows names).
 */
export async function lookupInvestorByName(orgId, name) {
  if (!orgId || !name) return null;
  const { data } = await supabase
    .from('investors')
    .select('id, name, email')
    .eq('organization_id', orgId)
    .eq('name', name)
    .maybeSingle();
  return data || null;
}

/**
 * Replace the schedule for (deal_id, investor_id):
 *   1) soft-delete existing scheduled/overdue rows so calendar events go away
 *   2) insert freshly-generated rows
 *   3) return inserted rows (caller can re-fetch to get the trigger-created event link)
 *
 * Paid rows are preserved (they reference distributions; we never clobber audit data).
 */
export async function savePaymentSchedule({ deal, investor, allocation, orgId }) {
  if (!deal || !investor) return { inserted: [], error: 'missing deal/investor' };
  const dealId = String(deal.id);

  // Clear existing un-paid rows. Soft delete via deleted_at so the trigger removes
  // the matching deal_events too.
  const { error: delErr } = await supabase
    .from('investor_payment_schedule')
    .update({ deleted_at: new Date().toISOString() })
    .eq('deal_id', dealId)
    .eq('investor_id', investor.id)
    .is('deleted_at', null)
    .in('status', ['scheduled', 'overdue']);
  if (delErr) return { inserted: [], error: delErr };

  const rows = generatePaymentSchedule(deal, investor, allocation);
  if (rows.length === 0) return { inserted: [], error: null };

  const { data: inserted, error: insErr } = await supabase
    .from('investor_payment_schedule')
    .insert(rows)
    .select('*');
  if (insErr) return { inserted: [], error: insErr };

  return { inserted: inserted || [], error: null };
}

/**
 * Mark a scheduled payment as paid:
 *   - Insert a `distributions` row (audit trail)
 *   - Update the schedule row → status='paid', paid_*, distribution_id
 *   - Trigger re-runs and re-colors the deal_event green
 */
export async function markPaymentPaid({
  scheduleRow,
  paidAmount,
  paidDate,
  wireRef,
  notes,
}) {
  if (!scheduleRow) return { error: 'missing row' };

  const distributionType = distributionTypeFor(scheduleRow.payment_type);

  // 1) Distribution row
  const { data: dist, error: distErr } = await supabase
    .from('distributions')
    .insert({
      deal_id:        scheduleRow.deal_id,
      investor_id:    scheduleRow.investor_id,
      date:           paidDate || today(),
      amount:         toNumber(paidAmount ?? scheduleRow.amount),
      type:           distributionType,
      wire_reference: wireRef || null,
      notes:          notes || `${formatPaymentType(scheduleRow.payment_type)} (auto-recorded from payment schedule)`,
    })
    .select('id')
    .single();
  if (distErr) return { error: distErr };

  // 2) Schedule row update
  const { error: updErr } = await supabase
    .from('investor_payment_schedule')
    .update({
      status:          'paid',
      paid_date:       paidDate || today(),
      paid_amount:     toNumber(paidAmount ?? scheduleRow.amount),
      distribution_id: dist?.id || null,
    })
    .eq('id', scheduleRow.id);
  if (updErr) return { error: updErr };

  return { error: null };
}

/**
 * Mark a single row as un-paid (rolls back distribution + schedule status).
 * Best-effort: deletes the linked distribution if one exists.
 */
export async function unmarkPaymentPaid(scheduleRow) {
  if (!scheduleRow?.distribution_id) {
    await supabase
      .from('investor_payment_schedule')
      .update({ status: 'scheduled', paid_date: null, paid_amount: null })
      .eq('id', scheduleRow.id);
    return { error: null };
  }
  await supabase.from('distributions').delete().eq('id', scheduleRow.distribution_id);
  const { error } = await supabase
    .from('investor_payment_schedule')
    .update({ status: 'scheduled', paid_date: null, paid_amount: null, distribution_id: null })
    .eq('id', scheduleRow.id);
  return { error };
}

// ── Read helpers ─────────────────────────────────────────────────────────────

/** Promote scheduled rows past due into 'overdue' for read-time display. */
export function applyOverdue(rows) {
  const todayStr = today();
  return (rows || []).map((r) =>
    r.status === 'scheduled' && r.due_date < todayStr ? { ...r, status: 'overdue' } : r
  );
}

export async function fetchScheduleForDeal(dealId) {
  const { data, error } = await supabase
    .from('investor_payment_schedule')
    .select('*, investors(id, name)')
    .eq('deal_id', String(dealId))
    .is('deleted_at', null)
    .order('due_date', { ascending: true });
  return { rows: applyOverdue(data || []), error };
}

export async function fetchScheduleForInvestor(investorId) {
  const { data, error } = await supabase
    .from('investor_payment_schedule')
    .select('*, deals(address)')
    .eq('investor_id', investorId)
    .is('deleted_at', null)
    .order('due_date', { ascending: true });
  return { rows: applyOverdue(data || []), error };
}

/** Sum helpers for totals row. */
export function summariseSchedule(rows) {
  let owed = 0, paid = 0;
  for (const r of rows || []) {
    if (r.status === 'paid') paid += toNumber(r.paid_amount ?? r.amount);
    else if (r.status !== 'waived') owed += toNumber(r.amount);
  }
  return { owed, paid, remaining: owed };
}
