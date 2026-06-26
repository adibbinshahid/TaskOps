'use client';

import type { TaskStatus } from '@/types';

const CONFIG: Record<TaskStatus, { label: string; classes: string }> = {
  processing: {
    label: 'Organising…',
    classes: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  },
  active: {
    label: 'Active',
    classes: 'bg-accent/10 text-accent',
  },
  needs_review: {
    label: 'Review',
    classes: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  },
  completed: {
    label: 'Done',
    classes: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  },
  deleted: {
    label: 'Deleted',
    classes: 'bg-t1/5 text-t3 line-through',
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
