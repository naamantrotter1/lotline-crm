/**
 * Right column of the HubSpot-style deal detail layout.
 * "Association" — linked entities panel scaffold.
 * PR 1: shell only. Full sections land in PR 4.
 */
import { useState } from 'react';
import {
  Home, Users, UserCircle, FileText, CheckSquare, Scale,
  TrendingDown, DollarSign, ChevronDown, ChevronRight, Plus,
} from 'lucide-react';

function Section({ icon: Icon, title, count, defaultOpen = false, children, onAdd }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-gray-100 last:border-0">
      <div className="flex items-center justify-between px-4 py-2.5">
        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-2 flex-1 text-left hover:text-gray-700 transition-colors"
        >
          <Icon size={13} className="text-gray-400 flex-shrink-0" />
          <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{title}</span>
          {count != null && count > 0 && (
            <span className="ml-1 text-[10px] font-bold text-white bg-accent rounded-full w-4 h-4 flex items-center justify-center">
              {count}
            </span>
          )}
          {open ? <ChevronDown size={13} className="text-gray-400 ml-auto" /> : <ChevronRight size={13} className="text-gray-400 ml-auto" />}
        </button>
        {onAdd && (
          <button
            onClick={e => { e.stopPropagation(); onAdd(); }}
            className="p-1 text-gray-400 hover:text-accent hover:bg-accent/5 rounded transition-colors"
          >
            <Plus size={13} />
          </button>
        )}
      </div>
      {open && (
        <div className="px-4 pb-3">
          {children || (
            <p className="text-xs text-gray-400 italic">No items yet</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function DealRightColumn({
  deal,
  tasks,
  contacts,
  documents,
  envelopes,
  capitalStack,
  distributions,
  onAddTask,
  onAddContact,
  readOnly,
}) {
  return (
    <div className="h-full overflow-y-auto bg-white flex flex-col">
      <div className="px-4 py-3 border-b border-gray-100">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Associations</p>
      </div>

      <div className="flex-1">
        <Section icon={Home} title="Property" defaultOpen>
          {deal?.address && (
            <div className="text-xs text-gray-700 bg-gray-50 rounded-lg px-3 py-2">
              <p className="font-medium">{deal.address}</p>
              {deal.county && <p className="text-gray-400 mt-0.5">{deal.county}, {deal.state || deal.dealState}</p>}
              {deal.acreage && <p className="text-gray-400">{deal.acreage} acres</p>}
            </div>
          )}
        </Section>

        <Section
          icon={UserCircle}
          title="Contacts"
          count={contacts?.length}
          onAdd={!readOnly ? onAddContact : undefined}
        >
          {contacts?.length > 0
            ? contacts.map((c, i) => (
              <div key={i} className="flex items-center gap-2 py-1.5">
                <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-[10px] font-bold text-accent">
                    {(c.name || c.email || '?')[0].toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-800 truncate">{c.name || c.email}</p>
                  {c.role && <p className="text-[10px] text-gray-400">{c.role}</p>}
                </div>
              </div>
            ))
            : <p className="text-xs text-gray-400 italic">No contacts linked</p>
          }
        </Section>

        <Section
          icon={CheckSquare}
          title="Tasks"
          count={tasks?.filter(t => !t.completed)?.length}
          onAdd={!readOnly ? onAddTask : undefined}
        >
          {tasks?.length > 0
            ? tasks.slice(0, 5).map((t, i) => (
              <div key={i} className="flex items-center gap-2 py-1">
                <div className={`w-3.5 h-3.5 rounded border flex-shrink-0 ${t.completed ? 'bg-green-500 border-green-500' : 'border-gray-300'}`} />
                <span className={`text-xs flex-1 truncate ${t.completed ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                  {t.title || t.text}
                </span>
              </div>
            ))
            : <p className="text-xs text-gray-400 italic">No tasks yet</p>
          }
        </Section>

        <Section icon={FileText} title="Documents" count={documents?.length}>
          {documents?.length > 0
            ? documents.map((d, i) => (
              <div key={i} className="flex items-center gap-2 py-1.5">
                <FileText size={12} className="text-gray-400 flex-shrink-0" />
                <span className="text-xs text-gray-700 truncate">{d.name || d.file}</span>
              </div>
            ))
            : <p className="text-xs text-gray-400 italic">No documents</p>
          }
        </Section>

        <Section icon={Scale} title="Capital Stack" defaultOpen={false}>
          {capitalStack?.allocations?.length > 0
            ? capitalStack.allocations.map((a, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                <span className="text-xs text-gray-700 truncate">{a.investorName || a.name}</span>
                <span className="text-xs font-semibold text-gray-800">
                  ${Math.round(a.amount || 0).toLocaleString()}
                </span>
              </div>
            ))
            : <p className="text-xs text-gray-400 italic">No capital allocated</p>
          }
        </Section>

        <Section icon={TrendingDown} title="Distributions" count={distributions?.length} defaultOpen={false}>
          {distributions?.length > 0
            ? distributions.map((d, i) => (
              <div key={i} className="flex items-center justify-between py-1.5">
                <span className="text-xs text-gray-700">{d.investorName || 'Investor'}</span>
                <span className="text-xs font-semibold text-green-600">
                  +${Math.round(d.amount || 0).toLocaleString()}
                </span>
              </div>
            ))
            : <p className="text-xs text-gray-400 italic">No distributions</p>
          }
        </Section>

        <Section icon={FileText} title="E-Sign Envelopes" count={envelopes?.length} defaultOpen={false}>
          {envelopes?.length > 0
            ? envelopes.map((e, i) => (
              <div key={i} className="flex items-center justify-between py-1.5">
                <span className="text-xs text-gray-700 truncate">{e.name}</span>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                  e.status === 'completed' ? 'bg-green-50 text-green-700' :
                  e.status === 'sent'      ? 'bg-blue-50 text-blue-700' :
                  'bg-gray-100 text-gray-500'
                }`}>{e.status}</span>
              </div>
            ))
            : <p className="text-xs text-gray-400 italic">No envelopes</p>
          }
        </Section>

      </div>
    </div>
  );
}
