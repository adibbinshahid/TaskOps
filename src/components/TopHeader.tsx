'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from './ThemeProvider';
import type { Task } from '@/types';

const PAGE_TITLES: Record<string, string> = {
  '/':                 'Dashboard',
  '/today':            "Today's Focus",
  '/all-tasks':        'All Tasks',
  '/task-type':        'Task Type',
  '/activity-review':  'Activity & Review',
};

export default function TopHeader() {
  const pathname = usePathname();
  const { theme, toggle } = useTheme();
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Task[]>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const title = PAGE_TITLES[pathname] ?? '';

  useEffect(() => {
    if (searchOpen) setTimeout(() => inputRef.current?.focus(), 50);
    else { setQuery(''); setResults([]); }
  }, [searchOpen]);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!query.trim()) { setResults([]); return; }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/tasks?q=${encodeURIComponent(query.trim())}`);
        setResults(await res.json());
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  return (
    <>
      <header className="fixed top-0 left-0 md:left-60 right-0 h-14 z-20 glass flex items-center justify-between px-5 gap-4">
        <h1 className="text-sm font-semibold text-t1 hidden md:block">{title}</h1>

        <div className="flex items-center gap-2 ml-auto">
          {/* Search */}
          <AnimatePresence mode="wait">
            {searchOpen ? (
              <motion.div
                key="search-open"
                initial={{ width: 40, opacity: 0.5 }}
                animate={{ width: 280, opacity: 1 }}
                exit={{ width: 40, opacity: 0 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="relative"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-t3 pointer-events-none">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search tasks…"
                  onKeyDown={(e) => { if (e.key === 'Escape') setSearchOpen(false); }}
                  className="w-full glass-sm rounded-xl pl-9 pr-3 py-2 text-t1 placeholder-t3 text-sm outline-none"
                />
                {query && (
                  <button onClick={() => setQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-t3 hover:text-t2">
                    ✕
                  </button>
                )}
              </motion.div>
            ) : (
              <motion.button
                key="search-closed"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={() => setSearchOpen(true)}
                className="w-9 h-9 flex items-center justify-center rounded-xl glass-sm hover:bg-accent/10 text-t2 hover:text-accent transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </motion.button>
            )}
          </AnimatePresence>

          {/* Theme */}
          <button
            onClick={toggle}
            className="w-9 h-9 flex items-center justify-center rounded-xl glass-sm hover:bg-accent/10 text-t2 hover:text-accent transition-colors"
          >
            {theme === 'dark' ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
        </div>
      </header>

      {/* Search results dropdown */}
      <AnimatePresence>
        {searchOpen && query && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="fixed top-16 right-4 z-[70] w-80 glass-strong rounded-2xl shadow-modal overflow-hidden"
          >
            {searching ? (
              <div className="px-4 py-6 text-center text-t3 text-sm">Searching…</div>
            ) : results.length === 0 ? (
              <div className="px-4 py-6 text-center text-t3 text-sm">No results for &ldquo;{query}&rdquo;</div>
            ) : (
              <div className="max-h-80 overflow-y-auto">
                <p className="px-4 pt-3 pb-1 text-xs text-t3 font-medium">{results.length} result{results.length !== 1 ? 's' : ''}</p>
                {results.slice(0, 8).map((task) => (
                  <a
                    key={task.id}
                    href={`/task/${task.id}`}
                    onClick={() => setSearchOpen(false)}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-accent/8 transition-colors"
                  >
                    <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${
                      task.status === 'completed' ? 'bg-emerald-400' :
                      task.status === 'needs_review' ? 'bg-amber-400' : 'bg-accent'
                    }`} />
                    <div className="min-w-0">
                      <p className={`text-sm text-t1 truncate ${task.status === 'completed' ? 'line-through opacity-60' : ''}`}>
                        {task.refined_entry ?? task.original_entry}
                      </p>
                      <p className="text-xs text-t3 mt-0.5">
                        {task.groups?.name ?? 'Unassigned'}{task.assigned_date ? ` · ${task.assigned_date}` : ''}
                      </p>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search backdrop */}
      {searchOpen && (
        <div
          className="fixed inset-0 z-[65]"
          onClick={() => setSearchOpen(false)}
        />
      )}
    </>
  );
}
