/**
 * Keeps the game's code fresh. GitHub Pages lets browsers reuse files for up
 * to 10 minutes, and ES modules are fetched one by one, so right after an
 * update a browser could run a new main.js with an old pauseMenu.js. This
 * worker asks the server about every page, script and non-asset JSON file each
 * time (a cheap "not modified" reply when nothing changed) and saves successful
 * replies into CacheStorage so offline fallback works. Static models, textures
 * and animation JSON files under assets/ keep normal browser caching.
 */
const CACHE_NAME = 'maple-lane-v1';

function isStaticAsset(pathname) {
  return /(?:^|\/)assets\//i.test(pathname);
}

function shouldRevalidate(req, url) {
  if (req.mode === 'navigate') return true;
  if (isStaticAsset(url.pathname)) return false;
  return /\.(js|mjs|html|json)$/i.test(url.pathname) || url.pathname.endsWith('/');
}

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (!shouldRevalidate(req, url)) return;
  e.respondWith(
    fetch(new Request(req.url, { cache: 'no-cache', credentials: 'same-origin' }))
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          const store = caches.open(CACHE_NAME)
            .then((cache) => cache.put(req, copy))
            .catch(() => {});
          try { if (typeof e.waitUntil === 'function') e.waitUntil(store); } catch { /* ignore */ }
        }
        return res;
      })
      .catch(() => caches.match(req).then((r) => r || fetch(req)))
  );
});
