'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import StatusChip from '@/components/StatusChip';
import VoiceCapture from '@/components/VoiceCapture';
import GradientMesh from '@/components/GradientMesh';
import type { Task } from '@/types';

interface Capture {
  taskId: string;
  label: string;
  task: Task | null;
}

export default function QuickCapturePage() {
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [captures, setCaptures] = useState<Capture[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Realtime subscription for recent captures
  useEffect(() => {
    if (captures.length === 0) return;
    const ids = captures.map((c) => c.taskId);

    const channel = supabase
      .channel('capture-updates')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'tasks' },
        (payload) => {
          const updated = payload.new as Task;
          if (ids.includes(updated.id)) {
            setCaptures((prev) =>
              prev.map((c) => (c.taskId === updated.id ? { ...c, task: updated } : c))
            );
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [captures.map((c) => c.taskId).join(',')]);

  const handleSave = useCallback(
    async (voiceInput?: { audioBase64: string; mimeType: string }) => {
      const entry = text.trim();
      if (!entry && !voiceInput) return;

      setSaving(true);
      setText('');

      try {
        const res = await fetch('/api/tasks/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: voiceInput ? undefined : entry,
            audioBase64: voiceInput?.audioBase64,
            mimeType: voiceInput?.mimeType,
            source: voiceInput ? 'pwa_voice' : 'web',
          }),
        });

        const { taskId } = await res.json() as { taskId: string };

        setCaptures((prev) =>
          [{ taskId, label: voiceInput ? '[voice note]' : entry, task: null }, ...prev].slice(0, 5)
        );

        textareaRef.current?.focus();
      } catch (err) {
        console.error('Save failed:', err);
      } finally {
        setSaving(false);
      }
    },
    [text]
  );

  return (
    <div className="relative min-h-dvh flex flex-col items-center pt-16 px-4 pb-8">
      <GradientMesh />

      <div className="w-full max-w-2xl relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <h1 className="text-3xl font-semibold text-white mb-1 tracking-tight">
            What&apos;s on your mind?
          </h1>
          <p className="text-white/40 text-sm mb-8">
            Just capture it — AI organises, schedules, and groups everything.
          </p>

          <div className="bg-card border border-white/8 rounded-2xl p-4 shadow-xl">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type anything — tasks, ideas, follow-ups… in any language"
              autoFocus
              rows={4}
              className="w-full bg-transparent text-white/90 placeholder-white/25 outline-none text-base leading-relaxed"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave();
              }}
            />

            <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/8">
              <div className="flex items-center gap-2">
                <VoiceCapture onCapture={handleSave} />
                <span className="text-xs text-white/25">or ⌘↵ to save</span>
              </div>
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={() => handleSave()}
                disabled={!text.trim() || saving}
                className="px-5 py-2 bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-colors"
              >
                {saving ? 'Saving…' : 'Save'}
              </motion.button>
            </div>
          </div>
        </motion.div>

        {/* Recent captures */}
        <AnimatePresence initial={false}>
          {captures.map((capture) => (
            <motion.div
              key={capture.taskId}
              layout
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="mt-3 flex items-center gap-3 bg-card/60 border border-white/6 rounded-xl px-4 py-3"
            >
              <StatusChip status={capture.task?.status ?? 'processing'} />
              <span className="text-white/65 text-sm truncate flex-1">
                {capture.task?.refined_entry ?? capture.label}
              </span>
              {capture.task?.assigned_date && capture.task.status !== 'processing' && (
                <span className="text-white/30 text-xs flex-shrink-0">
                  {capture.task.assigned_date}
                </span>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
