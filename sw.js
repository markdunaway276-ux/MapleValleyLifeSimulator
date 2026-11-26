/**
 * Keeps the game's code fresh. GitHub Pages lets browsers reuse files for up
 * to 10 minutes, and ES modules are fetched one by one, so right after an
 * update a browser could run a new main.js with an old pauseMenu.js. This
 * worker asks the server about every page, script and JSON file each time
 * (a cheap "not modified" reply when nothing changed). Models and textures
 * keep normal caching. Offline, the browser cache still serves what it has.
 */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const code = req.mode === 'navigate' || /\.(js|mjs|html|json)$/i.test(url.pathname) || url.pathname.endsWith('/');
  if (!code) return;
  e.respondWith(
    fetch(new Request(req.url, { cache: 'no-cache', credentials: 'same-origin' }))
      .catch(() => caches.match(req).then((r) => r || fetch(req)))
  );
});
