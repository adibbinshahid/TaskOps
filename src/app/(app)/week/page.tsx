'use client';

import { useState, useEffect } from 'react';
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
import { motion } from 'framer-motion';
import {
  format,
  startOfWeek,
  addDays,
  addWeeks,
  subWeeks,
  isToday,
  isBefore,
  startOfDay,
} from 'date-fns';
import type { Task } from '@/types';
import Modal from '@/components/Modal';
import StatusChip from '@/components/StatusChip';
import Link from 'next/link';

function DraggableTask({ task }: { task: Task }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });
  const entry = task.refined_entry ?? task.original_entry;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`mb-2 cursor-grab active:cursor-grabbing touch-none ${isDragging ? 'opacity-30' : ''}`}
    >
      <div className="bg-card border border-white/8 rounded-xl p-2.5 hover:border-white/14 transition-colors">
        <p className="text-xs text-white/80 line-clamp-2">{entry}</p>
        <div className="mt-1.5">
          <StatusChip status={task.status} />
        </div>
      </div>
    </div>
  );
}

function DayColumn({ date, tasks }: { date: Date; tasks: Task[] }) {
  const dateStr = format(date, 'yyyy-MM-dd');
  const { isOver, setNodeRef } = useDroppable({ id: dateStr });
  const today = isToday(date);
  const past = isBefore(startOfDay(date), startOfDay(new Date()));

  return (
    <div
      ref={setNodeRef}
      className={`flex-1 min-w-0 rounded-2xl border transition-colors min-h-[200px] ${
        isOver ? 'border-accent/50 bg-accent/5' : 'border-white/8 bg-white/2'
      }`}
    >
      <div
        className={`px-3 py-2.5 border-b border-white/8 sticky top-0 rounded-t-2xl ${
          today ? 'bg-accent/10' : 'bg-[#13141A]'
        }`}
      >
        <p className={`text-xs font-semibold uppercase tracking-wider ${today ? 'text-accent' : 'text-white/40'}`}>
          {format(date, 'EEE')}
        </p>
        <p className={`text-lg font-semibold ${today ? 'text-white' : past ? 'text-white/30' : 'text-white/70'}`}>
          {format(date, 'd')}
        </p>
      </div>
      <div className="p-2">
        {tasks.map((task) => (
          <DraggableTask key={task.id} task={task} />
        ))}
        {tasks.length === 0 && (
          <p className="text-center text-white/15 text-xs py-6">—</p>
        )}
      </div>
    </div>
  );
}

export default function WeekPage() {
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [pendingMove, setPendingMove] = useState<{ task: Task; targetDate: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const weekEnd = addDays(weekStart, 6);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  async function loadTasks() {
    const start = format(weekStart, 'yyyy-MM-dd');
    const end = format(weekEnd, 'yyyy-MM-dd');
    const res = await fetch(`/api/tasks?start_date=${start}&end_date=${end}`);
    const data = await res.json() as Task[];
    setTasks(data);
  }

  useEffect(() => {
    loadTasks().finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart.toISOString()]);

  function handleDragStart(event: DragStartEvent) {
    const task = tasks.find((t) => t.id === event.active.id);
    setActiveTask(task ?? null);
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

    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, assigned_date: targetDate } : t))
    );

    await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ field: 'assigned_date', value: targetDate }),
    });
  }

  function getTasksForDay(date: Date) {
    const dateStr = format(date, 'yyyy-MM-dd');
    return tasks.filter((t) => t.assigned_date === dateStr && t.status !== 'deleted');
  }

  const activeEntry = activeTask?.refined_entry ?? activeTask?.original_entry ?? '';

  return (
    <div className="px-4 md:px-8 pt-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-white tracking-tight">Week</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setWeekStart((d) => subWeeks(d, 1))}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
          >
            ←
          </button>
          <span className="text-sm text-white/50 min-w-[120px] text-center">
            {format(weekStart, 'MMM d')} – {format(weekEnd, 'MMM d')}
          </span>
          <button
            onClick={() => setWeekStart((d) => addWeeks(d, 1))}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
          >
            →
          </button>
          <button
            onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
            className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/50 hover:text-white text-xs rounded-xl transition-colors"
          >
            Today
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24 text-white/30 text-sm">Loading…</div>
      ) : (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-7 gap-2 overflow-x-auto pb-4">
            {days.map((day) => (
              <DayColumn key={day.toISOString()} date={day} tasks={getTasksForDay(day)} />
            ))}
          </div>

          <DragOverlay>
            {activeTask && (
              <div className="bg-card border border-accent/40 rounded-xl p-2.5 shadow-2xl shadow-accent/20 rotate-2 w-40">
                <p className="text-xs text-white/90 line-clamp-2">{activeEntry}</p>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {/* Confirmation modal */}
      <Modal
        open={!!pendingMove}
        onClose={() => setPendingMove(null)}
        title="Move task?"
      >
        {pendingMove && (
          <div>
            <p className="text-white/60 text-sm mb-1">
              {pendingMove.task.refined_entry ?? pendingMove.task.original_entry}
            </p>
            <p className="text-white/40 text-xs mb-6">
              Move to {format(new Date(pendingMove.targetDate + 'T00:00:00'), 'EEEE, MMMM d')}?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPendingMove(null)}
                className="flex-1 py-2 rounded-xl border border-white/10 text-white/60 text-sm hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={confirmMove}
                className="flex-1 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors"
              >
                Move
              </motion.button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
