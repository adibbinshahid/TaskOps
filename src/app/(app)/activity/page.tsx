'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { format, parseISO } from 'date-fns';
import type { ActivityLog, ActivityAction } from '@/types';
import Link from 'next/link';

const ACTION_LABELS: Record<ActivityAction, { label: string; color: string; icon: string }> = {
  created: { label: 'Created', color: 'text-blue-400', icon: '✦' },
  ai_classified: { label: 'AI classified', color: 'text-violet-400', icon: '◆' },
  ai_scheduled: { label: 'AI scheduled', color: 'text-indigo-400', icon: '◇' },
  edited: { label: 'Edited', color: 'text-white/60', icon: '✎' },
  moved: { label: 'Moved', color: 'text-cyan-400', icon: '↑' },
  reminded: { label: 'Reminded', color: 'text-amber-400', icon: '⏰' },
  completed: { label: 'Completed', color: 'text-emerald-400', icon: '✓' },
  deleted: { label: 'Deleted', color: 'text-red-400', icon: '✕' },
  undone: { label: 'Undone', color: 'text-orange-400', icon: '↩' },
};

const ACTION_OPTIONS: ActivityAction[] = [
  'created', 'ai_classified', 'ai_scheduled', 'edited',
  'moved', 'reminded', 'completed', 'deleted', 'undone',
];

export default function ActivityPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  async function loadLogs() {
    setLoading(true);
    const params = new URLSearchParams({ limit: '100' });
    if (actionFilter) params.set('action', actionFilter);
    if (startDate) params.set('start_date', startDate);
    if (endDate) params.set('end_date', endDate);
    const res = await fetch(`/api/activity?${params}`);
    setLogs(await res.json());
    setLoading(false);
  }

  useEffect(() => { loadLogs(); }, [actionFilter, startDate, endDate]);

  function groupByDate(items: ActivityLog[]) {
    const groups: Record<string, ActivityLog[]> = {};
    for (const item of items) {
      const date = item.created_at.slice(0, 10);
      if (!groups[date]) groups[date] = [];
      groups[date].push(item);
    }
    return groups;
  }

  const grouped = groupByDate(logs);

  return (
    <div className="px-4 md:px-8 pt-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold text-white mb-6 tracking-tight">Activity Log</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="bg-card border border-white/10 rounded-xl px-3 py-1.5 text-white/70 text-sm outline-none"
        >
          <option value="">All actions</option>
          {ACTION_OPTIONS.map((a) => (
            <option key={a} value={a}>{ACTION_LABELS[a]?.label ?? a}</option>
          ))}
        </select>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="bg-card border border-white/10 rounded-xl px-3 py-1.5 text-white/70 text-sm outline-none"
        />
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="bg-card border border-white/10 rounded-xl px-3 py-1.5 text-white/70 text-sm outline-none"
        />
        {(actionFilter || startDate || endDate) && (
          <button
            onClick={() => { setActionFilter(''); setStartDate(''); setEndDate(''); }}
            className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/50 text-sm rounded-xl transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center text-white/30 text-sm py-12">Loading…</div>
      ) : logs.length === 0 ? (
        <div className="text-center text-white/25 text-sm py-12">No activity found</div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([date, items]) => (
            <section key={date}>
              <h2 className="text-xs font-semibold text-white/35 uppercase tracking-widest mb-3">
                {format(parseISO(date), 'EEEE, MMMM d')}
              </h2>
              <div className="space-y-2">
                {items.map((log) => {
                  const config = ACTION_LABELS[log.action] ?? { label: log.action, color: 'text-white/50', icon: '·' };
                  const taskEntry = log.tasks?.refined_entry ?? log.tasks?.original_entry;
                  return (
                    <motion.div
                      key={log.id}
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-start gap-3 bg-card border border-white/6 rounded-xl px-4 py-3"
                    >
                      <span className={`text-sm flex-shrink-0 ${config.color}`}>{config.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-medium ${config.color}`}>{config.label}</span>
                          <span className="text-white/20 text-xs">·</span>
                          <span className="text-white/30 text-xs">{log.actor}</span>
                          <span className="text-white/20 text-xs ml-auto">
                            {format(parseISO(log.created_at), 'HH:mm')}
                          </span>
                        </div>
                        {taskEntry && (
                          <Link href={`/task/${log.task_id}`} className="text-sm text-white/55 hover:text-white/80 transition-colors mt-0.5 block truncate">
                            {taskEntry}
                          </Link>
                        )}
                        {log.meta && Object.keys(log.meta).length > 0 && (
                          <p className="text-xs text-white/25 mt-0.5 truncate">
                            {JSON.stringify(log.meta).slice(0, 80)}
                          </p>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
