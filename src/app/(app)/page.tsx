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
  iconBg: string;
  iconColor: string;
  icon: React.ReactNode;
}

function StatCard({ label, value, sub, iconBg, iconColor, icon }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-surface border border-t1/[0.06] rounded-2xl p-5 shadow-card"
    >
      <div className="flex items-start justify-between mb-3">
        <p className="text-t3 text-sm font-medium">{label}</p>
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${iconBg}`}>
          <span className={iconColor}>{icon}</span>
        </div>
      </div>
      <p className="text-t1 text-3xl font-bold tracking-tight">{value}</p>
      <p className="text-t3 text-xs mt-1">{sub}</p>
    </motion.div>
  );
}

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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, loadData)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allTasks   = tasks.filter((t) => t.status !== 'deleted');
  const completed  = tasks.filter((t) => t.status === 'completed');
  const active     = tasks.filter((t) => t.status === 'active');
  const processing = tasks.filter((t) => t.status === 'processing');

  const dateLabel = format(new Date(), 'EEEE, MMMM d, yyyy');

  const statCards: StatCardProps[] = [
    {
      label: 'Tasks Today',
      value: allTasks.length,
      sub: `${completed.length} of ${allTasks.length} completed`,
      iconBg: 'bg-blue-500/10',
      iconColor: 'text-blue-500',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      label: 'In Progress',
      value: active.length,
      sub: 'active tasks',
      iconBg: 'bg-accent/10',
      iconColor: 'text-accent',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
    },
    {
      label: 'Completed',
      value: completed.length,
      sub: 'done today',
      iconBg: 'bg-emerald-500/10',
      iconColor: 'text-emerald-500',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ),
    },
    {
      label: 'Organising',
      value: processing.length,
      sub: 'AI processing',
      iconBg: 'bg-violet-500/10',
      iconColor: 'text-violet-500',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="px-5 md:px-8 pt-8 pb-12 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-t1 tracking-tight">
          {greeting()}, Adib! 👋
        </h1>
        <p className="text-t3 text-sm mt-1">Let&apos;s focus and get things done.</p>
        <p className="text-t3 text-xs mt-0.5">{dateLabel}</p>
      </div>

      {/* Stats */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-surface border border-t1/[0.06] rounded-2xl p-5 h-28 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {statCards.map((s) => (
            <StatCard key={s.label} {...s} />
          ))}
        </div>
      )}

      {/* Body: 2-col */}
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
              {[...Array(5)].map((_, i) => (
                <div key={i} className="bg-surface border border-t1/[0.06] rounded-xl h-14 animate-pulse" />
              ))}
            </div>
          ) : allTasks.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-surface border border-t1/[0.06] rounded-2xl p-10 text-center shadow-card"
            >
              <p className="text-4xl mb-3">✨</p>
              <p className="text-t2 text-sm font-medium">No tasks scheduled for today</p>
              <button
                onClick={openNewTask}
                className="mt-3 text-accent text-sm hover:text-accent-h transition-colors font-medium"
              >
                + Add your first task
              </button>
            </motion.div>
          ) : (
            <AnimatePresence initial={false}>
              <div className="space-y-2">
                {processing.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-3 bg-violet-500/5 border border-violet-500/15 rounded-xl px-4 py-3"
                  >
                    <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse flex-shrink-0" />
                    <p className="text-t2 text-sm">
                      {processing.length} task{processing.length > 1 ? 's' : ''} being organised by AI…
                    </p>
                  </motion.div>
                )}

                {[...active, ...completed].map((task) => (
                  <motion.div
                    key={task.id}
                    layout
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`flex items-center gap-3 bg-surface border border-t1/[0.06] rounded-xl px-4 py-3 hover:border-accent/20 hover:shadow-card transition-all ${
                      task.status === 'completed' ? 'opacity-55' : ''
                    }`}
                  >
                    <div
                      className={`flex-shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                        task.status === 'completed'
                          ? 'bg-emerald-500 border-emerald-500'
                          : 'border-t3'
                      }`}
                    >
                      {task.status === 'completed' && (
                        <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} className="w-2.5 h-2.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>

                    <Link href={`/task/${task.id}`} className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${
                        task.status === 'completed' ? 'text-t3 line-through' : 'text-t1'
                      }`}>
                        {task.refined_entry ?? task.original_entry}
                      </p>
                    </Link>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {task.groups?.name && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent font-medium">
                          {task.groups.name}
                        </span>
                      )}
                      {task.reminder_time && (
                        <span className="text-t3 text-xs tabular-nums">
                          {format(new Date(task.reminder_time), 'h:mm a')}
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
          <div className="bg-surface border border-t1/[0.06] rounded-2xl p-4 shadow-card">
            <h2 className="text-sm font-semibold text-t1 mb-1">Quick Capture</h2>
            <p className="text-t3 text-xs mb-4">What&apos;s on your mind?</p>
            <button
              onClick={openNewTask}
              className="w-full flex items-center gap-2.5 bg-s2 hover:bg-accent/5 border border-t1/[0.06] hover:border-accent/20 rounded-xl px-4 py-3 text-t3 text-sm transition-all text-left group"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 flex-shrink-0 group-hover:text-accent transition-colors">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              <span className="group-hover:text-t1 transition-colors">Add a task or note…</span>
            </button>
          </div>

          {/* Projects */}
          {groups.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-t1">Projects</h2>
                <Link href="/groups" className="text-xs text-accent hover:text-accent-h transition-colors font-medium">
                  View all →
                </Link>
              </div>
              <div className="space-y-2">
                {groups.slice(0, 5).map((group, i) => {
                  const colors = [
                    'bg-blue-500/10 text-blue-500',
                    'bg-violet-500/10 text-violet-500',
                    'bg-emerald-500/10 text-emerald-500',
                    'bg-amber-500/10 text-amber-500',
                    'bg-rose-500/10 text-rose-500',
                  ];
                  const c = colors[i % colors.length];
                  return (
                    <Link
                      key={group.id}
                      href="/groups"
                      className="flex items-center gap-3 bg-surface border border-t1/[0.06] rounded-xl px-3.5 py-3 hover:border-accent/20 hover:shadow-card transition-all group"
                    >
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${c.split(' ')[0]}`}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={`w-3.5 h-3.5 ${c.split(' ')[1]}`}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                        </svg>
                      </div>
                      <span className="text-t2 text-sm group-hover:text-t1 transition-colors font-medium flex-1 truncate">
                        {group.name}
                      </span>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4 text-t3 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
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
