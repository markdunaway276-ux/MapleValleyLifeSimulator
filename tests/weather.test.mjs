import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createWeather, nextWeatherOptions, isColdDay, advanceSnowCover, temperatureF,
  normalizeWeatherId, STEP_MINUTES, WEATHER_INTERVAL_MINUTES, SNOW_BUILD_MINUTES
} from '../src/systems/weather.js';

function fakeClock(start = 8 * 60) {
  const c = {
    t: null,
    set(total) { c.t = { day: Math.floor(total / 1440) + 1, minutes: total % 1440, totalMinutes: total }; return c.t; },
    getTime() { return c.t; }
  };
  c.set(start);
  return c;
}

const ORDER = { clear: 0, partly: 1, cloudy: 2, drizzle: 3, rain: 4, flurries: 3, snow: 4 };

test('weather only ever steps to a neighbour, never jumps', () => {
  for (const id of Object.keys(ORDER)) {
    for (const cold of [false, true]) {
      for (const next of Object.keys(nextWeatherOptions(id, cold))) {
        assert.ok(Math.abs(ORDER[next] - ORDER[id]) <= 1, `${id} -> ${next}`);
        const snowy = (s) => s === 'flurries' || s === 'snow';
        const rainy = (s) => s === 'drizzle' || s === 'rain';
        assert.ok(!(snowy(id) && rainy(next)) && !(rainy(id) && snowy(next)), `${id} -> ${next}`);
      }
    }
  }
});

test('snow only starts on cold days, rain only on mild days', () => {
  assert.ok(!('flurries' in nextWeatherOptions('cloudy', false)));
  assert.ok(!('drizzle' in nextWeatherOptions('cloudy', true)));
  assert.ok(!('snow' in nextWeatherOptions('flurries', false)));
  assert.ok(!('rain' in nextWeatherOptions('drizzle', true)));
});

test('cold weather comes in 3-day spells with an early snap on days 4-6', () => {
  assert.equal(isColdDay(4) && isColdDay(5) && isColdDay(6), true);
  for (let d = 1; d <= 60; d += 3) {
    assert.equal(isColdDay(d), isColdDay(d + 1));
    assert.equal(isColdDay(d), isColdDay(d + 2));
  }
});

test('a step blends over game minutes, not a few real seconds', () => {
  const clock = fakeClock();
  const w = createWeather({ clock, state: 'clear' });
  w.update(0, clock.t);
  w.set('partly');
  let total = clock.t.totalMinutes;
  for (let i = 0; i < 30; i++) w.update(1, clock.set(++total));
  const mid = w.get();
  assert.ok(mid.progress > 0.3 && mid.progress < 0.5, String(mid.progress));
  for (let i = 0; i < STEP_MINUTES; i++) w.update(1, clock.set(++total));
  assert.equal(w.get().progress, 1);
  assert.equal(w.get().id, 'partly');
});

test('rain intensity ramps up gradually through drizzle', () => {
  const clock = fakeClock();
  const w = createWeather({ clock, state: 'cloudy' });
  w.update(0, clock.t);
  w.set('drizzle');
  let total = clock.t.totalMinutes;
  const samples = [];
  for (let i = 0; i < STEP_MINUTES; i += 15) {
    for (let k = 0; k < 15; k++) w.update(1, clock.set(++total));
    samples.push(w.rainAmount());
  }
  for (let i = 1; i < samples.length; i++) assert.ok(samples[i] >= samples[i - 1]);
  assert.ok(samples[samples.length - 1] < 0.5, 'drizzle stays light');
});

test('a few hours of game time never skip more than one step per interval', () => {
  const clock = fakeClock();
  const w = createWeather({ clock });
  w.start();
  let total = clock.t.totalMinutes;
  let prev = w.get().to;
  let changes = 0;
  for (let i = 0; i < 10 * 1440; i++) {
    const g = w.update(1, clock.set(++total));
    if (g.to !== prev) {
      assert.ok(Math.abs(ORDER[g.to] - ORDER[prev]) <= 1, `${prev} -> ${g.to}`);
      prev = g.to;
      changes++;
    }
  }
  assert.ok(changes < (10 * 1440) / WEATHER_INTERVAL_MINUTES + 1);
});

test('new games start calm (no rain or snow)', () => {
  for (let d = 1; d < 30; d++) {
    const clock = fakeClock((d - 1) * 1440 + 480);
    const w = createWeather({ clock });
    const g = w.start();
    assert.ok(['clear', 'partly', 'cloudy'].includes(g.id), g.id);
  }
});

test('snow builds up while falling and melts slowly afterwards', () => {
  let c = 0;
  c = advanceSnowCover(c, { snow: 1, minutes: SNOW_BUILD_MINUTES / 2 });
  assert.ok(Math.abs(c - 0.5) < 1e-9);
  c = advanceSnowCover(c, { snow: 1, minutes: SNOW_BUILD_MINUTES });
  assert.equal(c, 1);
  const coldMelt = advanceSnowCover(1, { cold: true, minutes: 60 });
  const mildMelt = advanceSnowCover(1, { cold: false, minutes: 60 });
  const rainMelt = advanceSnowCover(1, { cold: false, rain: 1, minutes: 60 });
  assert.ok(coldMelt > mildMelt && mildMelt > rainMelt && rainMelt > 0);
});

test('weather saves and loads, including older saves', () => {
  const clock = fakeClock(3 * 1440 + 480); // day 4: cold
  const a = createWeather({ clock });
  a.set('snow', { immediate: true });
  a.update(0, clock.t);
  let total = clock.t.totalMinutes;
  for (let i = 0; i < 120; i++) a.update(1, clock.set(++total));
  const saved = a.serialize();
  const b = createWeather({ clock });
  b.apply({ weather: saved });
  assert.equal(b.get().id, a.get().id);
  assert.ok(a.snowCover() > 0.2);
  assert.ok(Math.abs(b.snowCover() - a.snowCover()) < 1e-9);

  const old = createWeather({ clock });
  old.apply({ weather: { state: 'rain', from: 'cloudy', to: 'rain', elapsed: 10, override: null, lastSlot: 3 } });
  assert.equal(old.get().to, 'rain');
  assert.ok(Math.abs(old.get().progress - 0.4) < 1e-9);
  assert.equal(normalizeWeatherId('Light Rain'), 'rain');
});

test('temperature is colder on cold days and peaks in the afternoon', () => {
  assert.ok(temperatureF(5, 15 * 60) < 36);
  let mild = 1;
  while (isColdDay(mild)) mild++;
  assert.ok(temperatureF(mild, 15 * 60) > temperatureF(mild, 4 * 60));
  assert.ok(temperatureF(mild, 15 * 60) > 45);
});
