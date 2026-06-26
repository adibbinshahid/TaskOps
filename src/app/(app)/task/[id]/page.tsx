'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { format, parseISO } from 'date-fns';
import type { Task, Group, ActivityLog, ActivityAction } from '@/types';
import StatusChip from '@/components/StatusChip';
import { useUndo } from '@/components/UndoProvider';

const ACTION_ICONS: Partial<Record<ActivityAction, string>> = {
  created: '✦',
  ai_classified: '◆',
  ai_scheduled: '◇',
  edited: '✎',
  moved: '↑',
  reminded: '⏰',
  completed: '✓',
  deleted: '✕',
  undone: '↩',
};

export default function TaskDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const { showUndo } = useUndo();

  const [task, setTask] = useState<Task | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [editEntry, setEditEntry] = useState('');

  async function loadAll() {
    const [taskRes, groupsRes, logsRes] = await Promise.all([
      fetch(`/api/tasks/${id}`),
      fetch('/api/groups'),
      fetch(`/api/activity?task_id=${id}&limit=50`),
    ]);
    const [taskData, groupsData, logsData] = await Promise.all([
      taskRes.json(),
      groupsRes.json(),
      logsRes.json(),
    ]);
    setTask(taskData);
    setEditEntry(taskData.refined_entry ?? taskData.original_entry ?? '');
    setGroups(groupsData);
    setLogs(logsData);
    setLoading(false);
  }

  useEffect(() => { loadAll(); }, [id]);

  async function patch(field: string, value: unknown) {
    if (!task) return;
    const oldValue = task[field as keyof Task];
    setTask((prev) => prev ? { ...prev, [field]: value } : prev);

    await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ field, value }),
    });

    showUndo({
      label: `${field} updated`,
      onUndo: async () => {
        await fetch(`/api/tasks/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ field, value: oldValue }),
        });
        loadAll();
      },
    });

    loadAll();
  }

  async function deleteTask() {
    if (!confirm('Delete this task?')) return;
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    showUndo({
      label: 'Task deleted',
      onUndo: async () => {
        await fetch(`/api/tasks/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ field: 'status', value: task?.status ?? 'active' }),
        });
      },
    });
    router.push('/today');
  }

  async function undoLastEdit() {
    const lastEdit = logs.find((l) => l.action === 'edited' || l.action === 'moved');
    if (!lastEdit?.meta) return;
    const { field, old_value } = lastEdit.meta as { field: string; old_value: unknown };
    await patch(field, old_value);
    await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ field: 'status', value: task?.status }),
    });
    // Log undone action
    await fetch(`/api/activity`, { method: 'GET' }); // trigger reload
    loadAll();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-dvh text-white/30 text-sm">
        Loading…
      </div>
    );
  }

  if (!task) {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh gap-4">
        <p className="text-white/40 text-sm">Task not found</p>
        <button onClick={() => router.back()} className="text-accent text-sm">Go back</button>
      </div>
    );
  }

  const hasEdits = logs.some((l) => l.action === 'edited' || l.action === 'moved');

  return (
    <div className="px-4 md:px-8 pt-8 max-w-2xl mx-auto">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-white/40 hover:text-white/70 text-sm mb-6 transition-colors"
      >
        ← Back
      </button>

      <div className="bg-card border border-white/8 rounded-2xl p-6 mb-6">
        <div className="flex items-start justify-between gap-4 mb-6">
          <StatusChip status={task.status} />
          <div className="flex items-center gap-2">
            {hasEdits && (
              <button
                onClick={undoLastEdit}
                className="text-xs text-white/40 hover:text-white/70 transition-colors px-3 py-1 rounded-lg hover:bg-white/5"
              >
                Undo last edit
              </button>
            )}
            <button
              onClick={deleteTask}
              className="text-xs text-red-400/60 hover:text-red-400 transition-colors px-3 py-1 rounded-lg hover:bg-red-500/10"
            >
              Delete
            </button>
          </div>
        </div>

        {/* Entry */}
        <div className="mb-5">
          <label className="block text-xs font-medium text-white/35 uppercase tracking-wider mb-2">Entry</label>
          <textarea
            value={editEntry}
            onChange={(e) => setEditEntry(e.target.value)}
            onBlur={() => {
              const v = editEntry.trim();
              if (v && v !== (task.refined_entry ?? task.original_entry)) {
                patch('refined_entry', v);
              }
            }}
            rows={3}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white/85 text-sm outline-none focus:border-accent/40 transition-colors leading-relaxed"
          />
          {task.original_entry !== task.refined_entry && task.refined_entry && (
            <p className="text-xs text-white/25 mt-2">
              Original: {task.original_entry}
            </p>
          )}
        </div>

        {/* Group + Date */}
        <div className="grid grid-cols-2 gap-4 mb-5">
          <div>
            <label className="block text-xs font-medium text-white/35 uppercase tracking-wider mb-2">Group</label>
            <select
              value={task.group_id ?? ''}
              onChange={(e) => patch('group_id', e.target.value || null)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white/80 text-sm outline-none focus:border-accent/40"
            >
              <option value="">Unassigned</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-white/35 uppercase tracking-wider mb-2">Date</label>
            <input
              type="date"
              value={task.assigned_date ?? ''}
              onChange={(e) => patch('assigned_date', e.target.value || null)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white/80 text-sm outline-none focus:border-accent/40"
            />
          </div>
        </div>

        {/* Reminder */}
        <div className="mb-5">
          <label className="block text-xs font-medium text-white/35 uppercase tracking-wider mb-2">Reminder</label>
          <input
            type="datetime-local"
            value={task.reminder_time ? task.reminder_time.slice(0, 16) : ''}
            onChange={(e) => patch('reminder_time', e.target.value ? e.target.value + ':00Z' : null)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white/80 text-sm outline-none focus:border-accent/40"
          />
        </div>

        {/* Status */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-white/35 uppercase tracking-wider mb-2">Status</label>
          <select
            value={task.status}
            onChange={(e) => patch('status', e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white/80 text-sm outline-none focus:border-accent/40"
          >
            {['processing', 'active', 'needs_review', 'completed', 'deleted'].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* AI info */}
        {task.ai_reasoning && (
          <div className="border-t border-white/8 pt-4 mt-4">
            <p className="text-xs text-white/25 leading-relaxed">
              <span className="text-violet-400/60 font-medium">AI reasoning: </span>
              {task.ai_reasoning}
            </p>
            {task.ai_confidence !== null && (
              <p className="text-xs text-white/20 mt-1">Confidence: {task.ai_confidence}%</p>
            )}
          </div>
        )}

        {/* Recurring */}
        {task.is_recurring && (
          <div className="border-t border-white/8 pt-4 mt-4 flex items-center gap-2">
            <span className="text-violet-400 text-sm">↻</span>
            <span className="text-white/50 text-sm">Recurring: {task.recurring_pattern}</span>
          </div>
        )}

        <div className="border-t border-white/8 pt-4 mt-4 flex items-center gap-4 text-xs text-white/25">
          <span>Source: {task.source}</span>
          <span>Created: {format(parseISO(task.created_at), 'MMM d, yyyy HH:mm')}</span>
        </div>
      </div>

      {/* Audit timeline */}
      <div>
        <h2 className="text-xs font-semibold text-white/35 uppercase tracking-widest mb-4">Timeline</h2>
        <div className="relative">
          <div className="absolute left-3.5 top-0 bottom-0 w-px bg-white/8" />
          <div className="space-y-4">
            {logs.map((log) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex gap-3 relative"
              >
                <div className="w-7 h-7 flex-shrink-0 flex items-center justify-center bg-card border border-white/10 rounded-full text-xs relative z-10">
                  {ACTION_ICONS[log.action] ?? '·'}
                </div>
                <div className="flex-1 min-w-0 pt-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-medium text-white/60">{log.action}</span>
                    <span className="text-xs text-white/25">{log.actor}</span>
                    <span className="text-xs text-white/20 ml-auto">
                      {format(parseISO(log.created_at), 'MMM d HH:mm')}
                    </span>
                  </div>
                  {log.meta && Object.keys(log.meta).length > 0 && (
                    <p className="text-xs text-white/25 mt-0.5 break-all">
                      {JSON.stringify(log.meta).slice(0, 120)}
                    </p>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
