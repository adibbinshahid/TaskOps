'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  ReactNode,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import VoiceCapture from './VoiceCapture';

interface NewTaskContextValue {
  open: () => void;
}

const NewTaskContext = createContext<NewTaskContextValue>({ open: () => {} });

export function useNewTask() {
  return useContext(NewTaskContext);
}

export default function NewTaskProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState('');
  const [date, setDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const open = useCallback(() => {
    setIsOpen(true);
    setDone(false);
    setText('');
    setDate(new Date().toISOString().slice(0, 10));
    setTimeout(() => textareaRef.current?.focus(), 60);
  }, []);

  function close() {
    setIsOpen(false);
    setText('');
    setDate('');
    setDone(false);
    setSavedCount(0);
  }

  async function handleSave(voice?: { audioBase64: string; mimeType: string }) {
    if (voice) {
      setSaving(true);
      try {
        await fetch('/api/tasks/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audioBase64: voice.audioBase64,
            mimeType: voice.mimeType,
            source: 'pwa_voice',
            assigned_date: date || undefined,
          }),
        });
        setSavedCount(1);
        setDone(true);
        setTimeout(close, 1400);
      } catch (err) {
        console.error('Save failed:', err);
      } finally {
        setSaving(false);
      }
      return;
    }

    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return;

    setSaving(true);
    try {
      await Promise.all(
        lines.map((line) =>
          fetch('/api/tasks/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: line,
              source: 'web',
              assigned_date: date || undefined,
            }),
          })
        )
      );
      setSavedCount(lines.length);
      setText('');
      setDone(true);
      setTimeout(close, 1600);
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setSaving(false);
    }
  }

  const taskCount = text.split('\n').map((l) => l.trim()).filter(Boolean).length;

  return (
    <NewTaskContext.Provider value={{ open }}>
      {children}

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={close}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
            />
            <motion.div
              key="modal"
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg px-4"
            >
              <div className="glass-strong rounded-2xl shadow-modal overflow-hidden">
                <div className="px-5 pt-5 pb-4 border-b border-t1/[0.06]">
                  <h2 className="text-t1 font-semibold text-base">New Task</h2>
                  <p className="text-t3 text-xs mt-0.5">
                    One line per task · AI classifies and schedules automatically
                  </p>
                </div>

                {done ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center py-10 gap-3"
                  >
                    <div className="w-10 h-10 rounded-full bg-emerald-500/15 flex items-center justify-center">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-5 h-5 text-emerald-500">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="text-t2 text-sm font-medium">
                      {savedCount === 1 ? 'Task captured!' : `${savedCount} tasks captured!`} AI is organising…
                    </p>
                  </motion.div>
                ) : (
                  <div className="p-5 space-y-4">
                    <textarea
                      ref={textareaRef}
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      placeholder={"Write tasks here, one per line:\nSchedule dentist appointment\nReview project proposal\nBuy groceries…"}
                      rows={5}
                      className="w-full bg-transparent text-t1 placeholder-t3 outline-none text-sm leading-relaxed"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave();
                        if (e.key === 'Escape') close();
                      }}
                    />

                    {/* Date picker */}
                    <div className="flex items-center gap-3 pt-3 border-t border-t1/[0.06]">
                      <label className="text-xs font-semibold text-t3 uppercase tracking-wider whitespace-nowrap">Date</label>
                      <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="flex-1 bg-s2/50 border border-t1/[0.08] rounded-xl px-3 py-1.5 text-t1 text-sm outline-none focus:border-accent/50 transition-colors"
                      />
                      {date && (
                        <button
                          onClick={() => setDate('')}
                          className="text-t3 hover:text-t2 text-xs transition-colors"
                        >
                          Clear
                        </button>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-3">
                        <VoiceCapture onCapture={handleSave} />
                        <span className="text-t3 text-xs">⌘↵ to save</span>
                        {taskCount > 1 && (
                          <span className="text-accent text-xs font-medium">{taskCount} tasks</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={close}
                          className="px-4 py-2 text-t2 text-sm hover:text-t1 rounded-xl hover:bg-s2/60 transition-colors"
                        >
                          Cancel
                        </button>
                        <motion.button
                          whileTap={{ scale: 0.97 }}
                          onClick={() => handleSave()}
                          disabled={!text.trim() || saving}
                          className="px-5 py-2 bg-accent hover:bg-accent-h text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {saving ? 'Saving…' : taskCount > 1 ? `Save ${taskCount} Tasks` : 'Save Task'}
                        </motion.button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </NewTaskContext.Provider>
  );
}
