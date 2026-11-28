/**
 * Style phone app: smooth illustrated full-body character preview with
 * natural proportions, soft studio shading, hair & facial features, and
 * sleek Material You colour swatches driven by APPEARANCE_SLOTS.
 */

import {
  APPEARANCE_SLOTS,
  getOption,
  getOptionColor,
  normalizeAppearance
} from '../../data/appearance.js';

const STYLE_ID = 'maple-phone-style-css';
export const STYLE_PREVIEW_WIDTH = 260;
export const STYLE_PREVIEW_HEIGHT = 320;

const CSS = `
.phone-style {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-bottom: 10px;
}
.phone-style-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.phone-style-shuffle {
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  color: #e9eef7;
  font: 600 11px/1 system-ui, sans-serif;
  padding: 6px 11px;
  cursor: pointer;
  touch-action: manipulation;
}
.phone-style-shuffle:hover { background: rgba(255, 255, 255, 0.16); }

.phone-style-preview {
  align-self: center;
  width: 186px;
  height: 228px;
  border-radius: 20px;
  overflow: hidden;
  background: radial-gradient(circle at 50% 34%, #2c374d 0%, #192030 72%, #131824 100%);
  border: 1px solid rgba(255, 255, 255, 0.10);
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.36);
}
.phone-style-preview canvas {
  display: block;
  width: 100%;
  height: 100%;
}
.phone-style-slot {
  background: rgba(255, 255, 255, 0.045);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 16px;
  padding: 9px 10px 10px;
}
.phone-style-slot-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin: 0 0 8px;
}
.phone-style-slot-name {
  margin: 0;
  font: 600 12.5px/1.2 system-ui, sans-serif;
  color: rgba(255, 255, 255, 0.88);
}
.phone-style-slot-val {
  font: 500 11px/1.2 system-ui, sans-serif;
  color: rgba(168, 199, 250, 0.88);
}
.phone-style-swatches {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}
.phone-style-swatch {
  position: relative;
  box-sizing: border-box;
  width: 34px;
  height: 34px;
  min-width: 34px;
  min-height: 34px;
  padding: 0;
  border: 2px solid rgba(255, 255, 255, 0.22);
  border-radius: 50%;
  cursor: pointer;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  box-shadow: inset 0 2px 4px rgba(255, 255, 255, 0.22), inset 0 -2px 4px rgba(0, 0, 0, 0.28);
  transition: transform 0.12s ease, border-color 0.12s ease, box-shadow 0.12s ease;
}
.phone-style-swatch:hover, .phone-style-swatch:focus {
  outline: none;
  transform: scale(1.08);
}
.phone-style-swatch.is-selected {
  border-color: #ffffff;
  box-shadow: 0 0 0 2.5px #669df6, inset 0 2px 4px rgba(255, 255, 255, 0.24);
  transform: scale(1.06);
}
.phone-style-swatch.is-selected::after {
  content: '✓';
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font: 800 14px/1 system-ui, sans-serif;
  color: #ffffff;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.65);
}
`;

function ensureStyles() {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

function shadeHex(hex, factor) {
  const clean = String(hex || '#888888').replace('#', '');
  const full = clean.length === 3
    ? clean.split('').map((c) => c + c).join('')
    : clean.padEnd(6, '8');
  const num = parseInt(full.slice(0, 6), 16);
  if (!Number.isFinite(num)) return '#888888';
  let r = (num >> 16) & 255;
  let g = (num >> 8) & 255;
  let b = num & 255;
  if (factor >= 0) {
    r = Math.round(r + (255 - r) * factor);
    g = Math.round(g + (255 - g) * factor);
    b = Math.round(b + (255 - b) * factor);
  } else {
    const k = 1 + factor;
    r = Math.round(r * k);
    g = Math.round(g * k);
    b = Math.round(b * k);
  }
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

function roundedRectPath(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function drawCapsule(ctx, x1, y1, x2, y2, r1, r2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  ctx.beginPath();
  ctx.moveTo(x1 + nx * r1, y1 + ny * r1);
  ctx.lineTo(x2 + nx * r2, y2 + ny * r2);
  ctx.arc(x2, y2, r2, Math.atan2(ny, nx), Math.atan2(-ny, -nx), false);
  ctx.lineTo(x1 - nx * r1, y1 - ny * r1);
  ctx.arc(x1, y1, r1, Math.atan2(-ny, -nx), Math.atan2(ny, nx), false);
  ctx.closePath();
}

/** Paint a smooth, naturally proportioned front-view character onto `canvas`. */
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
  const hair = getOptionColor('hair', state.hair, slots);
  const shoes = getOptionColor('shoes', state.shoes, slots);

  const skinHi = shadeHex(skin, 0.16);
  const skinLo = shadeHex(skin, -0.18);
  const shirtHi = shadeHex(shirt, 0.18);
  const shirtLo = shadeHex(shirt, -0.22);
  const pantsHi = shadeHex(pants, 0.14);
  const pantsLo = shadeHex(pants, -0.24);
  const hairHi = shadeHex(hair, 0.18);
  const hairLo = shadeHex(hair, -0.26);

  ctx.clearRect(0, 0, w, h);

  // Studio dressing-room backdrop
  const bg = ctx.createRadialGradient(w * 0.5, h * 0.34, w * 0.06, w * 0.5, h * 0.45, h * 0.68);
  bg.addColorStop(0, '#32415b');
  bg.addColorStop(0.58, '#1b2334');
  bg.addColorStop(1, '#121723');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Subtle floor horizon & soft character shadow
  const floorY = h * 0.905;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.fillRect(0, floorY - h * 0.03, w, h * 0.14);
  const shadow = ctx.createRadialGradient(w * 0.5, floorY, 4, w * 0.5, floorY, w * 0.28);
  shadow.addColorStop(0, 'rgba(0, 0, 0, 0.55)');
  shadow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = shadow;
  ctx.beginPath();
  ctx.ellipse(w * 0.5, floorY, w * 0.28, h * 0.032, 0, 0, Math.PI * 2);
  ctx.fill();

  const cx = w * 0.5;
  const s = h / 320; // uniform scale factor

  // Key vertical landmarks
  const headCy = 54 * s;
  const neckTop = 76 * s;
  const shoulderY = 95 * s;
  const waistY = 178 * s;
  const hipY = 194 * s;
  const kneeY = 236 * s;
  const ankleY = 278 * s;

  // --- 1. Shoes (sculpted casual sneakers) ---
  for (const dir of [-1, 1]) {
    const sx = cx + dir * 21 * s;
    ctx.save();
    // Upper shoe
    ctx.fillStyle = shoes;
    ctx.beginPath();
    ctx.moveTo(sx - 10 * s * dir, ankleY - 2 * s);
    ctx.quadraticCurveTo(sx + 13 * s * dir, ankleY + 1 * s, sx + 16 * s * dir, ankleY + 11 * s);
    ctx.lineTo(sx - 11 * s * dir, ankleY + 11 * s);
    ctx.quadraticCurveTo(sx - 12 * s * dir, ankleY + 3 * s, sx - 10 * s * dir, ankleY - 2 * s);
    ctx.closePath();
    ctx.fill();
    // Crisp white sneaker midsole
    ctx.fillStyle = '#e7ecf3';
    roundedRectPath(
      ctx,
      dir > 0 ? sx - 11 * s : sx - 16 * s,
      ankleY + 9 * s,
      27 * s,
      4.5 * s,
      2.5 * s
    );
    ctx.fill();
    ctx.restore();
  }

  // --- 2. Pants (contoured hips & tapered legs) ---
  const pantsGrad = ctx.createLinearGradient(cx - 34 * s, waistY, cx + 34 * s, waistY);
  pantsGrad.addColorStop(0, pantsLo);
  pantsGrad.addColorStop(0.28, pantsHi);
  pantsGrad.addColorStop(0.5, pants);
  pantsGrad.addColorStop(0.75, pantsHi);
  pantsGrad.addColorStop(1, pantsLo);
  ctx.fillStyle = pantsGrad;

  // Left & right contoured trouser legs
  ctx.beginPath();
  ctx.moveTo(cx - 30 * s, waistY);
  ctx.quadraticCurveTo(cx - 34 * s, hipY + 8 * s, cx - 31 * s, kneeY);
  ctx.lineTo(cx - 27 * s, ankleY + 1 * s);
  ctx.lineTo(cx - 10 * s, ankleY + 1 * s);
  ctx.lineTo(cx - 8 * s, kneeY);
  ctx.quadraticCurveTo(cx - 5 * s, hipY + 10 * s, cx, hipY + 6 * s);
  ctx.quadraticCurveTo(cx + 5 * s, hipY + 10 * s, cx + 8 * s, kneeY);
  ctx.lineTo(cx + 10 * s, ankleY + 1 * s);
  ctx.lineTo(cx + 27 * s, ankleY + 1 * s);
  ctx.lineTo(cx + 31 * s, kneeY);
  ctx.quadraticCurveTo(cx + 34 * s, hipY + 8 * s, cx + 30 * s, waistY);
  ctx.closePath();
  ctx.fill();

  // Subtle center fly & inner seam shading
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.22)';
  ctx.lineWidth = 1.4 * s;
  ctx.beginPath();
  ctx.moveTo(cx, waistY + 4 * s);
  ctx.lineTo(cx, hipY + 5 * s);
  ctx.stroke();

  // Belt & silver buckle
  ctx.fillStyle = '#251e1a';
  roundedRectPath(ctx, cx - 30 * s, waistY - 2 * s, 60 * s, 7.5 * s, 2.5 * s);
  ctx.fill();
  ctx.fillStyle = '#c8d0db';
  roundedRectPath(ctx, cx - 5.5 * s, waistY - 1.5 * s, 11 * s, 6.5 * s, 1.5 * s);
  ctx.fill();

  // --- 3. Arms & Hands (relaxed anatomical curve) ---
  for (const dir of [-1, 1]) {
    const shX = cx + dir * 35 * s;
    const shY = shoulderY + 7 * s;
    const elX = cx + dir * 45 * s;
    const elY = shoulderY + 49 * s;
    const wrX = cx + dir * 43 * s;
    const wrY = waistY + 13 * s;

    // Forearm (skin)
    const armGrad = ctx.createLinearGradient(elX - 8 * s, elY, elX + 8 * s, elY);
    armGrad.addColorStop(0, skinLo);
    armGrad.addColorStop(0.5, skin);
    armGrad.addColorStop(1, skinHi);
    ctx.fillStyle = armGrad;
    drawCapsule(ctx, elX, elY, wrX, wrY, 8.2 * s, 6.4 * s);
    ctx.fill();

    // Shaped hand (palm + gentle thumb)
    ctx.beginPath();
    ctx.ellipse(wrX, wrY + 9 * s, 6.6 * s, 9.8 * s, dir * 0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(wrX - dir * 5.2 * s, wrY + 6 * s, 3.0 * s, 5.2 * s, -dir * 0.35, 0, Math.PI * 2);
    ctx.fill();

    // Short sleeve (shirt)
    const slGrad = ctx.createLinearGradient(shX - 10 * s, shY, shX + 10 * s, shY);
    slGrad.addColorStop(0, shirtLo);
    slGrad.addColorStop(0.45, shirtHi);
    slGrad.addColorStop(1, shirtLo);
    ctx.fillStyle = slGrad;
    drawCapsule(ctx, shX, shY, elX - dir * 1 * s, elY - 4 * s, 11.5 * s, 9.6 * s);
    ctx.fill();
  }

  // --- 4. Torso / Shirt (sloped shoulders, natural waist & fabric folds) ---
  const torsoGrad = ctx.createLinearGradient(cx - 38 * s, shoulderY, cx + 38 * s, shoulderY);
  torsoGrad.addColorStop(0, shirtLo);
  torsoGrad.addColorStop(0.30, shirtHi);
  torsoGrad.addColorStop(0.55, shirt);
  torsoGrad.addColorStop(1, shirtLo);
  ctx.fillStyle = torsoGrad;

  ctx.beginPath();
  ctx.moveTo(cx - 14 * s, neckTop + 11 * s);
  ctx.quadraticCurveTo(cx - 34 * s, shoulderY - 1 * s, cx - 39 * s, shoulderY + 12 * s);
  ctx.quadraticCurveTo(cx - 34 * s, shoulderY + 46 * s, cx - 31 * s, waistY + 2 * s);
  ctx.quadraticCurveTo(cx, waistY + 6 * s, cx + 31 * s, waistY + 2 * s);
  ctx.quadraticCurveTo(cx + 34 * s, shoulderY + 46 * s, cx + 39 * s, shoulderY + 12 * s);
  ctx.quadraticCurveTo(cx + 34 * s, shoulderY - 1 * s, cx + 14 * s, neckTop + 11 * s);
  ctx.closePath();
  ctx.fill();

  // Subtle fabric fold shadows on shirt
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.12)';
  ctx.lineWidth = 1.5 * s;
  ctx.beginPath();
  ctx.moveTo(cx - 18 * s, shoulderY + 34 * s);
  ctx.quadraticCurveTo(cx - 12 * s, waistY - 16 * s, cx - 16 * s, waistY - 2 * s);
  ctx.moveTo(cx + 18 * s, shoulderY + 34 * s);
  ctx.quadraticCurveTo(cx + 12 * s, waistY - 16 * s, cx + 16 * s, waistY - 2 * s);
  ctx.stroke();

  // Crewneck collar rib
  ctx.strokeStyle = shirtLo;
  ctx.lineWidth = 3.2 * s;
  ctx.beginPath();
  ctx.arc(cx, neckTop + 11 * s, 14.5 * s, 0.14 * Math.PI, 0.86 * Math.PI);
  ctx.stroke();

  // --- 5. Neck & Chin Shadow ---
  const neckGrad = ctx.createLinearGradient(cx - 11 * s, neckTop, cx + 11 * s, neckTop);
  neckGrad.addColorStop(0, skinLo);
  neckGrad.addColorStop(0.5, skin);
  neckGrad.addColorStop(1, skinLo);
  ctx.fillStyle = neckGrad;
  ctx.beginPath();
  ctx.moveTo(cx - 9.5 * s, neckTop - 4 * s);
  ctx.lineTo(cx - 11 * s, neckTop + 14 * s);
  ctx.quadraticCurveTo(cx, neckTop + 23 * s, cx + 11 * s, neckTop + 14 * s);
  ctx.lineTo(cx + 9.5 * s, neckTop - 4 * s);
  ctx.closePath();
  ctx.fill();

  // Chin cast shadow on neck
  ctx.fillStyle = 'rgba(0, 0, 0, 0.16)';
  ctx.beginPath();
  ctx.ellipse(cx, neckTop + 2 * s, 9.5 * s, 4.5 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  // --- 6. Ears & Smooth Sculpted Head ---
  ctx.fillStyle = skinLo;
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(cx + dir * 21.5 * s, headCy + 2 * s, 4.2 * s, 6.8 * s, dir * 0.1, 0, Math.PI * 2);
    ctx.fill();
  }

  const faceGrad = ctx.createRadialGradient(cx - 5 * s, headCy - 7 * s, 4 * s, cx, headCy, 28 * s);
  faceGrad.addColorStop(0, skinHi);
  faceGrad.addColorStop(0.68, skin);
  faceGrad.addColorStop(1, skinLo);
  ctx.fillStyle = faceGrad;
  ctx.beginPath();
  ctx.moveTo(cx, headCy - 24 * s);
  ctx.bezierCurveTo(cx + 22 * s, headCy - 24 * s, cx + 23 * s, headCy + 6 * s, cx + 14 * s, headCy + 19 * s);
  ctx.quadraticCurveTo(cx, headCy + 28 * s, cx - 14 * s, headCy + 19 * s);
  ctx.bezierCurveTo(cx - 23 * s, headCy + 6 * s, cx - 22 * s, headCy - 24 * s, cx, headCy - 24 * s);
  ctx.closePath();
  ctx.fill();

  // --- 7. Stylized Hair with Crown Highlight ---
  const hairGrad = ctx.createLinearGradient(cx, headCy - 30 * s, cx, headCy - 2 * s);
  hairGrad.addColorStop(0, hairHi);
  hairGrad.addColorStop(0.55, hair);
  hairGrad.addColorStop(1, hairLo);
  ctx.fillStyle = hairGrad;
  ctx.beginPath();
  ctx.moveTo(cx - 22 * s, headCy - 2 * s);
  ctx.bezierCurveTo(cx - 26 * s, headCy - 22 * s, cx - 14 * s, headCy - 32 * s, cx + 2 * s, headCy - 31 * s);
  ctx.bezierCurveTo(cx + 18 * s, headCy - 30 * s, cx + 26 * s, headCy - 18 * s, cx + 22 * s, headCy - 1 * s);
  ctx.quadraticCurveTo(cx + 18 * s, headCy - 11 * s, cx + 11 * s, headCy - 13 * s);
  ctx.quadraticCurveTo(cx - 2 * s, headCy - 9 * s, cx - 14 * s, headCy - 14 * s);
  ctx.quadraticCurveTo(cx - 19 * s, headCy - 10 * s, cx - 22 * s, headCy - 2 * s);
  ctx.closePath();
  ctx.fill();

  // Soft crown highlight
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.lineWidth = 2.2 * s;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(cx - 2 * s, headCy - 14 * s, 12 * s, Math.PI * 1.18, Math.PI * 1.62);
  ctx.stroke();

  // --- 8. Expressive Face (eyebrows, eyes with catchlights, nose, warm smile) ---
  for (const dir of [-1, 1]) {
    const ex = cx + dir * 8.2 * s;
    const ey = headCy + 1.5 * s;
    // Eyebrow
    ctx.strokeStyle = hairLo;
    ctx.lineWidth = 1.9 * s;
    ctx.beginPath();
    ctx.moveTo(ex - 4.2 * s, ey - 5.2 * s);
    ctx.quadraticCurveTo(ex, ey - 6.8 * s, ex + 4.2 * s, ey - 5.0 * s);
    ctx.stroke();
    // Sclera
    ctx.fillStyle = '#f6f8fa';
    ctx.beginPath();
    ctx.ellipse(ex, ey, 3.6 * s, 2.3 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    // Iris & pupil
    ctx.fillStyle = '#2b2420';
    ctx.beginPath();
    ctx.arc(ex, ey, 1.85 * s, 0, Math.PI * 2);
    ctx.fill();
    // Catchlight
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ex - 0.6 * s, ey - 0.6 * s, 0.65 * s, 0, Math.PI * 2);
    ctx.fill();
  }

  // Subtle nose bridge & tip shadow
  ctx.strokeStyle = shadeHex(skin, -0.26);
  ctx.lineWidth = 1.35 * s;
  ctx.beginPath();
  ctx.moveTo(cx, headCy + 2.5 * s);
  ctx.quadraticCurveTo(cx + 1.4 * s, headCy + 8.5 * s, cx - 0.6 * s, headCy + 9.5 * s);
  ctx.stroke();

  // Friendly smile
  ctx.strokeStyle = shadeHex(skin, -0.34);
  ctx.lineWidth = 1.65 * s;
  ctx.beginPath();
  ctx.arc(cx, headCy + 11.2 * s, 5.2 * s, 0.16 * Math.PI, 0.84 * Math.PI);
  ctx.stroke();

  return {
    skin,
    shirt,
    pants,
    head: { x: cx, y: headCy },
    torso: { x: cx, y: (shoulderY + waistY) * 0.5 },
    leg: { x: cx - 19 * s, y: (hipY + ankleY) * 0.5 }
  };
}

function readAppearance(ctx) {
  if (ctx && typeof ctx.getAppearance === 'function') return ctx.getAppearance();
  return ctx && ctx.appearance ? ctx.appearance : {};
}

export function renderStyleApp(screen, ctx = {}) {
  ensureStyles();
  const slots = (ctx && ctx.slots) || APPEARANCE_SLOTS;

  const topRow = document.createElement('div');
  topRow.className = 'phone-style-top';
  const title = document.createElement('h3');
  title.className = 'phone-app-title';
  title.style.margin = '0';
  title.textContent = 'Style';
  const shuffleBtn = document.createElement('button');
  shuffleBtn.type = 'button';
  shuffleBtn.className = 'phone-style-shuffle';
  shuffleBtn.textContent = 'Shuffle';
  shuffleBtn.title = 'Try a random outfit';
  topRow.append(title, shuffleBtn);

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
  const valueBadges = new Map();

  function paint(state) {
    const current = normalizeAppearance(state || readAppearance(ctx), slots);
    drawStylePreview(canvas, current, slots);
    for (let i = 0; i < swatchButtons.length; i++) {
      const btn = swatchButtons[i];
      const on = current[btn.dataset.slot] === btn.dataset.option;
      btn.classList.toggle('is-selected', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    for (const [slotId, badge] of valueBadges.entries()) {
      const opt = getOption(slotId, current[slotId], slots);
      badge.textContent = (opt && opt.name) || current[slotId] || '';
    }
  }

  shuffleBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const next = { ...readAppearance(ctx) };
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      if (!slot || !slot.options || !slot.options.length) continue;
      const pick = slot.options[Math.floor(Math.random() * slot.options.length)];
      if (pick) {
        next[slot.id] = pick.id;
        if (ctx && typeof ctx.setAppearance === 'function') ctx.setAppearance(slot.id, pick.id);
      }
    }
    paint(next);
  });

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    if (!slot || !slot.options) continue;
    const section = document.createElement('div');
    section.className = 'phone-style-slot';
    section.dataset.slot = slot.id;
    const head = document.createElement('div');
    head.className = 'phone-style-slot-head';
    const label = document.createElement('p');
    label.className = 'phone-style-slot-name';
    label.textContent = slot.name || slot.id;
    const badge = document.createElement('span');
    badge.className = 'phone-style-slot-val';
    valueBadges.set(slot.id, badge);
    head.append(label, badge);

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
    section.append(head, row);
    root.appendChild(section);
  }

  root.insertBefore(previewWrap, root.firstChild);
  screen.append(topRow, root);
  paint();

  const off = ctx && typeof ctx.onAppearanceChange === 'function'
    ? ctx.onAppearanceChange((state) => paint(state))
    : null;

  return () => { if (typeof off === 'function') off(); };
}
