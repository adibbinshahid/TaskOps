'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, parseISO } from 'date-fns';
import type { Task, Group, ActivityLog, ActivityAction } from '@/types';
import { supabase } from '@/lib/supabase';
import StatusChip from '@/components/StatusChip';
import Link from 'next/link';

type Tab = 'review' | 'activity';

// ── Review sub-tab ───────────────────────────────
const inputCls = 'w-full bg-s2 border border-t1/[0.08] rounded-xl px-3 py-2 text-t1 text-sm outline-none focus:border-accent/40 transition-colors';

function ReviewTab() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState<string | null>(null);

  async function loadData() {
    const [tr, gr] = await Promise.all([
      fetch('/api/tasks?status=needs_review'),
      fetch('/api/groups'),
    ]);
    setTasks(await tr.json());
    setGroups(await gr.json());
    setLoading(false);
  }

  useEffect(() => {
    loadData();
    const ch = supabase
      .channel('ar-review')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, loadData)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  async function updateField(taskId: string, field: string, value: unknown) {
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, [field]: value } : t));
    await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ field, value }),
    });
  }

  async function approve(task: Task) {
    setApproving(task.id);
    await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ field: 'status', value: 'active' }),
    });
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    setApproving(null);
  }

  async function dismiss(task: Task) {
    await fetch(`/api/tasks/${task.id}`, { method: 'DELETE' });
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
  }

  if (loading) return <div className="text-center text-t3 text-sm py-12">Loading…</div>;

  if (tasks.length === 0) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-24">
        <p className="text-4xl mb-3">✅</p>
        <p className="text-t2 text-sm font-medium">All clear — nothing to review</p>
      </motion.div>
    );
  }

  return (
    <AnimatePresence initial={false}>
      {tasks.map((task) => (
        <motion.div
          key={task.id}
          layout
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, height: 0, marginBottom: 0 }}
          transition={{ duration: 0.25 }}
          className="mb-4 glass-card rounded-2xl p-4 border border-amber-500/20"
        >
          {task.ai_reasoning && (
            <p className="text-xs text-t3 mb-3 leading-relaxed border-l-2 border-t1/10 pl-3">
              AI: {task.ai_reasoning}
            </p>
          )}

          <div className="mb-4">
            <label className="block text-xs font-semibold text-t3 mb-1.5 uppercase tracking-wider">Entry</label>
            <textarea
              defaultValue={task.refined_entry ?? task.original_entry}
              rows={2}
              onBlur={(e) => {
                const v = e.currentTarget.value.trim();
                if (v && v !== (task.refined_entry ?? task.original_entry)) {
                  updateField(task.id, 'refined_entry', v);
                }
              }}
              className={inputCls}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-xs font-semibold text-t3 mb-1.5 uppercase tracking-wider">Task Type</label>
              <select
                value={task.group_id ?? ''}
                onChange={(e) => updateField(task.id, 'group_id', e.target.value || null)}
                className={inputCls}
              >
                <option value="">Unassigned</option>
                {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-t3 mb-1.5 uppercase tracking-wider">Date</label>
              <input
                type="date"
                value={task.assigned_date ?? ''}
                onChange={(e) => updateField(task.id, 'assigned_date', e.target.value || null)}
                className={inputCls}
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              <StatusChip status={task.status} />
              {task.ai_confidence !== null && (
                <span className="text-xs text-t3">{task.ai_confidence}% confidence</span>
              )}
              <Link href={`/task/${task.id}`} className="text-xs text-accent/70 hover:text-accent transition-colors">
                Details →
              </Link>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => dismiss(task)}
                className="px-3 py-1.5 text-xs text-t3 hover:text-red-500 transition-colors rounded-xl hover:bg-red-500/10">
                Dismiss
              </button>
              <motion.button whileTap={{ scale: 0.97 }} onClick={() => approve(task)}
                disabled={approving === task.id}
                className="px-4 py-1.5 bg-accent hover:bg-accent-h disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-colors">
                {approving === task.id ? '…' : 'Approve'}
              </motion.button>
            </div>
          </div>
        </motion.div>
      ))}
    </AnimatePresence>
  );
}

// ── Activity sub-tab ─────────────────────────────
const ACTION_LABELS: Record<ActivityAction, { label: string; color: string; icon: string }> = {
  created:       { label: 'Created',       color: 'text-blue-500',    icon: '✦' },
  ai_classified: { label: 'AI classified', color: 'text-violet-500',  icon: '◆' },
  ai_scheduled:  { label: 'AI scheduled',  color: 'text-indigo-500',  icon: '◇' },
  edited:        { label: 'Edited',        color: 'text-t2',          icon: '✎' },
  moved:         { label: 'Moved',         color: 'text-cyan-500',    icon: '↑' },
  reminded:      { label: 'Reminded',      color: 'text-amber-500',   icon: '⏰' },
  completed:     { label: 'Completed',     color: 'text-emerald-500', icon: '✓' },
  deleted:       { label: 'Deleted',       color: 'text-red-500',     icon: '✕' },
  undone:        { label: 'Undone',        color: 'text-orange-500',  icon: '↩' },
};

const ACTION_OPTIONS = Object.keys(ACTION_LABELS) as ActivityAction[];

function ActivityTab() {
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

  useEffect(() => { loadLogs(); }, [actionFilter, startDate, endDate]); // eslint-disable-line

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
  const filterCls = 'bg-surface border border-t1/[0.08] rounded-xl px-3 py-1.5 text-t1 text-sm outline-none focus:border-accent/40 transition-colors shadow-card';

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-6">
        <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className={filterCls}>
          <option value="">All actions</option>
          {ACTION_OPTIONS.map((a) => (
            <option key={a} value={a}>{ACTION_LABELS[a].label}</option>
          ))}
        </select>
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={filterCls} />
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={filterCls} />
        {(actionFilter || startDate || endDate) && (
          <button onClick={() => { setActionFilter(''); setStartDate(''); setEndDate(''); }}
            className="px-3 py-1.5 glass-sm hover:bg-accent/10 text-t2 text-sm rounded-xl transition-colors font-medium">
            Clear
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center text-t3 text-sm py-12">Loading…</div>
      ) : logs.length === 0 ? (
        <div className="text-center text-t3 text-sm py-12">No activity found</div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([date, items]) => (
            <section key={date}>
              <h2 className="text-xs font-semibold text-t3 uppercase tracking-widest mb-3">
                {format(parseISO(date), 'EEEE, MMMM d')}
              </h2>
              <div className="space-y-2">
                {items.map((log) => {
                  const cfg = ACTION_LABELS[log.action] ?? { label: log.action, color: 'text-t3', icon: '·' };
                  const taskEntry = log.tasks?.refined_entry ?? log.tasks?.original_entry;
                  return (
                    <motion.div key={log.id} initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }}
                      className="flex items-start gap-3 glass-card rounded-xl px-4 py-3">
                      <span className={`text-sm flex-shrink-0 mt-0.5 ${cfg.color}`}>{cfg.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
                          <span className="text-t3 text-xs">·</span>
                          <span className="text-t3 text-xs">{log.actor}</span>
                          <span className="text-t3 text-xs ml-auto tabular-nums">
                            {format(parseISO(log.created_at), 'HH:mm')}
                          </span>
                        </div>
                        {taskEntry && (
                          <Link href={`/task/${log.task_id}`}
                            className="text-sm text-t2 hover:text-t1 transition-colors mt-0.5 block truncate">
                            {taskEntry}
                          </Link>
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

// ── Main page ────────────────────────────────────
export default function ActivityReviewPage() {
  const [tab, setTab] = useState<Tab>('review');
  const [reviewCount, setReviewCount] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/tasks?status=needs_review')
      .then((r) => r.json())
      .then((d) => setReviewCount(Array.isArray(d) ? d.length : 0))
      .catch(() => {});
  }, []);

  const TABS: { id: Tab; label: string }[] = [
    { id: 'review', label: 'Review' },
    { id: 'activity', label: 'Activity' },
  ];

  return (
    <div className="px-5 md:px-8 pt-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold text-t1 tracking-tight">Activity & Review</h1>
        {reviewCount !== null && reviewCount > 0 && (
          <span className="px-2.5 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-bold rounded-full">
            {reviewCount} pending
          </span>
        )}
      </div>

      {/* Sub-tabs */}
      <div className="flex items-center gap-1 glass-sm rounded-xl p-1 mb-6 w-fit">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`relative px-5 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.id ? 'text-accent' : 'text-t2 hover:text-t1'
            }`}
          >
            {tab === t.id && (
              <motion.div
                layoutId="ar-tab-indicator"
                className="absolute inset-0 bg-accent/10 rounded-lg"
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              />
            )}
            <span className="relative z-10">{t.label}</span>
            {t.id === 'review' && reviewCount !== null && reviewCount > 0 && (
              <span className="relative z-10 ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400">
                {reviewCount}
              </span>
            )}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18 }}
        >
          {tab === 'review' ? <ReviewTab /> : <ActivityTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
