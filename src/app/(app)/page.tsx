'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useNewTask } from '@/components/NewTaskProvider';
import type { Task, Group } from '@/types';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function todayStr() {
  return format(new Date(), 'yyyy-MM-dd');
}

interface StatCardProps {
  label: string;
  value: number;
  sub: string;
  gradient: string;
  icon: React.ReactNode;
  delay: number;
}

function StatCard({ label, value, sub, gradient, icon, delay }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: 'spring', stiffness: 300, damping: 28 }}
      className="glass-card rounded-3xl p-5 relative overflow-hidden"
    >
      {/* Subtle gradient tint */}
      <div className={`absolute inset-0 opacity-[0.06] ${gradient} rounded-3xl`} />
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-3">
          <p className="text-t3 text-xs font-semibold uppercase tracking-wider">{label}</p>
          <div className={`w-9 h-9 rounded-2xl flex items-center justify-center ${gradient} opacity-80`}>
            {icon}
          </div>
        </div>
        <p className="text-t1 text-3xl font-bold tracking-tight">{value}</p>
        <p className="text-t3 text-xs mt-1">{sub}</p>
      </div>
    </motion.div>
  );
}

const GROUP_COLORS = [
  'bg-blue-500/15 text-blue-500',
  'bg-violet-500/15 text-violet-500',
  'bg-emerald-500/15 text-emerald-500',
  'bg-amber-500/15 text-amber-500',
  'bg-rose-500/15 text-rose-500',
];

export default function DashboardPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const { open: openNewTask } = useNewTask();

  async function loadData() {
    const today = todayStr();
    const [tasksRes, groupsRes] = await Promise.all([
      fetch(`/api/tasks?date=${today}`),
      fetch('/api/groups'),
    ]);
    const [tasksData, groupsData] = await Promise.all([
      tasksRes.json() as Promise<Task[]>,
      groupsRes.json() as Promise<Group[]>,
    ]);
    setTasks(Array.isArray(tasksData) ? tasksData : []);
    setGroups(Array.isArray(groupsData) ? groupsData : []);
  }

  useEffect(() => {
    loadData().finally(() => setLoading(false));
    const channel = supabase
      .channel('dashboard-tasks')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tasks' }, (payload) => {
        const updated = payload.new as Task;
        setTasks((prev) => {
          const exists = prev.some((t) => t.id === updated.id);
          if (!exists) return prev;
          return prev.map((t) => t.id === updated.id ? { ...t, ...updated } : t);
        });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tasks' }, loadData)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allTasks   = tasks.filter((t) => t.status !== 'deleted');
  const completed  = tasks.filter((t) => t.status === 'completed');
  const active     = tasks.filter((t) => t.status === 'active');
  const processing = tasks.filter((t) => t.status === 'processing');
  const progress   = allTasks.length > 0 ? Math.round((completed.length / allTasks.length) * 100) : 0;

  const dateLabel = format(new Date(), 'EEEE, MMMM d, yyyy');

  const statCards: (StatCardProps & { key: string })[] = [
    {
      key: 'today',
      label: 'Tasks Today',
      value: allTasks.length,
      sub: `${completed.length} of ${allTasks.length} completed`,
      gradient: 'bg-blue-500',
      delay: 0,
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={1.8} className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
    },
    {
      key: 'active',
      label: 'In Progress',
      value: active.length,
      sub: 'active tasks',
      gradient: 'bg-accent',
      delay: 0.05,
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={1.8} className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
    },
    {
      key: 'done',
      label: 'Completed',
      value: completed.length,
      sub: 'done today',
      gradient: 'bg-emerald-500',
      delay: 0.1,
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={1.8} className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>,
    },
    {
      key: 'proc',
      label: 'Organising',
      value: processing.length,
      sub: 'AI processing',
      gradient: 'bg-violet-500',
      delay: 0.15,
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={1.8} className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>,
    },
  ];

  return (
    <div className="px-5 md:px-8 pt-8 pb-12 max-w-6xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-2xl font-bold text-t1 tracking-tight">
          {greeting()}, Adib! 👋
        </h1>
        <p className="text-t3 text-sm mt-1">{dateLabel}</p>

        {/* Progress bar */}
        {!loading && allTasks.length > 0 && (
          <div className="mt-4 glass-card rounded-2xl px-4 py-3 flex items-center gap-4">
            <div className="flex-1">
              <div className="flex justify-between text-xs text-t3 mb-1.5">
                <span>Today&apos;s progress</span>
                <span className="font-semibold text-accent">{progress}%</span>
              </div>
              <div className="h-2 glass-sm rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                  className="h-full bg-gradient-to-r from-accent to-violet-500 rounded-full"
                />
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold text-t1">{completed.length}/{allTasks.length}</p>
              <p className="text-[10px] text-t3">tasks</p>
            </div>
          </div>
        )}
      </motion.div>

      {/* Stats grid */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="glass-card rounded-3xl p-5 h-28 skeleton" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {statCards.map((s) => {
            const { key, ...rest } = s;
            return <StatCard key={key} {...rest} />;
          })}
        </div>
      )}

      {/* Body */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's plan */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-t1">Today&apos;s Plan</h2>
            <Link href="/today" className="text-sm text-accent hover:text-accent-h transition-colors font-medium">
              View all →
            </Link>
          </div>

          {loading ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="glass-card rounded-2xl h-14 skeleton" />
              ))}
            </div>
          ) : allTasks.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="glass-card rounded-3xl p-10 text-center"
            >
              <p className="text-4xl mb-3">✨</p>
              <p className="text-t2 text-sm font-medium">No tasks scheduled for today</p>
              <button
                onClick={openNewTask}
                className="mt-3 text-accent text-sm hover:text-accent-h transition-colors font-medium"
              >
                Add your first task
              </button>
            </motion.div>
          ) : (
            <AnimatePresence initial={false}>
              <div className="space-y-2">
                {processing.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-3 glass-card rounded-2xl px-4 py-3 border border-violet-400/20"
                  >
                    <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse flex-shrink-0" />
                    <p className="text-t2 text-sm">
                      {processing.length} task{processing.length > 1 ? 's' : ''} being organised by AI…
                    </p>
                  </motion.div>
                )}

                {[...active, ...completed].map((task, i) => (
                  <motion.div
                    key={task.id}
                    layout
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className={`flex items-center gap-3 glass-card rounded-2xl px-4 py-3 hover:shadow-card-md transition-all ${
                      task.status === 'completed' ? 'opacity-55' : ''
                    }`}
                  >
                    <div className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                      task.status === 'completed'
                        ? 'bg-emerald-500 border-emerald-500'
                        : 'border-t3/50'
                    }`}>
                      {task.status === 'completed' && (
                        <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} className="w-2.5 h-2.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>

                    <Link href={`/task/${task.id}`} className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${
                        task.status === 'completed' ? 'text-t3 line-through italic' : 'text-t1'
                      }`}>
                        {task.refined_entry ?? task.original_entry}
                      </p>
                    </Link>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {task.groups?.name && (
                        <span className="text-xs px-2 py-0.5 rounded-full glass-sm text-accent font-medium">
                          {task.groups.name}
                        </span>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </AnimatePresence>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {/* Quick capture */}
          <div className="glass-card rounded-3xl p-4">
            <h2 className="text-sm font-semibold text-t1 mb-1">Quick Capture</h2>
            <p className="text-t3 text-xs mb-4">What&apos;s on your mind?</p>
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={openNewTask}
              className="w-full flex items-center gap-2.5 glass-sm rounded-2xl px-4 py-3 text-t3 text-sm transition-all text-left group hover:border-accent/30"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 flex-shrink-0 group-hover:text-accent transition-colors">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              <span className="group-hover:text-t1 transition-colors">Add a task or note…</span>
            </motion.button>
          </div>

          {/* Projects */}
          {groups.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-t1">Projects</h2>
                <Link href="/task-type" className="text-xs text-accent hover:text-accent-h transition-colors font-medium">
                  View all →
                </Link>
              </div>
              <div className="space-y-2">
                {groups.slice(0, 5).map((group, i) => {
                  const c = GROUP_COLORS[i % GROUP_COLORS.length];
                  const [bgClass, textClass] = c.split(' ');
                  return (
                    <Link key={group.id} href="/task-type">
                      <motion.div
                        whileHover={{ x: 2 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                        className="flex items-center gap-3 glass-card rounded-2xl px-3.5 py-3 hover:shadow-card-md transition-all group"
                      >
                        <div className={`w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 ${bgClass}`}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={`w-3.5 h-3.5 ${textClass}`}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                          </svg>
                        </div>
                        <span className="text-t2 text-sm group-hover:text-t1 transition-colors font-medium flex-1 truncate">
                          {group.name}
                        </span>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4 text-t3 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </motion.div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
