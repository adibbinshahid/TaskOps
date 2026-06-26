'use client';

import type { TaskStatus } from '@/types';

const CONFIG: Record<TaskStatus, { label: string; classes: string }> = {
  processing: {
    label: 'Organizing…',
    classes: 'bg-white/8 text-white/50 animate-pulse',
  },
  active: {
    label: 'Active',
    classes: 'bg-accent/15 text-accent',
  },
  needs_review: {
    label: 'Review',
    classes: 'bg-amber-500/15 text-amber-400',
  },
  completed: {
    label: 'Done',
    classes: 'bg-emerald-500/15 text-emerald-400',
  },
  deleted: {
    label: 'Deleted',
    classes: 'bg-white/5 text-white/25 line-through',
  },
};

export default function StatusChip({ status }: { status: TaskStatus }) {
  const { label, classes } = CONFIG[status] ?? CONFIG.active;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${classes}`}>
      {status === 'processing' && (
        <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 animate-pulse" />
      )}
      {label}
    </span>
  );
}
