/**
 * Style phone app: a cheap 2D front-view preview of the figure plus
 * touch-friendly colour swatches driven by APPEARANCE_SLOTS.
 */

import {
  APPEARANCE_SLOTS,
  getOptionColor,
  normalizeAppearance
} from '../../data/appearance.js';

const STYLE_ID = 'maple-phone-style-css';
export const STYLE_PREVIEW_WIDTH = 160;
export const STYLE_PREVIEW_HEIGHT = 200;

const CSS = `
.phone-style {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-bottom: 8px;
}
.phone-style-preview {
  align-self: center;
  width: 140px;
  height: 176px;
  border-radius: 12px;
  overflow: hidden;
  background: #1a2030;
}
.phone-style-preview canvas {
  display: block;
  width: 100%;
  height: 100%;
}
.phone-style-slot-name {
  margin: 0 0 8px;
  font: 600 13px/1.2 system-ui, sans-serif;
  color: rgba(255, 255, 255, 0.78);
}
.phone-style-swatches {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.phone-style-swatch {
  box-sizing: border-box;
  width: 44px;
  height: 44px;
  min-width: 44px;
  min-height: 44px;
  padding: 0;
  border: 2px solid rgba(255, 255, 255, 0.28);
  border-radius: 10px;
  cursor: pointer;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}
.phone-style-swatch:hover, .phone-style-swatch:focus {
  outline: none;
  filter: brightness(1.08);
}
.phone-style-swatch.is-selected {
  border-color: #fff;
  box-shadow: 0 0 0 2px #8fddb0;
}
`;

function ensureStyles() {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

function fillRoundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
  ctx.fill();
}

/** Paint a front-view figure onto `canvas` from an appearance state. */
export function drawStylePreview(canvas, appearance, slots = APPEARANCE_SLOTS) {
  if (!canvas || typeof canvas.getContext !== 'function') return null;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const w = canvas.width || STYLE_PREVIEW_WIDTH;
  const h = canvas.height || STYLE_PREVIEW_HEIGHT;
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;

  const state = normalizeAppearance(appearance, slots);
  const skin = getOptionColor('skin', state.skin, slots);
  const shirt = getOptionColor('shirt', state.shirt, slots);
  const pants = getOptionColor('pants', state.pants, slots);

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#1a2030';
  ctx.fillRect(0, 0, w, h);

  const cx = w * 0.5;
  const headR = h * 0.09;
  const headCy = h * 0.18;
  const neckH = h * 0.04;
  const torsoW = w * 0.34;
  const torsoH = h * 0.28;
  const torsoTop = headCy + headR * 0.7;
  const armW = w * 0.09;
  const sleeveH = torsoH * 0.62;
  const handH = h * 0.09;
  const legW = w * 0.13;
  const waist = torsoTop + torsoH;
  const legH = h * 0.28;
  const footH = h * 0.035;

  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(cx, headCy, headR, 0, Math.PI * 2);
  ctx.fill();
  fillRoundRect(ctx, cx - w * 0.05, headCy + headR * 0.55, w * 0.10, neckH, 3);

  ctx.fillStyle = shirt;
  fillRoundRect(ctx, cx - torsoW / 2, torsoTop, torsoW, torsoH, 8);
  fillRoundRect(ctx, cx - torsoW / 2 - armW + 2, torsoTop + 4, armW, sleeveH, 6);
  fillRoundRect(ctx, cx + torsoW / 2 - 2, torsoTop + 4, armW, sleeveH, 6);

  ctx.fillStyle = skin;
  fillRoundRect(ctx, cx - torsoW / 2 - armW + 4, torsoTop + 4 + sleeveH - 2, armW - 4, handH, 5);
  fillRoundRect(ctx, cx + torsoW / 2, torsoTop + 4 + sleeveH - 2, armW - 4, handH, 5);

  ctx.fillStyle = pants;
  fillRoundRect(ctx, cx - legW - 2, waist - 4, legW, legH, 6);
  fillRoundRect(ctx, cx + 2, waist - 4, legW, legH, 6);
  fillRoundRect(ctx, cx - legW - 4, waist - 4 + legH - 2, legW + 4, footH, 3);
  fillRoundRect(ctx, cx + 2, waist - 4 + legH - 2, legW + 4, footH, 3);

  return { skin, shirt, pants, head: { x: cx, y: headCy }, torso: { x: cx, y: torsoTop + torsoH * 0.5 }, leg: { x: cx - legW / 2 - 2, y: waist - 4 + legH * 0.5 } };
}

function readAppearance(ctx) {
  if (ctx && typeof ctx.getAppearance === 'function') return ctx.getAppearance();
  return ctx && ctx.appearance ? ctx.appearance : {};
}

export function renderStyleApp(screen, ctx = {}) {
  ensureStyles();
  const slots = (ctx && ctx.slots) || APPEARANCE_SLOTS;

  const title = document.createElement('h3');
  title.className = 'phone-app-title';
  title.textContent = 'Style';

  const root = document.createElement('div');
  root.className = 'phone-style';

  const previewWrap = document.createElement('div');
  previewWrap.className = 'phone-style-preview';
  const canvas = document.createElement('canvas');
  canvas.width = STYLE_PREVIEW_WIDTH;
  canvas.height = STYLE_PREVIEW_HEIGHT;
  canvas.setAttribute('aria-label', 'Appearance preview');
  previewWrap.appendChild(canvas);

  const swatchButtons = [];

  function paint(state) {
    const current = normalizeAppearance(state || readAppearance(ctx), slots);
    drawStylePreview(canvas, current, slots);
    for (let i = 0; i < swatchButtons.length; i++) {
      const btn = swatchButtons[i];
      const on = current[btn.dataset.slot] === btn.dataset.option;
      btn.classList.toggle('is-selected', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
  }

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    if (!slot || !slot.options) continue;
    const section = document.createElement('div');
    section.className = 'phone-style-slot';
    section.dataset.slot = slot.id;
    const label = document.createElement('p');
    label.className = 'phone-style-slot-name';
    label.textContent = slot.name || slot.id;
    const row = document.createElement('div');
    row.className = 'phone-style-swatches';
    for (let j = 0; j < slot.options.length; j++) {
      const option = slot.options[j];
      if (!option) continue;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'phone-style-swatch';
      btn.dataset.slot = slot.id;
      btn.dataset.option = option.id;
      btn.style.background = option.color || '#888';
      btn.setAttribute('aria-label', (slot.name || slot.id) + ': ' + (option.name || option.id));
      btn.title = option.name || option.id;
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (ctx && typeof ctx.setAppearance === 'function') ctx.setAppearance(slot.id, option.id);
        else paint({ ...readAppearance(ctx), [slot.id]: option.id });
      });
      swatchButtons.push(btn);
      row.appendChild(btn);
    }
    section.append(label, row);
    root.appendChild(section);
  }

  // Preview sits above the swatches.
  root.insertBefore(previewWrap, root.firstChild);
  screen.append(title, root);
  paint();

  const off = ctx && typeof ctx.onAppearanceChange === 'function'
    ? ctx.onAppearanceChange((state) => paint(state))
    : null;

  return () => { if (typeof off === 'function') off(); };
}
