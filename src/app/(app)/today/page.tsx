'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabase';
import TaskCard from '@/components/TaskCard';
import { useUndo } from '@/components/UndoProvider';
import { useNewTask } from '@/components/NewTaskProvider';
import type { Task } from '@/types';

function todayStr() {
  return format(new Date(), 'yyyy-MM-dd');
}

export default function TodayPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [processing, setProcessing] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const { showUndo } = useUndo();
  const { open: openNewTask } = useNewTask();

  async function loadTasks() {
    const [todayRes, processingRes] = await Promise.all([
      fetch(`/api/tasks?date=${todayStr()}`),
      fetch('/api/tasks?status=processing'),
    ]);
    const [todayData, processingData] = await Promise.all([
      todayRes.json() as Promise<Task[]>,
      processingRes.json() as Promise<Task[]>,
    ]);
    setTasks(todayData.filter((t) => t.status !== 'deleted'));
    setProcessing(processingData);
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

  const groups: Record<string, Task[]> = {};
  for (const task of tasks.filter((t) => t.status !== 'deleted')) {
    const name = task.groups?.name ?? 'Ungrouped';
    if (!groups[name]) groups[name] = [];
    groups[name].push(task);
  }

  const label = format(new Date(), 'EEEE, MMMM d');

  return (
    <div className="px-5 md:px-8 pt-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-t1 tracking-tight">Today</h1>
          <p className="text-t3 text-sm mt-0.5">{label}</p>
        </div>
        <button
          onClick={openNewTask}
          className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-h text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New Task
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24 text-t3 text-sm">Loading…</div>
      ) : (
        <div className="space-y-8">
          {/* Organising section */}
          {processing.length > 0 && (
            <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <h2 className="text-xs font-semibold text-t3 uppercase tracking-widest mb-3 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse inline-block" />
                Organising
              </h2>
              <div className="space-y-2">
                {processing.map((task) => (
                  <TaskCard key={task.id} task={task} showDate={false} showGroup={false} />
                ))}
              </div>
            </motion.section>
          )}

          {Object.keys(groups).length === 0 && processing.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-24"
            >
              <p className="text-4xl mb-3">✨</p>
              <p className="text-t2 text-sm font-medium">No tasks for today</p>
              <button
                onClick={openNewTask}
                className="mt-3 text-accent text-sm hover:text-accent-h transition-colors font-medium"
              >
                + Add something
              </button>
            </motion.div>
          ) : (
            <>
              {Object.entries(groups).map(([groupName, groupTasks]) => (
                <motion.section
                  key={groupName}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <h2 className="text-xs font-semibold text-t3 uppercase tracking-widest mb-3">
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
            </>
          )}
        </div>
      )}
    </div>
  );
}
