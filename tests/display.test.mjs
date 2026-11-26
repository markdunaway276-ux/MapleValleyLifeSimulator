// Run from the repo root with: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDisplay, normalizeDisplay, mobileFilterFor, DISPLAY_KEY, DISPLAY_DEFAULTS } from '../src/systems/display.js';
import { LOOK } from '../src/world/palette.js';

function memStorage(init = {}) {
  const m = new Map(Object.entries(init));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), map: m };
}

test('normalizeDisplay clamps and fills defaults', () => {
  assert.deepEqual(normalizeDisplay(null), { ...DISPLAY_DEFAULTS });
  assert.deepEqual(normalizeDisplay({ brightness: 9, film: -1, grain: 0 }), { brightness: 2, film: 0, grain: false });
  assert.equal(normalizeDisplay({ brightness: 'x' }).brightness, 1);
});

test('brightness scales the renderer exposure and is saved per device', () => {
  const renderer = { toneMappingExposure: 0 };
  const storage = memStorage();
  const d = createDisplay({ renderer, storage });
  assert.equal(renderer.toneMappingExposure, LOOK.exposure);
  d.setBrightness(1.5);
  assert.ok(Math.abs(renderer.toneMappingExposure - LOOK.exposure * 1.5) < 1e-9);
  assert.equal(JSON.parse(storage.map.get(DISPLAY_KEY)).brightness, 1.5);
  const again = createDisplay({ renderer: { toneMappingExposure: 0 }, storage });
  assert.equal(again.get().brightness, 1.5);
});

test('film look and grain drive the desktop post grade', () => {
  const calls = [];
  const post = { setGradeStrength: (v) => calls.push(['film', v]), setGrain: (on) => calls.push(['grain', on]) };
  const d = createDisplay({ renderer: { toneMappingExposure: 0 }, post, storage: memStorage() });
  d.setFilm(0.25);
  d.setGrain(false);
  assert.deepEqual(calls.at(-2), ['film', 0.25]);
  assert.deepEqual(calls.at(-1), ['grain', false]);
  d.reset();
  assert.deepEqual(d.get(), { ...DISPLAY_DEFAULTS });
});

test('phone filter is neutral at 0 and the full grade at 1', () => {
  assert.equal(mobileFilterFor(0), 'sepia(0.000) saturate(1.000) contrast(1.000) brightness(1.000)');
  assert.match(mobileFilterFor(1), new RegExp(`sepia\\(${LOOK.grade.mobile.sepia.toFixed(3)}\\)`));
});

test('corrupt storage falls back to defaults', () => {
  const d = createDisplay({ renderer: null, storage: memStorage({ [DISPLAY_KEY]: '{oops' }) });
  assert.deepEqual(d.get(), { ...DISPLAY_DEFAULTS });
});
