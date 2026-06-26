const CACHE_NAME = 'taskops-v1';
const OFFLINE_QUEUE_NAME = 'taskops-offline-queue';

const SHELL_URLS = [
  '/',
  '/today',
  '/week',
  '/calendar',
  '/groups',
  '/search',
  '/activity',
  '/review',
  '/manifest.json',
];

// Install: cache shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: network-first for API, cache-first for shell
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API calls: try network, queue if offline
  if (url.pathname.startsWith('/api/tasks/create') && request.method === 'POST') {
    event.respondWith(
      fetch(request.clone()).catch(async () => {
        // Queue for later sync
        const body = await request.json();
        await queueOfflineCapture(body);
        return new Response(
          JSON.stringify({ taskId: 'offline-' + Date.now(), offline: true }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      })
    );
    return;
  }

  // Other API calls: network only
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(request));
    return;
  }

  // Static assets: cache-first
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/')
  ) {
    event.respondWith(
      caches.match(request).then((cached) => cached ?? fetch(request))
    );
    return;
  }

  // Pages: network-first, fall back to cache
  event.respondWith(
    fetch(request)
      .then((res) => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        return res;
      })
      .catch(() => caches.match(request))
  );
});

async function queueOfflineCapture(body) {
  const db = await openDB();
  const tx = db.transaction(OFFLINE_QUEUE_NAME, 'readwrite');
  const store = tx.objectStore(OFFLINE_QUEUE_NAME);
  store.add({ body, timestamp: Date.now() });
}

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('taskops', 1);
    req.onupgradeneeded = (e) => {
      e.target.result.createObjectStore(OFFLINE_QUEUE_NAME, { autoIncrement: true });
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = reject;
  });
}

// Background sync: flush offline queue when online
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-captures') {
    event.waitUntil(syncOfflineCaptures());
  }
});

async function syncOfflineCaptures() {
  const db = await openDB();
  const tx = db.transaction(OFFLINE_QUEUE_NAME, 'readwrite');
  const store = tx.objectStore(OFFLINE_QUEUE_NAME);
  const items = await new Promise((resolve) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
  });

  for (const item of items) {
    try {
      await fetch('/api/tasks/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.body),
      });
    } catch {
      return; // Stop if still offline
    }
  }

  // Clear queue
  const clearTx = db.transaction(OFFLINE_QUEUE_NAME, 'readwrite');
  clearTx.objectStore(OFFLINE_QUEUE_NAME).clear();
}
