const CACHE_NAME = 'iconic-finance-v2';

// Only pre-cache static images that never change
const STATIC_ASSETS = [
  '/logos/iconic-finance.png',
  '/logos/vodafone-cash.png',
  '/logos/instapay.png',
  '/favicon.ico',
];

// ── Install: cache only static images ────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {});
    })
  );
  self.skipWaiting();
});

// ── Activate: delete all old caches ──────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names.map((name) => {
          if (name !== CACHE_NAME) return caches.delete(name);
        })
      )
    )
  );
  self.clients.claim();
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;
  if (!url.protocol.startsWith('http')) return;

  // API calls — never cache, always network
  if (url.pathname.startsWith('/api/')) return;

  // Static images — cache first (they never change)
  if (
    url.pathname.startsWith('/logos/') ||
    url.pathname === '/favicon.ico' ||
    url.pathname === '/placeholder.svg'
  ) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            if (res.ok) {
              const clone = res.clone();
              caches.open(CACHE_NAME).then((c) => c.put(request, clone));
            }
            return res;
          })
      )
    );
    return;
  }

  // Everything else (HTML, JS, CSS) — network first, cache only as offline fallback
  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request, clone));
        }
        return res;
      })
      .catch(() =>
        caches.match(request).then(
          (cached) => cached || caches.match('/')
        )
      )
  );
});
