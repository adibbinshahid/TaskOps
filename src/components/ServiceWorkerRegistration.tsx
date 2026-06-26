'use client';

import { useEffect } from 'react';

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          console.log('SW registered:', reg.scope);
          // Request background sync permission
          if ('sync' in reg) {
            navigator.serviceWorker.ready.then((r) => {
              (r as ServiceWorkerRegistration & { sync?: { register: (tag: string) => Promise<void> } }).sync?.register('sync-captures');
            });
          }
        })
        .catch((err) => console.error('SW registration failed:', err));
    }
  }, []);

  return null;
}
