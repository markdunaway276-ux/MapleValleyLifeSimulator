// Run from the repo root with: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function loadServiceWorker({ fetch: fetchImpl }) {
  const swSrc = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  const listeners = new Map();
  const buckets = new Map();
  let claimed = false;
  let skipped = false;

  const caches = {
    async open(name) {
      if (!buckets.has(name)) buckets.set(name, new Map());
      const store = buckets.get(name);
      return {
        async put(req, res) { store.set(req.url, res); },
        async match(req) { return store.get(req.url); }
      };
    },
    async match(req) {
      for (const store of buckets.values()) {
        if (store.has(req.url)) return store.get(req.url);
      }
      return undefined;
    },
    async keys() { return Array.from(buckets.keys()); },
    async delete(name) { return buckets.delete(name); }
  };

  class FakeRequest {
    constructor(url, opts = {}) {
      this.url = typeof url === 'string' ? url : url.url;
      this.method = opts.method || 'GET';
      this.mode = opts.mode || 'cors';
      this.cache = opts.cache || 'default';
      this.credentials = opts.credentials || 'same-origin';
    }
  }

  const self = {
    location: { origin: 'https://example.github.io' },
    addEventListener(type, fn) { listeners.set(type, fn); },
    skipWaiting() { skipped = true; },
    clients: { async claim() { claimed = true; } }
  };

  vm.runInNewContext(swSrc, {
    self,
    caches,
    URL,
    Request: FakeRequest,
    fetch: fetchImpl,
    Promise
  });

  function dispatchFetch(url, { method = 'GET', mode = 'cors' } = {}) {
    const req = new FakeRequest(url, { method, mode });
    let responded = null;
    const waited = [];
    const ev = {
      request: req,
      respondWith(p) { responded = p; },
      waitUntil(p) { waited.push(p); }
    };
    listeners.get('fetch')(ev);
    return { responded, waited };
  }

  async function dispatchActivate() {
    const waited = [];
    listeners.get('activate')({ waitUntil(p) { waited.push(p); } });
    await Promise.all(waited);
  }

  return {
    buckets,
    dispatchFetch,
    dispatchActivate,
    wasClaimed: () => claimed,
    wasSkipped: () => skipped
  };
}

test('sw.js caches successful JS/HTML fetches and serves them from CacheStorage when offline', async () => {
  let online = true;
  const seenCaches = [];
  const sw = loadServiceWorker({
    async fetch(req) {
      seenCaches.push(req.cache);
      if (!online) throw new Error('offline');
      const body = 'export const ok = true;';
      return {
        ok: true,
        status: 200,
        body,
        clone() { return { ok: true, status: 200, body, fromClone: true }; }
      };
    }
  });

  const url = 'https://example.github.io/MapleValleyLifeSimulator/src/main.js';
  const first = sw.dispatchFetch(url);
  assert.ok(first.responded, 'JS module request should be intercepted');
  const res1 = await first.responded;
  await Promise.all(first.waited);
  assert.equal(res1.status, 200);
  assert.equal(seenCaches[0], 'no-cache');

  // Now go offline: CacheStorage fallback should serve the cached copy.
  online = false;
  const second = sw.dispatchFetch(url);
  const res2 = await second.responded;
  assert.equal(res2.body, 'export const ok = true;');
  assert.equal(res2.fromClone, true);
});

test('sw.js does not force no-cache revalidation on static Mixamo JSON files under assets/', () => {
  const sw = loadServiceWorker({
    async fetch() { throw new Error('should not be called'); }
  });

  const rootAsset = sw.dispatchFetch('https://example.github.io/assets/characters/mixamo-breathing-idle.json');
  assert.equal(rootAsset.responded, null);

  const subpathAsset = sw.dispatchFetch('https://example.github.io/MapleValleyLifeSimulator/assets/characters/actions/typing.json');
  assert.equal(subpathAsset.responded, null);

  const glbAsset = sw.dispatchFetch('https://example.github.io/MapleValleyLifeSimulator/assets/models/gas-station.glb');
  assert.equal(glbAsset.responded, null);

  // Non-asset JSON or HTML pages still revalidate.
  const page = sw.dispatchFetch('https://example.github.io/MapleValleyLifeSimulator/', { mode: 'navigate' });
  assert.ok(page.responded);
  page.responded.catch(() => {});
});

test('sw.js activate prunes stale caches and claims clients', async () => {
  const sw = loadServiceWorker({ async fetch() { return { ok: true, clone: () => ({}) }; } });
  sw.buckets.set('old-cache-v0', new Map());
  sw.buckets.set('maple-lane-v1', new Map());
  await sw.dispatchActivate();
  assert.equal(sw.buckets.has('old-cache-v0'), false);
  assert.equal(sw.buckets.has('maple-lane-v1'), true);
  assert.equal(sw.wasClaimed(), true);
});

test('gasStation.js no longer reads dead data.lastMinutes and scene.js attaches dynamic car shadow', () => {
  const gasSrc = readFileSync(new URL('../src/world/gasStation.js', import.meta.url), 'utf8');
  assert.equal(gasSrc.includes('data.lastMinutes'), false, 'gasStation.js should not reference dead data.lastMinutes');

  const sceneSrc = readFileSync(new URL('../src/world/scene.js', import.meta.url), 'utf8');
  assert.ok(sceneSrc.includes("carShadow.name = 'car-contact-shadow'"), 'scene.js should attach car-contact-shadow to the car');
  assert.ok(sceneSrc.includes('car.add(carShadow)'), 'scene.js should parent carShadow to car');
});
