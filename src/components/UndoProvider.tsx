'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface UndoAction {
  label: string;
  onUndo: () => Promise<void>;
}

interface UndoContextValue {
  showUndo: (action: UndoAction) => void;
}

const UndoContext = createContext<UndoContextValue>({ showUndo: () => {} });

export function useUndo() {
  return useContext(UndoContext);
}

export default function UndoProvider({ children }: { children: ReactNode }) {
  const [action, setAction] = useState<UndoAction | null>(null);
  const [timer, setTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const showUndo = useCallback((newAction: UndoAction) => {
    if (timer) clearTimeout(timer);
    setAction(newAction);
    const t = setTimeout(() => setAction(null), 5000);
    setTimer(t);
  }, [timer]);

  const handleUndo = async () => {
    if (!action) return;
    if (timer) clearTimeout(timer);
    setAction(null);
    await action.onUndo();
  };

  return (
    <UndoContext.Provider value={{ showUndo }}>
      {children}
      <AnimatePresence>
        {action && (
          <motion.div
            key="undo-snackbar"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-[#1A1B24] border border-white/12 rounded-2xl px-4 py-3 shadow-xl"
          >
            <span className="text-white/70 text-sm">{action.label}</span>
            <button
              onClick={handleUndo}
              className="text-accent text-sm font-semibold hover:text-accent-hover transition-colors"
            >
              Undo
            </button>
            <button
              onClick={() => setAction(null)}
              className="text-white/30 hover:text-white/60 transition-colors ml-1"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </UndoContext.Provider>
  );
}
