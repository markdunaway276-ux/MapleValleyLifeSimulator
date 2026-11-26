/**
 * Basic work/job interaction. A generic interactable (the home-office desk)
 * shows "Press E to work" / "Tap to work". Starting a job blocks input,
 * shows a short "Working…" progress bar, then advances the game clock
 * (via clock.advance, so onNewDay still fires), pays money, drains Energy,
 * and toasts the pay with sfx.play('cash').
 *
 * Jobs are data-driven (src/data/jobs.js) so later spots or NPC-given work
 * can pass a different definition. Later systems can listen for
 * `maple-worked` (detail: { job, before, after, pay, energy }).
 */

import * as THREE from 'three';
import { DESK_CENTER, DESK_SIZE, DESK_INTERACT } from '../world/interior.js';
import { DEFAULT_JOB, getJob, WORK_TIRED } from '../data/jobs.js';
import { formatCash } from './money.js';

export { DESK_CENTER, DESK_SIZE, DESK_INTERACT, DEFAULT_JOB, getJob };

const STYLE_ID = 'work-overlay-styles';

const CSS = `
#work-overlay {
  position: fixed; inset: 0; z-index: 70;
  display: none; align-items: center; justify-content: center;
  background: rgba(0, 0, 0, 0.35);
  pointer-events: auto; touch-action: none;
}
#work-overlay.is-active { display: flex; }
#work-card {
  box-sizing: border-box; width: min(240px, 86vw);
  padding: 16px 18px 18px; border-radius: 12px;
  background: rgba(0, 0, 0, 0.85); border: 1px solid rgba(255,255,255,0.3);
  color: #fff; font: 600 16px/1.3 system-ui, sans-serif;
  text-align: center; pointer-events: none;
}
#work-card .work-label { margin: 0 0 12px; letter-spacing: 0.01em; }
#work-card .work-track {
  height: 10px; border-radius: 5px;
  background: rgba(255, 255, 255, 0.18); overflow: hidden;
}
#work-card .work-fill {
  height: 100%; width: 0%; border-radius: 5px; background: #3fbf6a;
}
`;

function ensureStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

export function resolveJob(jobOrId) {
  if (!jobOrId) return DEFAULT_JOB;
  if (typeof jobOrId === 'string') return getJob(jobOrId) || DEFAULT_JOB;
  return jobOrId;
}

export function canWork(needs, jobOrId) {
  const job = resolveJob(jobOrId);
  if (!job) return false;
  const min = job.minEnergy != null ? job.minEnergy : 0;
  const energy = needs && typeof needs.get === 'function' ? Number(needs.get('energy')) : 0;
  return Number.isFinite(energy) && energy >= min;
}

/** Advance the clock by the job's game minutes (fires onNewDay if midnight is crossed). */
export function applyWork(clock, jobOrId) {
  const job = resolveJob(jobOrId);
  if (!clock || typeof clock.advance !== 'function' || !job) return null;
  const before = clock.getTime();
  const after = clock.advance(job.gameMinutes || 0);
  return { before, after, job };
}

/**
 * Invisible desk proxy for the prompt, highlighter, and E / tap path.
 * The visible desk stays in the merged interior mesh (no extra draw call
 * while the highlighter is off).
 */
export function createDesk({ job = DEFAULT_JOB, onWork } = {}) {
  const def = resolveJob(job);
  const group = new THREE.Group();
  group.name = 'desk';

  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(DESK_SIZE.width, DESK_SIZE.height, DESK_SIZE.depth),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  mesh.name = 'desk-highlight';
  mesh.position.set(0, DESK_SIZE.height / 2, 0);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  group.add(mesh);

  const verb = (def && def.verb) || 'work';
  group.userData.kind = 'work';
  group.userData.id = (def && def.id) || 'desk';
  group.userData.isDesk = true;
  group.userData.jobId = def && def.id;
  group.userData.highlightMesh = mesh;
  group.userData.interactLocal = new THREE.Vector3(
    DESK_INTERACT.x - DESK_CENTER.x,
    DESK_INTERACT.y - DESK_CENTER.y,
    DESK_INTERACT.z - DESK_CENTER.z
  );
  group.userData.getPrompt = (isMobile) => (isMobile ? `Tap to ${verb}` : `Press E to ${verb}`);
  group.userData.onWork = onWork;
  group.userData.interact = (ctx = {}) => {
    const fn = ctx.work
      || group.userData.onWork
      || (ctx.scene && ctx.scene.userData && ctx.scene.userData.work && ctx.scene.userData.work.start);
    if (typeof fn !== 'function') return false;
    return fn(ctx) !== false;
  };
  return group;
}

export function createWork({
  clock,
  dayNight = null,
  money = null,
  needs = null,
  sfx = null,
  toast = null,
  save = null,
  job = DEFAULT_JOB,
  onWorked = null,
  container = (typeof document !== 'undefined' ? document.body : null)
} = {}) {
  ensureStyles();
  const defaultJob = resolveJob(job);

  let overlay = null;
  let fillEl = null;
  let labelEl = null;
  if (container && typeof document !== 'undefined') {
    overlay = document.createElement('div');
    overlay.id = 'work-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    const card = document.createElement('div');
    card.id = 'work-card';
    labelEl = document.createElement('div');
    labelEl.className = 'work-label';
    labelEl.textContent = 'Working…';
    const track = document.createElement('div');
    track.className = 'work-track';
    fillEl = document.createElement('div');
    fillEl.className = 'work-fill';
    track.appendChild(fillEl);
    card.append(labelEl, track);
    overlay.appendChild(card);
    container.appendChild(overlay);
  }

  let phase = 'idle'; // idle | running
  let acc = 0;
  let current = null;
  let lastResult = null;

  function setProgress(t, active) {
    if (overlay) {
      overlay.classList.toggle('is-active', !!active);
      overlay.setAttribute('aria-hidden', active ? 'false' : 'true');
    }
    if (fillEl) fillEl.style.width = Math.max(0, Math.min(1, t)) * 100 + '%';
  }

  function finishPay(result) {
    const jobDef = result && result.job ? result.job : defaultJob;
    const minutes = jobDef.gameMinutes || 0;
    if (needs && minutes > 0 && typeof needs.update === 'function') {
      needs.update(minutes, { hungerOnly: true });
    }
    if (needs && jobDef.energy && typeof needs.add === 'function') {
      needs.add('energy', -Math.abs(jobDef.energy));
    }
    if (money && jobDef.pay && typeof money.add === 'function') {
      money.add(jobDef.pay);
    }
    if (sfx && jobDef.sfx && typeof sfx.play === 'function') {
      sfx.play(jobDef.sfx);
    }
    if (typeof toast === 'function' && jobDef.pay) {
      toast('+' + formatCash(jobDef.pay));
    }
    if (dayNight && typeof dayNight.apply === 'function' && result && result.after) {
      dayNight.apply(result.after);
    }
    if (typeof save === 'function') save(result);
    const detail = result || {};
    if (typeof onWorked === 'function') onWorked(detail);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('maple-worked', { detail }));
    }
    return result;
  }

  function complete() {
    const result = applyWork(clock, current || defaultJob);
    lastResult = result;
    finishPay(result);
    phase = 'idle';
    acc = 0;
    current = null;
    setProgress(1, false);
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('work-end'));
    return result;
  }

  function start(opts = {}) {
    if (phase !== 'idle') return false;
    const jobDef = resolveJob(opts.job || opts.jobId || defaultJob);
    if (!jobDef) return false;
    if (!canWork(needs, jobDef)) {
      const msg = jobDef.tiredMessage || WORK_TIRED;
      if (typeof toast === 'function') toast(msg);
      return false;
    }
    current = jobDef;
    if (opts.immediate) {
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('work-start'));
      const result = applyWork(clock, jobDef);
      lastResult = result;
      finishPay(result);
      current = null;
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('work-end'));
      return true;
    }
    if (labelEl) labelEl.textContent = jobDef.label || 'Working…';
    phase = 'running';
    acc = 0;
    setProgress(0, true);
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('work-start'));
    return true;
  }

  function update(delta) {
    if (phase !== 'running') return;
    const duration = (current && current.duration) || defaultJob.duration || 3;
    acc += Math.max(0, Number(delta) || 0);
    const t = duration > 0 ? acc / duration : 1;
    setProgress(Math.min(1, t), true);
    if (t >= 1) complete();
  }

  function dispose() {
    if (overlay) overlay.remove();
    overlay = fillEl = labelEl = null;
    phase = 'idle';
    acc = 0;
    current = null;
  }

  return {
    start,
    update,
    complete,
    applyNow: (j) => {
      const result = applyWork(clock, j || current || defaultJob);
      lastResult = result;
      return finishPay(result);
    },
    isWorking: () => phase !== 'idle',
    get phase() { return phase; },
    get progress() {
      if (phase !== 'running') return 0;
      const duration = (current && current.duration) || defaultJob.duration || 3;
      return duration > 0 ? Math.min(1, acc / duration) : 1;
    },
    get lastResult() { return lastResult; },
    get overlay() { return overlay; },
    dispose
  };
}

