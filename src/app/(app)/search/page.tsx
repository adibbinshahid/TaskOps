'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Task } from '@/types';
import TaskCard from '@/components/TaskCard';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/tasks?q=${encodeURIComponent(query.trim())}`);
        setResults(await res.json());
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  return (
    <div className="px-5 md:px-8 pt-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-t1 mb-6 tracking-tight">Search</h1>

      <div className="relative mb-6">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-t3 pointer-events-none"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tasks, notes, projects…"
          className="w-full bg-surface border border-t1/[0.08] rounded-2xl pl-11 pr-4 py-3.5 text-t1 placeholder-t3 text-sm outline-none focus:border-accent/40 transition-colors shadow-card"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-t3 hover:text-t2 transition-colors"
          >
            ✕
          </button>
        )}
      </div>

      {loading && (
        <div className="text-center text-t3 text-sm py-8">Searching…</div>
      )}

      <AnimatePresence>
        {!loading && query && results.length === 0 && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center text-t3 text-sm py-12"
          >
            No results for &ldquo;{query}&rdquo;
          </motion.p>
        )}
      </AnimatePresence>

      {!loading && results.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
          <p className="text-xs text-t3 mb-3 font-medium">
            {results.length} result{results.length !== 1 ? 's' : ''}
          </p>
          {results.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </motion.div>
      )}

      {!query && (
        <div className="text-center text-t3 text-sm py-12">
          Type to search across all tasks
        </div>
      )}
    </div>
  );
}
