'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Task, Group } from '@/types';
import { supabase } from '@/lib/supabase';
import StatusChip from '@/components/StatusChip';
import Link from 'next/link';

export default function ReviewPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState<string | null>(null);

  async function loadData() {
    const [tasksRes, groupsRes] = await Promise.all([
      fetch('/api/tasks?status=needs_review'),
      fetch('/api/groups'),
    ]);
    const [tasksData, groupsData] = await Promise.all([
      tasksRes.json(),
      groupsRes.json(),
    ]);
    setTasks(tasksData);
    setGroups(groupsData);
    setLoading(false);
  }

  useEffect(() => {
    loadData();

    const channel = supabase
      .channel('review-tasks')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        loadData();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  async function updateField(taskId: string, field: string, value: unknown) {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, [field]: value } : t))
    );
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

  return (
    <div className="px-4 md:px-8 pt-8 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <h1 className="text-2xl font-semibold text-white tracking-tight">Needs Review</h1>
        {tasks.length > 0 && (
          <span className="px-2 py-0.5 bg-amber-500/15 text-amber-400 text-xs font-semibold rounded-full">
            {tasks.length}
          </span>
        )}
      </div>

      {loading ? (
        <div className="text-center text-white/30 text-sm py-12">Loading…</div>
      ) : tasks.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-24"
        >
          <p className="text-3xl mb-3">✅</p>
          <p className="text-white/40 text-sm">All clear — nothing to review</p>
        </motion.div>
      ) : (
        <AnimatePresence initial={false}>
          {tasks.map((task) => (
            <motion.div
              key={task.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              transition={{ duration: 0.25 }}
              className="mb-4 bg-card border border-amber-500/20 rounded-2xl p-4"
            >
              {/* AI reasoning */}
              {task.ai_reasoning && (
                <p className="text-xs text-white/30 mb-3 leading-relaxed border-l-2 border-white/10 pl-3">
                  AI: {task.ai_reasoning}
                </p>
              )}

              {/* Entry (editable) */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-white/40 mb-1.5 uppercase tracking-wider">Entry</label>
                <textarea
                  defaultValue={task.refined_entry ?? task.original_entry}
                  rows={2}
                  onBlur={(e) => {
                    const v = e.currentTarget.value.trim();
                    if (v && v !== (task.refined_entry ?? task.original_entry)) {
                      updateField(task.id, 'refined_entry', v);
                    }
                  }}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white/80 text-sm outline-none focus:border-accent/40"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                {/* Group selector */}
                <div>
                  <label className="block text-xs font-medium text-white/40 mb-1.5 uppercase tracking-wider">Group</label>
                  <select
                    value={task.group_id ?? ''}
                    onChange={(e) => updateField(task.id, 'group_id', e.target.value || null)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white/80 text-sm outline-none"
                  >
                    <option value="">Unassigned</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                </div>

                {/* Date selector */}
                <div>
                  <label className="block text-xs font-medium text-white/40 mb-1.5 uppercase tracking-wider">Date</label>
                  <input
                    type="date"
                    value={task.assigned_date ?? ''}
                    onChange={(e) => updateField(task.id, 'assigned_date', e.target.value || null)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white/80 text-sm outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <StatusChip status={task.status} />
                  {task.ai_confidence !== null && (
                    <span className="text-xs text-white/30">
                      {task.ai_confidence}% confidence
                    </span>
                  )}
                  <Link href={`/task/${task.id}`} className="text-xs text-accent/60 hover:text-accent transition-colors">
                    Details →
                  </Link>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => dismiss(task)}
                    className="px-3 py-1.5 text-xs text-white/40 hover:text-red-400 transition-colors rounded-xl hover:bg-red-500/10"
                  >
                    Dismiss
                  </button>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => approve(task)}
                    disabled={approving === task.id}
                    className="px-4 py-1.5 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white text-xs font-medium rounded-xl transition-colors"
                  >
                    {approving === task.id ? '…' : 'Approve'}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      )}
    </div>
  );
}
