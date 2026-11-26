/**
 * Small Web Audio sound API for Maple Valley. All sounds are synthesized
 * (no sample files) so the game stays mobile-friendly and has nothing to
 * download. Unlock the graph from a user gesture (the Start button) so
 * autoplay policies on iOS / Chrome allow playback.
 *
 *   sfx.play('pickup')
 *   sfx.play('door-open') / 'door-close'
 *   sfx.play('mailbox-open') / 'mailbox-close'
 *   sfx.play('footstep-grass'|'footstep-road'|'footstep-sidewalk'|'footstep-floor')
 *   later hooks: 'sleep', 'eat', 'cash', 'vending', 'car'
 *
 * Mute is stored in localStorage (not the game save). Footsteps and the
 * quiet day/night ambient are driven from update().
 */

import { periodAt } from './time.js';

export const MUTE_STORAGE_KEY = 'maple-mute';

/** Fallback street plan; matches src/world/scene.js STREET. */
export const DEFAULT_STREET = {
  length: 44,
  roadWidth: 4,
  sidewalkWidth: 1.5,
  roadCenterZ: -1.15
};

export const SFX_NAMES = [
  'pickup',
  'door-open',
  'door-close',
  'mailbox-open',
  'mailbox-close',
  'footstep-grass',
  'footstep-road',
  'footstep-sidewalk',
  'footstep-floor',
  'sleep',
  'eat',
  'cash',
  'vending',
  'car'
];

/** Metres per second used to scale footstep cadence. */
const WALK_SPEED = 4.5;
/** Seconds between steps at WALK_SPEED. */
const STEP_INTERVAL = 0.4;
const MOVE_EPSILON = 0.012;

function readMuted(storage) {
  if (!storage) return false;
  try {
    const v = storage.getItem(MUTE_STORAGE_KEY);
    return v === '1' || v === 'true';
  } catch {
    return false;
  }
}

function writeMuted(storage, muted) {
  if (!storage) return;
  try {
    storage.setItem(MUTE_STORAGE_KEY, muted ? '1' : '0');
  } catch { /* private mode, quota, … */ }
}

/**
 * Surface under a world XZ point: 'floor' (main-house interior), 'road',
 * 'sidewalk', or 'grass'. Road and sidewalk share a hard-surface family of
 * footstep sounds but stay distinct so later materials can diverge.
 */
export function surfaceAt(x, z, scene) {
  const interior = scene && scene.userData && scene.userData.interior;
  const b = interior && interior.bounds;
  if (b && x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ) return 'floor';

  const street = (scene && scene.userData && scene.userData.street) || DEFAULT_STREET;
  const halfLen = (street.length || DEFAULT_STREET.length) / 2;
  const roadHalf = (street.roadWidth || DEFAULT_STREET.roadWidth) / 2;
  const walkW = street.sidewalkWidth || DEFAULT_STREET.sidewalkWidth;
  const cz = street.roadCenterZ !== undefined ? street.roadCenterZ : DEFAULT_STREET.roadCenterZ;
  if (Math.abs(x) <= halfLen + 1e-6) {
    if (Math.abs(z - cz) <= roadHalf + 1e-6) return 'road';
    const southZ = cz - roadHalf - walkW / 2;
    const northZ = cz + roadHalf + walkW / 2;
    if (Math.abs(z - southZ) <= walkW / 2 + 1e-6) return 'sidewalk';
    if (Math.abs(z - northZ) <= walkW / 2 + 1e-6) return 'sidewalk';
  }
  return 'grass';
}

/**
 * Play the door / pickup / mailbox cue for an interactable after
 * activateTarget() has run. `before` is the pre-toggle state.
 */
export function cueInteract(sfx, target, before = {}) {
  if (!sfx || !target) return null;
  const ud = target.userData || {};
  if (ud.isDoor) {
    const name = ud.open ? 'door-open' : 'door-close';
    sfx.play(name);
    return name;
  }
  if (ud.kind === 'pickup' || (ud.picked && !before.picked)) {
    sfx.play('pickup');
    return 'pickup';
  }
  if (ud.isMailbox || ud.kind === 'mailbox') {
    const name = ud.open ? 'mailbox-open' : 'mailbox-close';
    sfx.play(name);
    if (ud.mail && ud.mail.letterTaken && !before.letterTaken) sfx.play('pickup');
    return name;
  }
  return null;
}

function AudioCtx() {
  if (typeof window === 'undefined') return null;
  return window.AudioContext || window.webkitAudioContext || null;
}

function now(ctx) {
  return (ctx && typeof ctx.currentTime === 'number') ? ctx.currentTime : 0;
}

function envGain(ctx, dest, t, peak, a, d) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  g.connect(dest);
  return g;
}

function osc(ctx, dest, t, { type = 'sine', freq = 440, freqEnd, dur = 0.12, peak = 0.12, a = 0.008, d } = {}) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(Math.max(freq, 1), t);
  if (freqEnd) {
    try { o.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 1), t + dur); } catch { /* ignore */ }
  }
  const g = envGain(ctx, dest, t, peak, a, d === undefined ? dur : d);
  o.connect(g);
  o.start(t);
  o.stop(t + dur + 0.02);
  o.onended = () => { try { o.disconnect(); g.disconnect(); } catch { /* ignore */ } };
  return o;
}

export function createSfx({
  storage = (typeof localStorage !== 'undefined' ? localStorage : null),
  getTime = () => null,
  getScene = () => null,
  audioContext = null
} = {}) {
  let ctx = audioContext || null;
  let master = null;
  let sfxGain = null;
  let ambGain = null;
  let noiseBuf = null;
  let unlocked = false;
  let muted = readMuted(storage);
  let lastPlayed = null;
  let lastSurface = null;
  let lastAmbient = null;
  let playCount = 0;
  const listeners = { mute: [] };

  let stepAcc = 0;
  let stepping = false;
  let birdTimer = 2;
  let cricketTimer = 0.4;
  let windSrc = null;
  let windFilter = null;
  let windGain = null;

  function emitMute() {
    const list = listeners.mute;
    for (let i = 0; i < list.length; i++) list[i](muted);
  }

  function on(name, fn) {
    if (!listeners[name]) listeners[name] = [];
    listeners[name].push(fn);
    return () => off(name, fn);
  }

  function off(name, fn) {
    const list = listeners[name];
    if (!list) return;
    const i = list.indexOf(fn);
    if (i >= 0) list.splice(i, 1);
  }

  function ensureGraph() {
    if (ctx) return ctx;
    const Ctor = AudioCtx();
    if (!Ctor) return null;
    try { ctx = new Ctor(); } catch { return null; }
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 1;
    master.connect(ctx.destination);
    sfxGain = ctx.createGain();
    sfxGain.gain.value = 0.85;
    sfxGain.connect(master);
    ambGain = ctx.createGain();
    ambGain.gain.value = 1;
    ambGain.connect(master);
    const n = Math.floor(ctx.sampleRate * 1.5);
    noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
    return ctx;
  }

  function applyMasterMute() {
    if (master) {
      const t = now(ctx);
      master.gain.cancelScheduledValues(t);
      master.gain.setValueAtTime(muted ? 0 : 1, t);
    }
    if (muted) stopWind();
    else if (unlocked) ensureAmbient();
  }

  function noiseBurst(t, dest, { dur = 0.12, peak = 0.12, freq = 800, q = 1.2, type = 'bandpass', a = 0.004 } = {}) {
    if (!ctx || !noiseBuf) return;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = false;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    f.Q.setValueAtTime(q, t);
    const g = envGain(ctx, dest, t, peak, a, dur);
    src.connect(f);
    f.connect(g);
    src.start(t);
    src.stop(t + dur + 0.04);
    src.onended = () => { try { src.disconnect(); f.disconnect(); g.disconnect(); } catch { /* ignore */ } };
  }

  function playFootstep(surface) {
    const t = now(ctx);
    const dest = sfxGain;
    if (surface === 'grass') {
      noiseBurst(t, dest, { dur: 0.16, peak: 0.1, freq: 700, q: 0.7, type: 'bandpass' });
      noiseBurst(t, dest, { dur: 0.1, peak: 0.05, freq: 1800, q: 0.8, type: 'bandpass' });
      return;
    }
    if (surface === 'floor') {
      osc(ctx, dest, t, { type: 'triangle', freq: 190 + Math.random() * 30, freqEnd: 110, dur: 0.14, peak: 0.14, a: 0.004 });
      noiseBurst(t, dest, { dur: 0.08, peak: 0.05, freq: 500, q: 0.8, type: 'lowpass' });
      return;
    }
    // road (duller) vs sidewalk (brighter click)
    const hard = surface === 'sidewalk';
    osc(ctx, dest, t, { type: 'sine', freq: hard ? 140 : 110, freqEnd: 70, dur: 0.08, peak: 0.12, a: 0.002 });
    noiseBurst(t, dest, {
      dur: hard ? 0.06 : 0.08,
      peak: hard ? 0.09 : 0.07,
      freq: hard ? 2200 : 900,
      q: hard ? 1.6 : 0.9,
      type: hard ? 'highpass' : 'bandpass'
    });
  }

  function playDoor(opening) {
    const t = now(ctx);
    const dest = sfxGain;
    if (opening) {
      osc(ctx, dest, t, { type: 'sawtooth', freq: 240, freqEnd: 150, dur: 0.28, peak: 0.05, a: 0.02, d: 0.26 });
      osc(ctx, dest, t, { type: 'triangle', freq: 420, freqEnd: 280, dur: 0.22, peak: 0.03, a: 0.03 });
    } else {
      osc(ctx, dest, t, { type: 'sawtooth', freq: 200, freqEnd: 120, dur: 0.18, peak: 0.05, a: 0.015 });
      osc(ctx, dest, t + 0.14, { type: 'square', freq: 700, dur: 0.05, peak: 0.05, a: 0.002, d: 0.045 });
      osc(ctx, dest, t + 0.14, { type: 'sine', freq: 90, dur: 0.1, peak: 0.1, a: 0.003 });
    }
  }

  function playMailbox(opening) {
    const t = now(ctx);
    const dest = sfxGain;
    osc(ctx, dest, t, { type: 'triangle', freq: opening ? 520 : 440, freqEnd: opening ? 380 : 300, dur: 0.12, peak: 0.1, a: 0.003 });
    noiseBurst(t, dest, { dur: 0.08, peak: 0.07, freq: 2400, q: 1.8, type: 'bandpass' });
    if (!opening) osc(ctx, dest, t + 0.08, { type: 'sine', freq: 280, dur: 0.07, peak: 0.06, a: 0.002 });
  }

  function playPickup() {
    const t = now(ctx);
    osc(ctx, sfxGain, t, { type: 'sine', freq: 880, dur: 0.08, peak: 0.12, a: 0.004 });
    osc(ctx, sfxGain, t + 0.07, { type: 'sine', freq: 1320, dur: 0.14, peak: 0.11, a: 0.004 });
  }

  function playEat() {
    const t = now(ctx);
    noiseBurst(t, sfxGain, { dur: 0.07, peak: 0.08, freq: 600, q: 0.8, type: 'bandpass' });
    noiseBurst(t + 0.08, sfxGain, { dur: 0.07, peak: 0.07, freq: 500, q: 0.8, type: 'bandpass' });
  }

  function playSleep() {
    osc(ctx, sfxGain, now(ctx), { type: 'sine', freq: 220, freqEnd: 160, dur: 0.5, peak: 0.08, a: 0.08, d: 0.4 });
  }

  function playCash() {
    const t = now(ctx);
    osc(ctx, sfxGain, t, { type: 'triangle', freq: 1800, dur: 0.07, peak: 0.1, a: 0.002 });
    osc(ctx, sfxGain, t + 0.06, { type: 'triangle', freq: 2400, dur: 0.1, peak: 0.09, a: 0.002 });
  }

  function playVending() {
    const t = now(ctx);
    osc(ctx, sfxGain, t, { type: 'square', freq: 140, dur: 0.1, peak: 0.06, a: 0.003 });
    osc(ctx, sfxGain, t + 0.14, { type: 'sine', freq: 880, dur: 0.1, peak: 0.08, a: 0.004 });
  }

  function playCar() {
    const t = now(ctx);
    osc(ctx, sfxGain, t, { type: 'sawtooth', freq: 90, freqEnd: 70, dur: 0.25, peak: 0.07, a: 0.02 });
    osc(ctx, sfxGain, t + 0.18, { type: 'sine', freq: 200, dur: 0.08, peak: 0.05, a: 0.004 });
  }

  function chirpBird() {
    if (!ctx || muted || !unlocked) return;
    const t = now(ctx);
    const f = 2200 + Math.random() * 1400;
    osc(ctx, ambGain, t, { type: 'sine', freq: f, freqEnd: f * (0.85 + Math.random() * 0.3), dur: 0.09 + Math.random() * 0.06, peak: 0.035, a: 0.01 });
    if (Math.random() < 0.6) {
      osc(ctx, ambGain, t + 0.1, { type: 'sine', freq: f * 1.15, freqEnd: f, dur: 0.08, peak: 0.028, a: 0.01 });
    }
  }

  function chirpCricket() {
    if (!ctx || muted || !unlocked) return;
    const t = now(ctx);
    const pulses = 3 + (Math.random() < 0.5 ? 0 : 1);
    for (let i = 0; i < pulses; i++) {
      osc(ctx, ambGain, t + i * 0.055, { type: 'sine', freq: 4800 + Math.random() * 800, dur: 0.03, peak: 0.03, a: 0.004, d: 0.025 });
    }
  }

  function stopWind() {
    if (windSrc) {
      try { windSrc.stop(); } catch { /* already stopped */ }
      try { windSrc.disconnect(); } catch { /* ignore */ }
      windSrc = null;
    }
    if (windFilter) { try { windFilter.disconnect(); } catch { /* ignore */ } windFilter = null; }
    if (windGain) { try { windGain.disconnect(); } catch { /* ignore */ } windGain = null; }
  }

  function startWind(mode) {
    if (!ctx || !noiseBuf || muted) return;
    stopWind();
    const t = now(ctx);
    windSrc = ctx.createBufferSource();
    windSrc.buffer = noiseBuf;
    windSrc.loop = true;
    windFilter = ctx.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.setValueAtTime(mode === 'night' ? 280 : 420, t);
    windGain = ctx.createGain();
    windGain.gain.setValueAtTime(mode === 'night' ? 0.018 : 0.024, t);
    windSrc.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(ambGain);
    try { windSrc.start(t); } catch { /* ignore */ }
  }

  function ambientMode(time) {
    const period = (time && time.period) || periodAt(time && time.minutes != null ? time.minutes : 8 * 60);
    return (period === 'night' || period === 'dusk') ? 'night' : 'day';
  }

  function ensureAmbient(time) {
    if (!unlocked || muted) return;
    const mode = ambientMode(time || (typeof getTime === 'function' ? getTime() : null));
    const changed = mode !== lastAmbient;
    lastAmbient = mode;
    if (!ensureGraph()) return;
    if (changed || !windSrc) startWind(mode);
  }

  function play(name) {
    playCount += 1;
    lastPlayed = name;
    if (name && name.startsWith('footstep-')) lastSurface = name.slice('footstep-'.length);
    if (!unlocked || muted) return false;
    if (!ensureGraph()) return false;
    if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
      const p = ctx.resume();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    }
    switch (name) {
      case 'pickup': playPickup(); break;
      case 'door-open': playDoor(true); break;
      case 'door-close': playDoor(false); break;
      case 'mailbox-open': playMailbox(true); break;
      case 'mailbox-close': playMailbox(false); break;
      case 'footstep-grass':
      case 'footstep-road':
      case 'footstep-sidewalk':
      case 'footstep-floor':
        playFootstep(name.slice('footstep-'.length));
        break;
      case 'footstep': {
        const scene = typeof getScene === 'function' ? getScene() : null;
        const surface = lastSurface || 'grass';
        playFootstep(surface);
        lastPlayed = 'footstep-' + surface;
        break;
      }
      case 'sleep': playSleep(); break;
      case 'eat': playEat(); break;
      case 'cash': playCash(); break;
      case 'vending': playVending(); break;
      case 'car': playCar(); break;
      default:
        return false;
    }
    return true;
  }

  function unlock() {
    unlocked = true;
    const graph = ensureGraph();
    if (graph && graph.state === 'suspended' && typeof graph.resume === 'function') {
      const p = graph.resume();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    }
    ensureAmbient();
    return true;
  }

  function isMuted() { return muted; }

  function setMuted(next) {
    const v = !!next;
    if (v === muted) {
      writeMuted(storage, muted);
      return muted;
    }
    muted = v;
    writeMuted(storage, muted);
    applyMasterMute();
    emitMute();
    return muted;
  }

  function toggleMuted() {
    return setMuted(!muted);
  }

  function update(delta, opts = {}) {
    const dt = Math.max(0, delta || 0);
    const time = opts.time || (typeof getTime === 'function' ? getTime() : null);
    const scene = opts.scene || (typeof getScene === 'function' ? getScene() : null);

    if (unlocked && !muted) {
      ensureAmbient(time);
      if (lastAmbient === 'day') {
        birdTimer -= dt;
        if (birdTimer <= 0) {
          chirpBird();
          birdTimer = 4 + Math.random() * 7;
        }
      } else if (lastAmbient === 'night') {
        cricketTimer -= dt;
        if (cricketTimer <= 0) {
          chirpCricket();
          cricketTimer = 0.55 + Math.random() * 0.5;
        }
      }
    } else if (muted) {
      stopWind();
    }

    const onGround = opts.onGround !== false;
    const moved = opts.moved != null ? opts.moved : 0;
    const x = opts.x;
    const z = opts.z;
    if (!unlocked || x == null || z == null || !onGround || moved < MOVE_EPSILON) {
      if (moved < MOVE_EPSILON || !onGround) {
        stepping = false;
        stepAcc = 0;
      }
      return;
    }
    const surface = surfaceAt(x, z, scene);
    lastSurface = surface;
    const speed = dt > 1e-4 ? moved / dt : WALK_SPEED;
    const interval = STEP_INTERVAL * (WALK_SPEED / Math.max(speed, 1.2));
    if (!stepping) {
      stepping = true;
      stepAcc = 0;
      play('footstep-' + surface);
      return;
    }
    stepAcc += dt;
    if (stepAcc >= interval) {
      stepAcc -= interval;
      play('footstep-' + surface);
    }
  }

  function dispose() {
    stopWind();
    if (ctx && typeof ctx.close === 'function') {
      try { ctx.close(); } catch { /* ignore */ }
    }
    ctx = null;
    master = sfxGain = ambGain = noiseBuf = null;
    listeners.mute.length = 0;
  }

  return {
    play,
    unlock,
    update,
    setMuted,
    toggleMuted,
    isMuted,
    isUnlocked: () => unlocked,
    on,
    off,
    dispose,
    surfaceAt: (x, z, scene) => surfaceAt(x, z, scene || (typeof getScene === 'function' ? getScene() : null)),
    get lastPlayed() { return lastPlayed; },
    get lastSurface() { return lastSurface; },
    get lastAmbient() { return lastAmbient; },
    get playCount() { return playCount; },
    get context() { return ctx; }
  };
}
