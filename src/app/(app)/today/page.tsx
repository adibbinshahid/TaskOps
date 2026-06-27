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
  const [loading, setLoading] = useState(true);
  const { showUndo } = useUndo();
  const { open: openNewTask } = useNewTask();

  async function loadTasks() {
    const res = await fetch(`/api/tasks?date=${todayStr()}`);
    const data = await res.json() as Task[];
    setTasks(data.filter((t) => t.status !== 'deleted'));
  }

  useEffect(() => {
    loadTasks().finally(() => setLoading(false));
    const channel = supabase
      .channel('today-tasks')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tasks' }, (payload) => {
        const updated = payload.new as Task;
        setTasks((prev) => {
          const exists = prev.some((t) => t.id === updated.id);
          if (!exists) return prev;
          return prev.map((t) => t.id === updated.id ? { ...t, ...updated } : t);
        });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tasks' }, () => loadTasks())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggleComplete(task: Task) {
    const newStatus = task.status === 'completed' ? 'active' : 'completed';
    const previousStatus = task.status;
    setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, status: newStatus } : t));
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

  const processingTasks = tasks.filter((t) => t.status === 'processing');
  const groups: Record<string, Task[]> = {};
  for (const task of tasks.filter((t) => t.status !== 'deleted' && t.status !== 'processing')) {
    const name = task.groups?.name ?? 'Ungrouped';
    if (!groups[name]) groups[name] = [];
    groups[name].push(task);
  }

  const completed = tasks.filter((t) => t.status === 'completed').length;
  const total = tasks.filter((t) => t.status !== 'deleted' && t.status !== 'processing').length;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
  const label = format(new Date(), 'EEEE, MMMM d');

  return (
    <div className="px-5 md:px-8 pt-8 max-w-3xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-6"
      >
        <div>
          <h1 className="text-2xl font-bold text-t1 tracking-tight">Today&apos;s Focus</h1>
          <p className="text-t3 text-sm mt-0.5">{label}</p>
        </div>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={openNewTask}
          className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-h text-white text-sm font-semibold rounded-2xl transition-colors shadow-sm"
        >
          New Task
        </motion.button>
      </motion.div>

      {/* Progress */}
      {!loading && total > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="glass-card rounded-3xl px-5 py-4 mb-6"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-t2">
              {completed === total ? '🎉 All done!' : `${completed} of ${total} tasks complete`}
            </span>
            <span className="text-sm font-bold text-accent">{progress}%</span>
          </div>
          <div className="h-2.5 glass-sm rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              className="h-full bg-gradient-to-r from-accent to-violet-500 rounded-full"
            />
          </div>
        </motion.div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="glass-card rounded-2xl h-16 skeleton" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {processingTasks.length > 0 && (
            <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <h2 className="text-xs font-semibold text-t3 uppercase tracking-widest mb-3 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse inline-block" />
                Organising
              </h2>
              <div className="space-y-2">
                {processingTasks.map((task) => (
                  <TaskCard key={task.id} task={task} showDate={false} showGroup={false} />
                ))}
              </div>
            </motion.section>
          )}

          {Object.keys(groups).length === 0 && processingTasks.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-24">
              <p className="text-4xl mb-3">✨</p>
              <p className="text-t2 text-sm font-medium">No tasks for today</p>
              <button onClick={openNewTask} className="mt-3 text-accent text-sm hover:text-accent-h transition-colors font-medium">
                Add something
              </button>
            </motion.div>
          ) : (
            <>
              {Object.entries(groups).map(([groupName, groupTasks], gi) => (
                <motion.section
                  key={groupName}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: gi * 0.06 }}
                >
                  <h2 className="text-xs font-semibold text-t3 uppercase tracking-widest mb-3">{groupName}</h2>
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
