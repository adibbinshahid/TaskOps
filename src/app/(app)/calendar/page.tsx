'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  addDays,
  addMonths,
  subMonths,
  isToday,
  isSameMonth,
} from 'date-fns';
import type { Task } from '@/types';
import TaskCard from '@/components/TaskCard';

export default function CalendarPage() {
  const [current, setCurrent] = useState(() => new Date());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const monthStart = startOfMonth(current);
  const monthEnd = endOfMonth(current);

  useEffect(() => {
    const start = format(monthStart, 'yyyy-MM-dd');
    const end = format(monthEnd, 'yyyy-MM-dd');
    setLoading(true);
    fetch(`/api/tasks?start_date=${start}&end_date=${end}`)
      .then((r) => r.json())
      .then((data) => setTasks(data as Task[]))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current.getFullYear(), current.getMonth()]);

  // Build calendar grid
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const cells: Date[] = [];
  let day = gridStart;
  while (cells.length < 42) {
    cells.push(day);
    day = addDays(day, 1);
  }

  function countForDate(date: Date) {
    const dateStr = format(date, 'yyyy-MM-dd');
    return tasks.filter((t) => t.assigned_date === dateStr && t.status !== 'deleted' && t.status !== 'completed').length;
  }

  function tasksForDate(dateStr: string) {
    return tasks.filter((t) => t.assigned_date === dateStr && t.status !== 'deleted');
  }

  const selectedTasks = selected ? tasksForDate(selected) : [];

  return (
    <div className="px-4 md:px-8 pt-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-white tracking-tight">
          {format(current, 'MMMM yyyy')}
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrent((d) => subMonths(d, 1))}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
          >
            ←
          </button>
          <button
            onClick={() => setCurrent(new Date())}
            className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/50 hover:text-white text-xs rounded-xl transition-colors"
          >
            Today
          </button>
          <button
            onClick={() => setCurrent((d) => addMonths(d, 1))}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
          >
            →
          </button>
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-2">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div key={d} className="text-center text-xs font-semibold text-white/30 uppercase tracking-wider py-2">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cellDate, i) => {
          const dateStr = format(cellDate, 'yyyy-MM-dd');
          const count = countForDate(cellDate);
          const inMonth = isSameMonth(cellDate, current);
          const today = isToday(cellDate);
          const sel = selected === dateStr;

          return (
            <motion.button
              key={i}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setSelected(sel ? null : dateStr)}
              className={`relative aspect-square flex flex-col items-center justify-center rounded-xl text-sm font-medium transition-colors ${
                sel
                  ? 'bg-accent/20 border border-accent/40 text-white'
                  : today
                  ? 'bg-accent/10 border border-accent/20 text-white'
                  : inMonth
                  ? 'hover:bg-white/5 text-white/70'
                  : 'text-white/20'
              }`}
            >
              <span>{format(cellDate, 'd')}</span>
              {count > 0 && inMonth && (
                <span
                  className={`absolute bottom-1.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full ${
                    sel ? 'bg-white' : 'bg-accent/60'
                  }`}
                />
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Day task panel */}
      <AnimatePresence>
        {selected && (
          <motion.div
            key={selected}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="mt-6 bg-card border border-white/8 rounded-2xl p-4"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-white">
                {format(new Date(selected + 'T00:00:00'), 'EEEE, MMMM d')}
              </h2>
              <button
                onClick={() => setSelected(null)}
                className="text-white/30 hover:text-white/60 transition-colors"
              >
                ✕
              </button>
            </div>
            {loading ? (
              <p className="text-white/30 text-sm text-center py-4">Loading…</p>
            ) : selectedTasks.length === 0 ? (
              <p className="text-white/25 text-sm text-center py-4">No tasks this day</p>
            ) : (
              <div className="space-y-2">
                {selectedTasks.map((task) => (
                  <TaskCard key={task.id} task={task} showDate={false} />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
