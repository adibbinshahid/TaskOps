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
import { useNewTask } from '@/components/NewTaskProvider';

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
      <div className="bg-surface border border-t1/[0.06] rounded-xl p-2.5 hover:border-t1/[0.12] hover:shadow-card transition-all">
        <p className="text-xs text-t1 line-clamp-2">{entry}</p>
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
        isOver
          ? 'border-accent/40 bg-accent/5'
          : today
          ? 'border-accent/20 bg-accent/[0.03]'
          : 'border-t1/[0.06] bg-surface'
      }`}
    >
      <div
        className={`px-3 py-2.5 border-b border-t1/[0.06] sticky top-0 rounded-t-2xl ${
          today ? 'bg-accent/[0.06]' : 'bg-bg'
        }`}
      >
        <p className={`text-xs font-semibold uppercase tracking-wider ${today ? 'text-accent' : 'text-t3'}`}>
          {format(date, 'EEE')}
        </p>
        <p className={`text-lg font-bold ${today ? 'text-accent' : past ? 'text-t3' : 'text-t1'}`}>
          {format(date, 'd')}
        </p>
      </div>
      <div className="p-2">
        {tasks.map((task) => (
          <DraggableTask key={task.id} task={task} />
        ))}
        {tasks.length === 0 && (
          <p className="text-center text-t3 text-xs py-6">—</p>
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
  const { open: openNewTask } = useNewTask();

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

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, assigned_date: targetDate } : t))
    );

    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field: 'assigned_date', value: targetDate }),
      });

      if (!res.ok) {
        const err = await res.text();
        console.error('Move failed:', res.status, err);
        // Revert optimistic update
        setTasks((prev) =>
          prev.map((t) => (t.id === task.id ? { ...t, assigned_date: task.assigned_date } : t))
        );
        alert(`Move failed (${res.status}). Check console for details.`);
        return;
      }

      // Re-sync from DB to confirm
      await loadTasks();
    } catch (err) {
      console.error('Move error:', err);
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, assigned_date: task.assigned_date } : t))
      );
      alert('Move failed — network error.');
    }
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
        <h1 className="text-2xl font-bold text-t1 tracking-tight">Week</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekStart((d) => subWeeks(d, 1))}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-s2 hover:bg-t1/[0.08] text-t2 hover:text-t1 transition-colors"
          >
            ←
          </button>
          <span className="text-sm text-t2 min-w-[120px] text-center font-medium">
            {format(weekStart, 'MMM d')} – {format(weekEnd, 'MMM d')}
          </span>
          <button
            onClick={() => setWeekStart((d) => addWeeks(d, 1))}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-s2 hover:bg-t1/[0.08] text-t2 hover:text-t1 transition-colors"
          >
            →
          </button>
          <button
            onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
            className="px-3 py-1.5 bg-s2 hover:bg-t1/[0.08] text-t2 hover:text-t1 text-xs rounded-xl transition-colors font-medium"
          >
            This week
          </button>
          <button
            onClick={openNewTask}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-h text-white text-xs font-semibold rounded-xl transition-colors shadow-sm"
          >
            + New
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24 text-t3 text-sm">Loading…</div>
      ) : (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-7 gap-2 overflow-x-auto pb-4">
            {days.map((day) => (
              <DayColumn key={day.toISOString()} date={day} tasks={getTasksForDay(day)} />
            ))}
          </div>

          <DragOverlay>
            {activeTask && (
              <div className="bg-surface border border-accent/40 rounded-xl p-2.5 shadow-card-md rotate-2 w-40">
                <p className="text-xs text-t1 line-clamp-2">{activeEntry}</p>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {/* Confirmation modal */}
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
              <button
                onClick={() => setPendingMove(null)}
                className="flex-1 py-2 rounded-xl border border-t1/[0.08] text-t2 text-sm hover:bg-s2 transition-colors"
              >
                Cancel
              </button>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={confirmMove}
                className="flex-1 py-2 rounded-xl bg-accent hover:bg-accent-h text-white text-sm font-semibold transition-colors"
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
