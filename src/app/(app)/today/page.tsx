'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabase';
import TaskCard from '@/components/TaskCard';
import { useUndo } from '@/components/UndoProvider';
import type { Task } from '@/types';

function todayStr() {
  return format(new Date(), 'yyyy-MM-dd');
}

export default function TodayPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const { showUndo } = useUndo();

  async function loadTasks() {
    const res = await fetch(`/api/tasks?date=${todayStr()}`);
    const data = await res.json() as Task[];
    setTasks(data.filter((t) => t.status !== 'deleted'));
  }

  useEffect(() => {
    loadTasks().finally(() => setLoading(false));

    const channel = supabase
      .channel('today-tasks')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        loadTasks();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggleComplete(task: Task) {
    const newStatus = task.status === 'completed' ? 'active' : 'completed';
    const previousStatus = task.status;

    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t))
    );

    await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ field: 'status', value: newStatus }),
    });

    if (newStatus === 'completed') {
      showUndo({
        label: 'Task marked complete',
        onUndo: async () => {
          await fetch(`/api/tasks/${task.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ field: 'status', value: previousStatus }),
          });
          loadTasks();
        },
      });
    }
  }

  async function deleteTask(task: Task) {
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    await fetch(`/api/tasks/${task.id}`, { method: 'DELETE' });

    showUndo({
      label: 'Task deleted',
      onUndo: async () => {
        await fetch(`/api/tasks/${task.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ field: 'status', value: task.status }),
        });
        loadTasks();
      },
    });
  }

  // Group tasks by group name
  const groups: Record<string, Task[]> = {};
  for (const task of tasks.filter((t) => t.status !== 'deleted')) {
    const name = task.groups?.name ?? 'Ungrouped';
    if (!groups[name]) groups[name] = [];
    groups[name].push(task);
  }

  const today = todayStr();
  const label = format(new Date(), 'EEEE, MMMM d');

  return (
    <div className="px-4 md:px-8 pt-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white tracking-tight">Today</h1>
        <p className="text-white/40 text-sm mt-0.5">{label}</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24 text-white/30 text-sm">Loading…</div>
      ) : Object.keys(groups).length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-24 text-white/25 text-sm"
        >
          No tasks for today. Go capture something!
        </motion.div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groups).map(([groupName, groupTasks]) => (
            <motion.section
              key={groupName}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <h2 className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-3">
                {groupName}
              </h2>
              <AnimatePresence>
                <div className="space-y-2">
                  {groupTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      showDate={false}
                      showGroup={false}
                      onComplete={() => toggleComplete(task)}
                      onDelete={() => deleteTask(task)}
                    />
                  ))}
                </div>
              </AnimatePresence>
            </motion.section>
          ))}
        </div>
      )}
    </div>
  );
}
