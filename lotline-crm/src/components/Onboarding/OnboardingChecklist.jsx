/**
 * OnboardingChecklist.jsx
 * Phase 8: Floating getting-started checklist shown to new orgs.
 * Dismissible per org (stored in localStorage). Auto-hides when all steps done.
 */
import { useState, useEffect } from 'react';
import { CheckCircle2, Circle, ChevronDown, ChevronUp, X, Rocket } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/AuthContext';
import { checkOnboardingStatus, ONBOARDING_STEPS } from '../../lib/onboardingData';

export default function OnboardingChecklist() {
  const { activeOrgId } = useAuth();
  const navigate = useNavigate();

  const dismissKey = `onboarding_dismissed_${activeOrgId}`;
  const [status,    setStatus]    = useState({});
  const [collapsed, setCollapsed] = useState(false);
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(`onboarding_dismissed_${activeOrgId}`) === 'true'
  );

  useEffect(() => {
    setDismissed(localStorage.getItem(dismissKey) === 'true');
  }, [dismissKey]);

  useEffect(() => {
    if (!activeOrgId || dismissed) return;
    checkOnboardingStatus(activeOrgId).then(setStatus);
  }, [activeOrgId, dismissed]);

  const completedCount = ONBOARDING_STEPS.filter(s => status[s.id]).length;
  const allComplete    = completedCount === ONBOARDING_STEPS.length;

  if (dismissed || allComplete) return null;

  const handleDismiss = (e) => {
    e.stopPropagation();
    localStorage.setItem(dismissKey, 'true');
    setDismissed(true);
  };

  return (
    <div className="fixed bottom-6 right-6 z-40 w-72 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer select-none"
        style={{ background: 'linear-gradient(135deg, #c9703a 0%, #e08a50 100%)' }}
        onClick={() => setCollapsed(c => !c)}
      >
        <div className="flex items-center gap-2">
          <Rocket size={14} className="text-white" />
          <span className="text-sm font-semibold text-white">Getting Started</span>
          <span className="text-xs bg-white/25 text-white px-1.5 py-0.5 rounded-full font-semibold">
            {completedCount}/{ONBOARDING_STEPS.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleDismiss}
            className="p-0.5 rounded hover:bg-white/20 text-white/70 hover:text-white transition-colors"
            title="Dismiss"
          >
            <X size={13} />
          </button>
          {collapsed
            ? <ChevronUp size={14} className="text-white/80" />
            : <ChevronDown size={14} className="text-white/80" />
          }
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-gray-100">
        <div
          className="h-full transition-all duration-500"
          style={{ width: `${(completedCount / ONBOARDING_STEPS.length) * 100}%`, backgroundColor: '#c9703a' }}
        />
      </div>

      {/* Steps */}
      {!collapsed && (
        <ul className="p-3 space-y-0.5">
          {ONBOARDING_STEPS.map(step => {
            const done = !!status[step.id];
            return (
              <li key={step.id}>
                <button
                  onClick={() => navigate(step.link)}
                  className={`w-full flex items-start gap-3 p-2.5 rounded-xl text-left transition-colors ${
                    done ? 'opacity-50 cursor-default' : 'hover:bg-gray-50'
                  }`}
                >
                  {done
                    ? <CheckCircle2 size={16} className="text-green-500 flex-shrink-0 mt-0.5" />
                    : <Circle      size={16} className="text-gray-300 flex-shrink-0 mt-0.5" />
                  }
                  <div>
                    <p className={`text-sm font-medium leading-snug ${done ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                      {step.label}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{step.desc}</p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
