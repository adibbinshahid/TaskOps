'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { motion, AnimatePresence } from 'framer-motion';
import {
  format,
  startOfWeek,
  addDays,
  addWeeks,
  subWeeks,
  isToday,
  isBefore,
  startOfDay,
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths,
  isSameMonth,
  parseISO,
} from 'date-fns';
import type { Task } from '@/types';
import Modal from '@/components/Modal';
import StatusChip from '@/components/StatusChip';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useNewTask } from '@/components/NewTaskProvider';

type ViewMode = 'week' | 'month' | 'list';

// ── Checkmark button ─────────────────────────────
function CheckButton({ done, onToggle }: { done: boolean; onToggle: () => void }) {
  return (
    <motion.button
      whileTap={{ scale: 0.85 }}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggle(); }}
      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
        done ? 'bg-emerald-500 border-emerald-500' : 'border-t3 hover:border-accent'
      }`}
    >
      {done && (
        <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} className="w-3 h-3">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      )}
    </motion.button>
  );
}

// ── Week view ────────────────────────────────────
function DraggableTask({ task, onToggle }: { task: Task; onToggle: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });
  const entry = task.refined_entry ?? task.original_entry;
  const done = task.status === 'completed';

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`mb-2 cursor-grab active:cursor-grabbing touch-none ${isDragging ? 'opacity-30' : ''}`}
    >
      <Link href={`/task/${task.id}`} onClick={(e) => { if (isDragging) e.preventDefault(); }}>
        <div className={`glass-card rounded-xl p-2.5 hover:shadow-card-md transition-all ${done ? 'opacity-50' : ''}`}>
          <div className="flex items-start gap-2">
            <CheckButton done={done} onToggle={() => onToggle(task.id)} />
            <p className={`text-xs text-t1 line-clamp-2 flex-1 ${done ? 'line-through italic' : ''}`}>{entry}</p>
          </div>
          <div className="mt-1.5 pl-7">
            <StatusChip status={task.status} />
          </div>
        </div>
      </Link>
    </div>
  );
}

function DayColumn({
  date, tasks, onToggle,
}: { date: Date; tasks: Task[]; onToggle: (id: string) => void }) {
  const dateStr = format(date, 'yyyy-MM-dd');
  const { isOver, setNodeRef } = useDroppable({ id: dateStr });
  const today = isToday(date);
  const past = isBefore(startOfDay(date), startOfDay(new Date()));

  return (
    <div
      ref={setNodeRef}
      className={`flex-1 min-w-0 rounded-2xl border transition-colors min-h-[200px] ${
        isOver ? 'border-accent/40 bg-accent/5' : today ? 'border-accent/20 bg-accent/[0.03]' : 'border-t1/[0.06] bg-surface/60'
      }`}
    >
      <div className={`px-3 py-2.5 border-b border-t1/[0.06] sticky top-14 rounded-t-2xl backdrop-blur-sm ${today ? 'bg-accent/[0.06]' : 'bg-bg/40'}`}>
        <p className={`text-xs font-semibold uppercase tracking-wider ${today ? 'text-accent' : 'text-t3'}`}>
          {format(date, 'EEE')}
        </p>
        <p className={`text-lg font-bold ${today ? 'text-accent' : past ? 'text-t3' : 'text-t1'}`}>
          {format(date, 'd')}
        </p>
      </div>
      <div className="p-2">
        {tasks.map((task) => (
          <DraggableTask key={task.id} task={task} onToggle={onToggle} />
        ))}
        {tasks.length === 0 && <p className="text-center text-t3 text-xs py-6">—</p>}
      </div>
    </div>
  );
}

// ── Month view ───────────────────────────────────
function MonthView({
  month, tasks, onToggle,
}: { month: Date; tasks: Task[]; onToggle: (id: string) => void }) {
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const cells: Date[] = [];
  let cur = gridStart;
  while (cur <= monthEnd || cells.length % 7 !== 0) {
    cells.push(cur);
    cur = addDays(cur, 1);
    if (cells.length > 42) break;
  }

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <div className="grid grid-cols-7 border-b border-t1/[0.06]">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div key={d} className="text-center text-xs font-semibold text-t3 py-2 uppercase tracking-wider">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((day, i) => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const dayTasks = tasks.filter((t) => t.assigned_date === dateStr && t.status !== 'deleted');
          const today = isToday(day);
          const inMonth = isSameMonth(day, month);

          return (
            <div
              key={i}
              className={`min-h-[80px] p-1.5 border-t border-l border-t1/[0.04] ${
                !inMonth ? 'opacity-30' : ''
              } ${today ? 'bg-accent/[0.04]' : ''}`}
            >
              <div className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-semibold mb-1 ${
                today ? 'bg-accent text-white' : 'text-t2'
              }`}>
                {format(day, 'd')}
              </div>
              <div className="space-y-0.5">
                {dayTasks.slice(0, 3).map((task) => {
                  const done = task.status === 'completed';
                  return (
                    <Link key={task.id} href={`/task/${task.id}`}>
                      <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] truncate transition-colors ${
                        done ? 'opacity-50 line-through italic text-t3' : 'bg-accent/10 text-accent hover:bg-accent/15'
                      }`}>
                        <button
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggle(task.id); }}
                          className="w-3 h-3 flex-shrink-0"
                        >
                          {done ? '✓' : '○'}
                        </button>
                        {(task.refined_entry ?? task.original_entry)?.slice(0, 20)}
                      </div>
                    </Link>
                  );
                })}
                {dayTasks.length > 3 && (
                  <p className="text-[10px] text-t3 pl-1">+{dayTasks.length - 3} more</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── List view ────────────────────────────────────
function ListView({
  tasks, onToggle,
}: { tasks: Task[]; onToggle: (id: string) => void }) {
  const grouped: Record<string, Task[]> = {};
  const noDate: Task[] = [];

  for (const t of tasks) {
    if (!t.assigned_date) { noDate.push(t); continue; }
    if (!grouped[t.assigned_date]) grouped[t.assigned_date] = [];
    grouped[t.assigned_date].push(t);
  }

  const sortedDates = Object.keys(grouped).sort();

  if (tasks.length === 0) {
    return <p className="text-t3 text-center py-16 text-sm">No tasks found</p>;
  }

  return (
    <div className="space-y-6">
      {sortedDates.map((date) => (
        <section key={date}>
          <h3 className="text-xs font-semibold text-t3 uppercase tracking-widest mb-2">
            {format(parseISO(date), 'EEEE, MMMM d')}
            {isToday(parseISO(date)) && <span className="ml-2 text-accent">Today</span>}
          </h3>
          <div className="space-y-2">
            {grouped[date].map((task) => {
              const done = task.status === 'completed';
              return (
                <motion.div
                  key={task.id}
                  layout
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Link href={`/task/${task.id}`}>
                    <div className={`glass-card rounded-xl px-4 py-3 flex items-center gap-3 hover:shadow-card-md transition-all ${done ? 'opacity-50' : ''}`}>
                      <CheckButton done={done} onToggle={() => onToggle(task.id)} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm text-t1 truncate ${done ? 'line-through italic' : ''}`}>
                          {task.refined_entry ?? task.original_entry}
                        </p>
                        <p className="text-xs text-t3 mt-0.5">{task.groups?.name ?? 'Unassigned'}</p>
                      </div>
                      <StatusChip status={task.status} />
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </section>
      ))}
      {noDate.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold text-t3 uppercase tracking-widest mb-2">No date</h3>
          <div className="space-y-2">
            {noDate.map((task) => {
              const done = task.status === 'completed';
              return (
                <Link key={task.id} href={`/task/${task.id}`}>
                  <div className={`glass-card rounded-xl px-4 py-3 flex items-center gap-3 hover:shadow-card-md transition-all ${done ? 'opacity-50' : ''}`}>
                    <CheckButton done={done} onToggle={() => onToggle(task.id)} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm text-t1 truncate ${done ? 'line-through italic' : ''}`}>
                        {task.refined_entry ?? task.original_entry}
                      </p>
                      <p className="text-xs text-t3 mt-0.5">{task.groups?.name ?? 'Unassigned'}</p>
                    </div>
                    <StatusChip status={task.status} />
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

// ── Main page ────────────────────────────────────
export default function AllTasksPage() {
  const [view, setView] = useState<ViewMode>('week');
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [month, setMonth] = useState(() => new Date());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [pendingMove, setPendingMove] = useState<{ task: Task; targetDate: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const { open: openNewTask } = useNewTask();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      let url = '/api/tasks';
      if (view === 'week') {
        const start = format(weekStart, 'yyyy-MM-dd');
        const end = format(addDays(weekStart, 6), 'yyyy-MM-dd');
        url = `/api/tasks?start_date=${start}&end_date=${end}`;
      } else if (view === 'month') {
        const start = format(startOfMonth(month), 'yyyy-MM-dd');
        const end = format(endOfMonth(month), 'yyyy-MM-dd');
        url = `/api/tasks?start_date=${start}&end_date=${end}`;
      }
      const res = await fetch(url);
      setTasks(await res.json());
    } finally {
      setLoading(false);
    }
  }, [view, weekStart, month]);

  useEffect(() => {
    loadTasks();
    const channel = supabase
      .channel('all-tasks-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => loadTasks())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadTasks]);

  async function toggleDone(taskId: string) {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const newStatus = task.status === 'completed' ? 'active' : 'completed';
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: newStatus } : t));
    await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ field: 'status', value: newStatus }),
    });
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveTask(tasks.find((t) => t.id === event.active.id) ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveTask(null);
    if (!over) return;
    const task = tasks.find((t) => t.id === active.id);
    const targetDate = over.id as string;
    if (task && targetDate !== task.assigned_date) {
      setPendingMove({ task, targetDate });
    }
  }

  async function confirmMove() {
    if (!pendingMove) return;
    const { task, targetDate } = pendingMove;
    setPendingMove(null);
    setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, assigned_date: targetDate } : t));
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field: 'assigned_date', value: targetDate }),
      });
      if (!res.ok) {
        setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, assigned_date: task.assigned_date } : t));
        alert(`Move failed (${res.status})`);
        return;
      }
      await loadTasks();
    } catch {
      setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, assigned_date: task.assigned_date } : t));
      alert('Move failed — network error.');
    }
  }

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekEnd = addDays(weekStart, 6);

  const VIEWS: { id: ViewMode; label: string }[] = [
    { id: 'week', label: 'Week' },
    { id: 'month', label: 'Month' },
    { id: 'list', label: 'List' },
  ];

  return (
    <div className="px-4 md:px-8 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        {/* View tabs */}
        <div className="flex items-center gap-1 glass-sm rounded-xl p-1">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                view === v.id
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-t2 hover:text-t1'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>

        {/* Nav controls */}
        <div className="flex items-center gap-2">
          {view === 'week' && (
            <>
              <button onClick={() => setWeekStart((d) => subWeeks(d, 1))}
                className="w-8 h-8 flex items-center justify-center rounded-xl glass-sm hover:bg-accent/10 text-t2 hover:text-t1 transition-colors">
                ←
              </button>
              <span className="text-sm text-t2 min-w-[120px] text-center font-medium">
                {format(weekStart, 'MMM d')} – {format(weekEnd, 'MMM d')}
              </span>
              <button onClick={() => setWeekStart((d) => addWeeks(d, 1))}
                className="w-8 h-8 flex items-center justify-center rounded-xl glass-sm hover:bg-accent/10 text-t2 hover:text-t1 transition-colors">
                →
              </button>
              <button onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
                className="px-3 py-1.5 glass-sm hover:bg-accent/10 text-t2 hover:text-t1 text-xs rounded-xl transition-colors font-medium">
                Today
              </button>
            </>
          )}
          {view === 'month' && (
            <>
              <button onClick={() => setMonth((m) => subMonths(m, 1))}
                className="w-8 h-8 flex items-center justify-center rounded-xl glass-sm hover:bg-accent/10 text-t2 hover:text-t1 transition-colors">
                ←
              </button>
              <span className="text-sm text-t2 min-w-[120px] text-center font-medium">
                {format(month, 'MMMM yyyy')}
              </span>
              <button onClick={() => setMonth((m) => addMonths(m, 1))}
                className="w-8 h-8 flex items-center justify-center rounded-xl glass-sm hover:bg-accent/10 text-t2 hover:text-t1 transition-colors">
                →
              </button>
            </>
          )}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={openNewTask}
            className="flex items-center gap-1.5 px-4 py-2 bg-accent hover:bg-accent-h text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
          >
            New Task
          </motion.button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24 text-t3 text-sm">Loading…</div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
          >
            {view === 'week' && (
              <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                <div className="grid grid-cols-7 gap-2 overflow-x-auto pb-4">
                  {weekDays.map((day) => (
                    <DayColumn
                      key={day.toISOString()}
                      date={day}
                      tasks={tasks.filter((t) => t.assigned_date === format(day, 'yyyy-MM-dd') && t.status !== 'deleted')}
                      onToggle={toggleDone}
                    />
                  ))}
                </div>
                <DragOverlay>
                  {activeTask && (
                    <div className="glass-card rounded-xl p-2.5 shadow-card-md rotate-2 w-40">
                      <p className="text-xs text-t1 line-clamp-2">{activeTask.refined_entry ?? activeTask.original_entry}</p>
                    </div>
                  )}
                </DragOverlay>
              </DndContext>
            )}
            {view === 'month' && (
              <MonthView month={month} tasks={tasks} onToggle={toggleDone} />
            )}
            {view === 'list' && (
              <ListView tasks={tasks.filter((t) => t.status !== 'deleted')} onToggle={toggleDone} />
            )}
          </motion.div>
        </AnimatePresence>
      )}

      <Modal open={!!pendingMove} onClose={() => setPendingMove(null)} title="Move task?">
        {pendingMove && (
          <div>
            <p className="text-t2 text-sm mb-1 line-clamp-2">
              {pendingMove.task.refined_entry ?? pendingMove.task.original_entry}
            </p>
            <p className="text-t3 text-xs mb-6">
              Move to {format(new Date(pendingMove.targetDate + 'T00:00:00'), 'EEEE, MMMM d')}?
            </p>
            <div className="flex gap-2">
              <button onClick={() => setPendingMove(null)}
                className="flex-1 py-2 rounded-xl border border-t1/[0.08] text-t2 text-sm hover:bg-s2 transition-colors">
                Cancel
              </button>
              <motion.button whileTap={{ scale: 0.97 }} onClick={confirmMove}
                className="flex-1 py-2 rounded-xl bg-accent hover:bg-accent-h text-white text-sm font-semibold transition-colors">
                Move
              </motion.button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
