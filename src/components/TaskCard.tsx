'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import StatusChip from './StatusChip';
import type { Task } from '@/types';

interface TaskCardProps {
  task: Task;
  showDate?: boolean;
  showGroup?: boolean;
  onComplete?: () => void;
  onDelete?: () => void;
  dragging?: boolean;
}

export default function TaskCard({
  task,
  showDate = true,
  showGroup = true,
  onComplete,
  onDelete,
  dragging = false,
}: TaskCardProps) {
  const entry = task.refined_entry ?? task.original_entry;
  const isCompleted = task.status === 'completed';

  return (
    <motion.div
      layout
      whileHover={{ scale: dragging ? 1 : 1.01 }}
      className={`group relative flex gap-3 bg-card border border-white/8 rounded-xl p-3.5 transition-shadow ${
        dragging ? 'shadow-2xl shadow-accent/20 ring-1 ring-accent/30' : 'hover:border-white/14'
      }`}
    >
      {/* Complete checkbox */}
      {onComplete && task.status !== 'processing' && (
        <button
          onClick={onComplete}
          className={`mt-0.5 flex-shrink-0 w-4.5 h-4.5 rounded-full border transition-colors ${
            isCompleted
              ? 'bg-emerald-500/80 border-emerald-500'
              : 'border-white/20 hover:border-accent/60'
          }`}
          aria-label="Toggle complete"
        >
          {isCompleted && (
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} className="w-full h-full p-0.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>
      )}

      <div className="flex-1 min-w-0">
        <Link href={`/task/${task.id}`} className="block">
          <p className={`text-sm leading-snug line-clamp-2 ${isCompleted ? 'text-white/35 line-through' : 'text-white/90'}`}>
            {entry}
          </p>
        </Link>

        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <StatusChip status={task.status} />
          {showGroup && task.groups?.name && (
            <span className="text-xs text-white/40 bg-white/5 px-2 py-0.5 rounded-full">
              {task.groups.name}
            </span>
          )}
          {showDate && task.assigned_date && (
            <span className="text-xs text-white/35">{task.assigned_date}</span>
          )}
          {task.is_recurring && (
            <span className="text-xs text-violet-400/70">↻</span>
          )}
        </div>
      </div>

      {/* Delete button (hover reveal) */}
      {onDelete && (
        <button
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 self-start mt-0.5 text-white/25 hover:text-red-400"
          aria-label="Delete task"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </motion.div>
  );
}
