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
      whileHover={{ scale: dragging ? 1 : 1.008, y: dragging ? 0 : -1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className={`group relative flex gap-3 rounded-2xl p-3.5 transition-all ${
        dragging
          ? 'glass-strong ring-1 ring-accent/30'
          : 'glass-card hover:shadow-card-md'
      } ${isCompleted ? 'opacity-60' : ''}`}
    >
      {/* Checkbox */}
      {onComplete && task.status !== 'processing' && (
        <button
          onClick={onComplete}
          className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
            isCompleted
              ? 'bg-emerald-500 border-emerald-500 shadow-sm'
              : 'border-t3/60 hover:border-accent hover:scale-110'
          }`}
          aria-label="Toggle complete"
        >
          {isCompleted && (
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} className="w-2.5 h-2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>
      )}

      <div className="flex-1 min-w-0">
        <Link href={`/task/${task.id}`} className="block">
          <p className={`text-sm leading-snug line-clamp-2 ${
            isCompleted ? 'text-t3 line-through italic' : 'text-t1'
          }`}>
            {entry}
          </p>
        </Link>

        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <StatusChip status={task.status} />
          {showGroup && task.groups?.name && (
            <span className="text-xs text-t3 glass-sm px-2 py-0.5 rounded-full font-medium">
              {task.groups.name}
            </span>
          )}
          {showDate && task.assigned_date && (
            <span className="text-xs text-t3 font-medium">{task.assigned_date}</span>
          )}
          {task.is_recurring && (
            <span className="text-xs text-accent/70">↻</span>
          )}
        </div>
      </div>

      {/* Delete */}
      {onDelete && (
        <button
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 transition-all flex-shrink-0 self-start mt-0.5 text-t3 hover:text-red-400 hover:scale-110"
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
