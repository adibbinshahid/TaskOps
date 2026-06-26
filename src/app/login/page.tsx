'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { APP_NAME } from '@/lib/constants';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Apply saved theme on login page too
  useEffect(() => {
    try {
      if (localStorage.getItem('theme') === 'dark') {
        document.documentElement.classList.add('dark');
      }
    } catch {}
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (res.ok) {
        router.push('/');
        router.refresh();
      } else {
        setError('Invalid credentials');
      }
    } catch {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  const inputCls = 'w-full bg-s2 border border-t1/[0.08] rounded-xl px-4 py-2.5 text-t1 placeholder-t3 text-sm focus:border-accent/50 transition-colors outline-none';

  return (
    <div className="min-h-dvh bg-bg flex items-center justify-center px-4">
      {/* Subtle bg blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-accent/[0.06] rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/3 w-80 h-80 bg-violet-500/[0.04] rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-sm"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-accent rounded-2xl mb-4 shadow-card-md">
            <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-white" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-t1 tracking-tight">{APP_NAME}</h1>
          <p className="text-sm text-t3 mt-1">Your personal task system</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-surface border border-t1/[0.06] rounded-2xl p-6 space-y-4 shadow-card-md"
        >
          <div>
            <label className="block text-xs font-semibold text-t3 mb-1.5 uppercase tracking-wider">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
              className={inputCls}
              placeholder="admin"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-t3 mb-1.5 uppercase tracking-wider">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className={inputCls}
              placeholder="••••••"
            />
          </div>

          {error && (
            <p className="text-red-500 text-sm text-center font-medium">{error}</p>
          )}

          <motion.button
            type="submit"
            disabled={loading || !username || !password}
            whileTap={{ scale: 0.98 }}
            className="w-full bg-accent hover:bg-accent-h disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-xl transition-colors text-sm shadow-sm"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </motion.button>
        </form>
      </motion.div>
    </div>
  );
}
