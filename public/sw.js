// Tapit Wallet service worker — installability + offline shell.
//
// Phase 1 keeps this hand-rolled and tiny on purpose: no workbox, no
// generated precache manifest, no version surgery. The SW caches the
// app shell at install time and falls back to it for navigations.
// Asset versions are not pinned; the browser will pull fresh JS/CSS
// on first navigation after a deploy because Vite emits hashed
// filenames. The shell entries are revalidated on every fetch via
// stale-while-revalidate.

const SHELL_CACHE = 'tapit-shell-v1';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL)),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== SHELL_CACHE).map((k) => caches.delete(k)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Navigation requests fall back to the shell when offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match('/index.html').then((r) => r || Response.error())),
    );
    return;
  }

  // Static assets: stale-while-revalidate from the shell cache.
  event.respondWith(
    caches.open(SHELL_CACHE).then(async (cache) => {
      const cached = await cache.match(req);
      const network = fetch(req)
        .then((res) => {
          if (res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => cached || Response.error());
      return cached || network;
    }),
  );
});
