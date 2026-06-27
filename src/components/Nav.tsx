'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { APP_NAME } from '@/lib/constants';
import { useNewTask } from './NewTaskProvider';

interface NavItem {
  href: string;
  label: string;
  badge?: number;
  badgeTip?: string;
  icon: React.ReactNode;
}

function NavIcon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const { open: openNewTask } = useNewTask();
  const [reviewCount, setReviewCount] = useState(0);
  const [todayCount, setTodayCount] = useState(0);
  const [tooltip, setTooltip] = useState<string | null>(null);

  useEffect(() => {
    async function loadCounts() {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const [rev, tod] = await Promise.all([
          fetch('/api/tasks?status=needs_review').then((r) => r.json()),
          fetch(`/api/tasks?start_date=${today}&end_date=${today}`).then((r) => r.json()),
        ]);
        setReviewCount(Array.isArray(rev) ? rev.length : 0);
        setTodayCount(Array.isArray(tod) ? tod.filter((t: { status: string }) => t.status !== 'completed' && t.status !== 'deleted').length : 0);
      } catch {}
    }
    loadCounts();
    const id = setInterval(loadCounts, 30_000);
    return () => clearInterval(id);
  }, []);

  const NAV: NavItem[] = [
    {
      href: '/',
      label: 'Dashboard',
      icon: <NavIcon d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />,
    },
    {
      href: '/today',
      label: "Today's Focus",
      badge: todayCount || undefined,
      badgeTip: `${todayCount} task${todayCount !== 1 ? 's' : ''} for today`,
      icon: <NavIcon d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />,
    },
    {
      href: '/all-tasks',
      label: 'All Tasks',
      icon: <NavIcon d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />,
    },
    {
      href: '/task-type',
      label: 'Task Type',
      icon: <NavIcon d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />,
    },
    {
      href: '/activity-review',
      label: 'Activity & Review',
      badge: reviewCount || undefined,
      badgeTip: `${reviewCount} task${reviewCount !== 1 ? 's' : ''} need${reviewCount === 1 ? 's' : ''} review`,
      icon: <NavIcon d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />,
    },
  ];

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  function isActive(href: string) {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  }

  return (
    <>
      {/* ── Desktop sidebar ─────────────────────────── */}
      <aside className="hidden md:flex flex-col fixed left-0 top-0 bottom-0 w-60 z-30 px-3 py-5 glass border-r border-t1/[0.08]">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-2 mb-5">
          <div className="w-8 h-8 bg-accent rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.2} className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <span className="font-bold text-t1 text-sm tracking-tight">{APP_NAME}</span>
        </div>

        {/* New Task */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={openNewTask}
          className="flex items-center justify-center gap-2 w-full px-4 py-2.5 mb-5 bg-accent hover:bg-accent-h text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4 flex-shrink-0">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New Task
        </motion.button>

        {/* Nav items */}
        <nav className="flex-1 space-y-0.5">
          {NAV.map((item) => {
            const active = isActive(item.href);
            return (
              <div key={item.href} className="relative">
                <Link
                  href={item.href}
                  className={`relative flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                    active ? 'text-accent' : 'text-t2 hover:bg-s2/60 hover:text-t1'
                  }`}
                >
                  {active && (
                    <motion.div
                      layoutId="sidebar-indicator"
                      className="absolute inset-0 bg-accent/10 rounded-xl"
                      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    />
                  )}
                  <span className="relative z-10">{item.icon}</span>
                  <span className="relative z-10 flex-1 truncate">{item.label}</span>
                  {item.badge ? (
                    <span
                      className="relative z-10 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 cursor-default"
                      onMouseEnter={() => setTooltip(item.badgeTip ?? null)}
                      onMouseLeave={() => setTooltip(null)}
                    >
                      {item.badge}
                    </span>
                  ) : null}
                </Link>
              </div>
            );
          })}
        </nav>

        {/* Badge tooltip */}
        <AnimatePresence>
          {tooltip && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              className="absolute left-64 top-1/2 -translate-y-1/2 z-50 px-3 py-1.5 glass-strong rounded-xl text-xs text-t1 whitespace-nowrap shadow-modal pointer-events-none"
            >
              {tooltip}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom */}
        <div className="border-t border-t1/[0.06] pt-3 mt-2">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-xl text-sm font-medium text-t2 hover:bg-s2/60 hover:text-t1 transition-colors"
          >
            <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center flex-shrink-0">
              <span className="text-white text-[10px] font-bold select-none">A</span>
            </div>
            <span className="flex-1 text-left">Adib</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4 text-t3 flex-shrink-0">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </aside>

      {/* ── Mobile FAB ────────────────────────────────── */}
      <motion.button
        whileTap={{ scale: 0.93 }}
        onClick={openNewTask}
        className="md:hidden fixed bottom-24 right-5 z-40 w-14 h-14 bg-accent hover:bg-accent-h text-white rounded-2xl shadow-card-md flex items-center justify-center transition-colors"
        aria-label="New Task"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-6 h-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      </motion.button>

      {/* ── Mobile bottom nav ─────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 glass border-t border-t1/[0.08] flex items-center justify-around px-1 pb-safe">
        {NAV.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex flex-col items-center py-2.5 px-2 transition-colors ${
                active ? 'text-accent' : 'text-t3 hover:text-t2'
              }`}
            >
              {item.icon}
              <span className="text-[9px] mt-0.5 font-medium truncate max-w-[56px] text-center leading-tight">
                {item.label}
              </span>
              {item.badge ? (
                <span className="absolute -top-0.5 right-0 w-4 h-4 text-[9px] font-bold rounded-full bg-amber-500 text-white flex items-center justify-center">
                  {item.badge > 9 ? '9+' : item.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
