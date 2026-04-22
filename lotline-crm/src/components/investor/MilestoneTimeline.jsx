import { Check, Clock, Circle, SkipForward } from 'lucide-react';

const MILESTONES = [
  { key: 'contract_signed', label: 'Contract\nSigned'  },
  { key: 'permits',         label: 'Permits'            },
  { key: 'site_prep',       label: 'Site Prep'          },
  { key: 'delivery',        label: 'Home\nDelivered'    },
  { key: 'setup',           label: 'Setup &\nUtilities' },
  { key: 'finishing',       label: 'Finishing'          },
  { key: 'listed',          label: 'Listed'             },
  { key: 'sold',            label: 'Sold'               },
];

// Derive milestone status from deal.stage when no DB data
const STAGE_COMPLETE_THROUGH = {
  'Contract Signed': 0,  // contract_signed in_progress
  'Due Diligence':   1,  // contract_signed done, permits in_progress
  'Development':     2,  // permits done, site_prep in_progress
  'Complete':        8,  // all done
};

function deriveStatus(msIndex, dealStage) {
  const through = STAGE_COMPLETE_THROUGH[dealStage] ?? -1;
  if (dealStage === 'Complete') return 'complete';
  if (msIndex < through)  return 'complete';
  if (msIndex === through) return 'in_progress';
  return 'pending';
}

function fmtDate(d) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function StatusIcon({ status }) {
  if (status === 'complete')    return <Check size={12} strokeWidth={3} />;
  if (status === 'in_progress') return <Clock size={12} />;
  if (status === 'skipped')     return <SkipForward size={12} />;
  return <Circle size={10} />;
}

export default function MilestoneTimeline({ deal, milestones = [] }) {
  // Build a lookup from DB milestones
  const dbMap = Object.fromEntries(milestones.map(m => [m.milestone_key, m]));

  const steps = MILESTONES.map((ms, i) => {
    const db     = dbMap[ms.key];
    const status = db?.status ?? deriveStatus(i, deal.stage);
    return {
      ...ms,
      status,
      note:         db?.note ?? null,
      completedAt:  db?.completed_at ?? null,
      eta:          db?.eta ?? null,
    };
  });

  const activeIndex = steps.findIndex(s => s.status === 'in_progress');

  return (
    <div className="bg-white dark:bg-[#1c2130] rounded-2xl border border-gray-200 dark:border-white/8 p-5">
      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-5">
        Project Milestones
      </p>

      {/* ── Desktop horizontal stepper ── */}
      <div className="hidden md:flex items-start gap-0">
        {steps.map((step, i) => {
          const isLast = i === steps.length - 1;
          const done   = step.status === 'complete';
          const active = step.status === 'in_progress';
          const skip   = step.status === 'skipped';

          return (
            <div key={step.key} className="flex-1 flex flex-col items-center relative min-w-0">
              {/* Connector line */}
              {!isLast && (
                <div className="absolute top-[14px] left-1/2 w-full h-0.5 z-0">
                  <div className={`h-full transition-all ${done ? 'bg-accent' : 'bg-gray-200 dark:bg-white/10'}`} />
                </div>
              )}

              {/* Circle */}
              <div className={`
                relative z-10 w-7 h-7 rounded-full flex items-center justify-center mb-2 transition-all
                ${done  ? 'bg-accent text-white'                              : ''}
                ${active ? 'bg-accent/20 text-accent ring-2 ring-accent/40 animate-pulse' : ''}
                ${!done && !active && !skip ? 'bg-gray-200 dark:bg-white/10 text-gray-400 dark:text-gray-600' : ''}
                ${skip   ? 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-700' : ''}
              `}>
                <StatusIcon status={step.status} />
              </div>

              {/* Label */}
              <p className={`
                text-[9px] text-center leading-tight whitespace-pre-line transition-colors px-0.5
                ${active ? 'text-accent font-semibold' : done ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500'}
              `}>
                {step.label}
              </p>

              {/* Date / ETA */}
              {(step.completedAt || step.eta) && (
                <p className="text-[8px] text-gray-400 dark:text-gray-500 mt-0.5 text-center">
                  {step.completedAt ? fmtDate(step.completedAt) : `ETA ${fmtDate(step.eta)}`}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Mobile vertical stepper ── */}
      <div className="md:hidden space-y-0">
        {steps.map((step, i) => {
          const isLast = i === steps.length - 1;
          const done   = step.status === 'complete';
          const active = step.status === 'in_progress';
          const skip   = step.status === 'skipped';

          return (
            <div key={step.key} className="flex gap-3">
              {/* Spine */}
              <div className="flex flex-col items-center flex-shrink-0 w-7">
                <div className={`
                  w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all
                  ${done  ? 'bg-accent text-white'                                : ''}
                  ${active ? 'bg-accent/20 text-accent ring-2 ring-accent/40'     : ''}
                  ${!done && !active && !skip ? 'bg-gray-200 dark:bg-white/8 text-gray-400 dark:text-gray-600' : ''}
                  ${skip   ? 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-700' : ''}
                `}>
                  <StatusIcon status={step.status} />
                </div>
                {!isLast && (
                  <div className={`w-0.5 flex-1 my-1 min-h-[20px] ${done ? 'bg-accent/40' : 'bg-gray-200 dark:bg-white/8'}`} />
                )}
              </div>

              {/* Content */}
              <div className={`pb-4 flex-1 min-w-0 ${isLast ? 'pb-0' : ''}`}>
                <p className={`text-sm font-medium leading-snug ${active ? 'text-accent' : done ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500'}`}>
                  {step.label.replace('\n', ' ')}
                </p>
                {(step.completedAt || step.eta) && (
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                    {step.completedAt ? `Completed ${fmtDate(step.completedAt)}` : `ETA ${fmtDate(step.eta)}`}
                  </p>
                )}
                {step.note && (
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">{step.note}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Active step note (desktop) */}
      {activeIndex >= 0 && steps[activeIndex].note && (
        <p className="hidden md:block mt-4 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-white/3 rounded-lg px-4 py-2.5 border border-gray-100 dark:border-white/5">
          <span className="text-accent font-semibold">{steps[activeIndex].label.replace('\n', ' ')}:</span>{' '}
          {steps[activeIndex].note}
        </p>
      )}
    </div>
  );
}
