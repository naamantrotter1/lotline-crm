import { useState } from 'react';
import { BIG_ROCKS_HISTORY, CURRENT_WEEK_ROCKS } from '../data/bigRocks';
import { StatusBadge } from '../components/UI/Badge';
import { Target, CheckCircle, RefreshCw, Clock } from 'lucide-react';

const TEAM = ['All', 'Alex', 'Benson', 'Naaman', 'Zach'];

function rockStats(rocks) {
  const completed = rocks.filter((r) => r.status === 'Completed').length;
  const rolledOver = rocks.filter((r) => r.status === 'Rolled Over').length;
  const inProgress = rocks.filter((r) => r.status === 'In Progress').length;
  const notStarted = rocks.filter((r) => r.status === 'Not Started').length;
  return { completed, rolledOver, inProgress, notStarted, total: rocks.length };
}

export default function BigRocks() {
  const [filter, setFilter] = useState('All');
  const [tab, setTab] = useState('current');

  const currentStats = rockStats(CURRENT_WEEK_ROCKS);
  const lastStats = rockStats(BIG_ROCKS_HISTORY);

  const displayRocks = tab === 'current' ? CURRENT_WEEK_ROCKS : BIG_ROCKS_HISTORY;
  const filtered = filter === 'All' ? displayRocks : displayRocks.filter((r) => r.assignedTo === filter);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-accent rounded-lg">
          <Target size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-sidebar">Big Rocks</h1>
          <p className="text-sm text-gray-500">Weekly priority tasks and accountability tracker</p>
        </div>
      </div>

      {/* Current Week Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Tasks', value: currentStats.total, icon: Target, color: 'text-sidebar' },
          { label: 'Completed', value: currentStats.completed, icon: CheckCircle, color: 'text-green-600' },
          { label: 'Rolled Over', value: currentStats.rolledOver, icon: RefreshCw, color: 'text-yellow-600' },
          { label: 'In Progress', value: currentStats.inProgress, icon: Clock, color: 'text-blue-600' },
        ].map((stat) => (
          <div key={stat.label} className="bg-card rounded-xl shadow-sm p-4 flex items-center gap-3">
            <div className={`${stat.color}`}>
              <stat.icon size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold text-sidebar">{stat.value}</p>
              <p className="text-xs text-gray-500">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-4">
        <div className="flex bg-card rounded-lg p-1">
          <button
            onClick={() => setTab('current')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'current' ? 'bg-white text-sidebar shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Current Week (Apr 6)
          </button>
          <button
            onClick={() => setTab('history')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'history' ? 'bg-white text-sidebar shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Last Week (Mar 30) Review
          </button>
        </div>

        {/* Team Filter */}
        <div className="flex gap-2">
          {TEAM.map((name) => (
            <button
              key={name}
              onClick={() => setFilter(name)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === name ? 'bg-accent text-white' : 'bg-card text-gray-600 hover:bg-gray-200'}`}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      {/* Last Week Summary (when on history tab) */}
      {tab === 'history' && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total', value: lastStats.total, color: 'text-sidebar' },
            { label: 'Completed', value: lastStats.completed, color: 'text-green-600' },
            { label: 'Rolled Over', value: lastStats.rolledOver, color: 'text-yellow-600' },
            { label: 'Not Started', value: lastStats.notStarted, color: 'text-red-500' },
          ].map((s) => (
            <div key={s.label} className="bg-card rounded-xl p-4 text-center">
              <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tasks Table */}
      <div className="bg-card rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Task</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Assigned To</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Due Date</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((rock) => (
              <tr key={rock.id} className="border-b border-gray-100 hover:bg-white/50 transition-colors">
                <td className="py-3 px-4 text-sm text-gray-800">{rock.task}</td>
                <td className="py-3 px-4">
                  <span className="text-sm font-medium text-sidebar bg-white px-2 py-0.5 rounded-full border border-gray-200">
                    {rock.assignedTo}
                  </span>
                </td>
                <td className="py-3 px-4 text-sm text-gray-500">{rock.dueDate}</td>
                <td className="py-3 px-4">
                  <StatusBadge status={rock.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-8 text-gray-400 text-sm">No tasks match current filter</div>
        )}
      </div>
    </div>
  );
}
