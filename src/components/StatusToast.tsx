'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import type { Task } from '@/types';

interface Toast {
  id: string;
  type: 'organizing' | 'done' | 'review';
  entry: string;
  group?: string;
}

export default function StatusToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  function addToast(toast: Toast) {
    setToasts((prev) => [...prev.slice(-2), toast]);
    const t = setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== toast.id));
      timersRef.current.delete(toast.id);
    }, 5000);
    timersRef.current.set(toast.id, t);
  }

  function dismiss(id: string) {
    setToasts((prev) => prev.filter((x) => x.id !== id));
    const t = timersRef.current.get(id);
    if (t) { clearTimeout(t); timersRef.current.delete(id); }
  }

  useEffect(() => {
    const channel = supabase
      .channel('status-toasts')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'tasks' },
        (payload) => {
          const task = payload.new as Task;
          const old = payload.old as Partial<Task>;

          if (old.status === 'processing' && task.status !== 'processing') {
            const entry = task.refined_entry ?? task.original_entry ?? 'Task';
            addToast({
              id: `${task.id}-${Date.now()}`,
              type: task.status === 'needs_review' ? 'review' : 'done',
              entry: entry.slice(0, 60),
            });
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return (
    <div className="fixed bottom-24 md:bottom-6 right-4 z-[60] flex flex-col gap-2 items-end pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: 60, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 60, scale: 0.9 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="pointer-events-auto"
          >
            <div className="glass-strong rounded-2xl px-4 py-3 flex items-start gap-3 max-w-xs shadow-modal">
              <div className={`w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
                toast.type === 'done'
                  ? 'bg-emerald-500/15'
                  : toast.type === 'review'
                  ? 'bg-amber-500/15'
                  : 'bg-violet-500/15'
              }`}>
                {toast.type === 'done' ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3.5 h-3.5 text-emerald-500">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : toast.type === 'review' ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5 text-amber-500">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                ) : (
                  <span className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-t1 text-xs font-semibold">
                  {toast.type === 'done' ? 'Task organised' : toast.type === 'review' ? 'Needs your review' : 'Organising…'}
                </p>
                <p className="text-t3 text-xs mt-0.5 truncate">{toast.entry}</p>
              </div>
              <button onClick={() => dismiss(toast.id)} className="text-t3 hover:text-t2 transition-colors flex-shrink-0 mt-0.5">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
