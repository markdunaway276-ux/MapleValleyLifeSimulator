import { readGithubFeedbackConfig, writeGithubFeedbackConfig, createGithubFeedback, DEFAULT_REPO } from '../systems/githubFeedback.js';

/**
 * Shared look and building blocks for the full-screen menus (title screen and
 * pause menu): panel, buttons, sliders, tabs, and the tabbed Settings panel
 * (Display, Sound, Controls, Graphics).
 */

const STYLE_ID = 'mv-menu-styles';
const CSS = `
.mv-overlay {
  position: fixed; inset: 0; z-index: 70; display: none; align-items: center; justify-content: center;
  background: rgba(12, 9, 6, 0.55); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
  font: 15px system-ui, sans-serif; color: #f3ece2;
}
.mv-overlay.is-open { display: flex; }
.mv-panel {
  width: min(400px, 90vw); max-height: 88vh; overflow-y: auto; padding: 22px 20px 18px; box-sizing: border-box;
  background: rgba(30, 26, 22, 0.95); border: 1px solid rgba(255,255,255,0.12); border-radius: 16px;
  box-shadow: 0 18px 50px rgba(0,0,0,0.5);
}
.mv-panel.is-wide { width: min(640px, 94vw); }
.mv-panel h2 { margin: 0 0 4px; font-size: 24px; letter-spacing: 0.04em; text-align: center; }
.mv-panel h3 { margin: 16px 0 6px; font-size: 15px; opacity: 0.85; }
.mv-sub { margin: 0 0 14px; text-align: center; opacity: 0.7; font-size: 13px; }
.mv-btn {
  display: block; width: 100%; min-height: 48px; margin: 8px 0 0; padding: 8px 14px; border-radius: 12px; cursor: pointer;
  border: 1px solid rgba(255,255,255,0.14); background: #3a322a; color: inherit; font: 600 16px system-ui, sans-serif;
  text-align: center; box-sizing: border-box;
}
.mv-btn:hover, .mv-btn:focus-visible { background: #4a4036; outline: none; }
.mv-btn.is-primary { background: #6b4a2a; border-color: #a8763f; }
.mv-btn.is-primary:hover { background: #7d5731; }
.mv-btn.is-danger { background: #5a2a24; border-color: #8a4036; }
.mv-btn small { display: block; font-weight: 400; font-size: 12px; opacity: 0.75; margin-top: 2px; }
.mv-row { margin: 12px 0 0; }
.mv-row label { display: block; font-weight: 600; margin-bottom: 2px; }
.mv-row input[type=range] { width: 100%; height: 34px; accent-color: #c98a45; }
.mv-tabs { display: flex; gap: 4px; margin: 4px 0 6px; }
.mv-tabs button {
  flex: 1 1 0; min-width: 0; min-height: 40px; padding: 0 4px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.14);
  background: #2a2420; color: inherit; font: 600 13px system-ui, sans-serif; cursor: pointer;
}
.mv-tabs button[aria-selected="true"] { background: #6b4a2a; border-color: #a8763f; }
.mv-choices { display: flex; gap: 6px; flex-wrap: wrap; }
.mv-choices button { flex: 1 1 0; min-height: 42px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.14);
  background: #3a322a; color: inherit; font: 600 14px system-ui, sans-serif; cursor: pointer; }
.mv-choices button[aria-pressed="true"] { background: #6b4a2a; border-color: #a8763f; }
.mv-keys { width: 100%; border-collapse: collapse; margin-top: 4px; }
.mv-keys td { padding: 7px 4px; border-bottom: 1px solid rgba(255,255,255,0.08); }
.mv-keys td:first-child { font-weight: 700; white-space: nowrap; padding-right: 14px; }
.mv-input { width: 100%; box-sizing: border-box; min-height: 42px; padding: 8px 10px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.2); background: #1e1a16; color: inherit; font: 14px system-ui, sans-serif; }
.mv-panel a { color: #e2b47a; }
.mv-steps { margin: 6px 0 0; padding-left: 20px; font-size: 13px; line-height: 1.45; opacity: 0.9; }
.mv-note { margin-top: 10px; font-size: 13px; opacity: 0.75; text-align: center; min-height: 1em; }
.mv-stat { display: flex; justify-content: space-between; padding: 8px 2px; border-bottom: 1px solid rgba(255,255,255,0.08); }
.mv-stat b { font-weight: 700; }
.mv-bar { height: 6px; border-radius: 3px; background: rgba(255,255,255,0.12); margin: 4px 0 2px; overflow: hidden; }
.mv-bar > i { display: block; height: 100%; background: #c98a45; }
.mv-map { display: block; width: 100%; aspect-ratio: 1 / 1; max-height: 62vh; border-radius: 12px; background: #2f4a2a; }
.mv-legend { display: flex; gap: 14px; flex-wrap: wrap; justify-content: center; margin-top: 8px; font-size: 13px; opacity: 0.85; }
.mv-legend span::before { content: ''; display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 5px; vertical-align: -1px; background: var(--c); }
`;

export function ensureMenuStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const el = document.createElement('style');
  el.id = STYLE_ID;
  el.textContent = CSS;
  document.head.appendChild(el);
}

export function el(tag, props = {}, ...children) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (v != null) n.setAttribute(k, v);
  }
  for (const c of children) if (c != null) n.append(c);
  return n;
}

export function button(label, onClick, { primary = false, danger = false, sub = null } = {}) {
  const b = el('button', { type: 'button', class: 'mv-btn' + (primary ? ' is-primary' : '') + (danger ? ' is-danger' : ''), onclick: onClick });
  b.append(label);
  if (sub) b.append(el('small', { text: sub }));
  return b;
}

export function heading(title, sub) {
  const frag = document.createDocumentFragment();
  frag.append(el('h2', { text: title }));
  if (sub) frag.append(el('p', { class: 'mv-sub', text: sub }));
  return frag;
}

export function slider(label, { min, max, step, value, format = (v) => String(v), onInput }) {
  const lab = el('label');
  const input = el('input', { type: 'range', min: String(min), max: String(max), step: String(step), 'aria-label': label });
  input.value = String(value);
  const text = () => { lab.textContent = `${label}: ${format(Number(input.value))}`; };
  input.addEventListener('input', () => { onInput(Number(input.value)); text(); });
  text();
  return el('div', { class: 'mv-row' }, lab, input);
}

export function choices(label, options, current, onPick) {
  const row = el('div', { class: 'mv-row' }, el('label', { text: label }));
  const wrap = el('div', { class: 'mv-choices' });
  for (const [value, text] of options) {
    wrap.append(el('button', { type: 'button', 'aria-pressed': String(value === current), text, onclick: () => onPick(value) }));
  }
  row.append(wrap);
  return row;
}

const pct = (v) => Math.round(v * 100) + '%';

export const DESKTOP_KEYS = [
  ['W A S D', 'Walk'], ['Shift', 'Run (hold)'], ['Mouse', 'Look around'], ['Space', 'Jump'], ['E', 'Use / talk / sit / drive'],
  ['I', 'Inventory / Bag'], ['P', 'Phone'], ['V', 'Third-person view'],
  ['Esc', 'Pause'], ['Tab', 'Free the mouse to click buttons (Tab again to look)'], ['M', 'Minimap on / off'], ['F2', 'Debug menu'], ['F9', 'Screenshot + note']
];
export const TOUCH_KEYS = [
  ['Left stick', 'Walk'], ['Drag right side', 'Look around'], ['Tap prompt', 'Use / talk / sit / drive'],
  ['II button', 'Pause']
];

/**
 * Tabbed settings. Renders into `panel` (cleared first). `state.tab` is kept
 * by the caller so the tab survives re-renders.
 */
export function renderSettings(panel, {
  state,
  display = null,
  settings = null,
  sfx = null,
  isMobile = false,
  applyLive = {},
  onReload = null,
  onBack
}) {
  const rerender = () => renderSettings(panel, arguments[1]);
  panel.textContent = '';
  panel.append(heading('Settings', 'Saved on this device'));
  const tabs = [['display', 'Display'], ['sound', 'Sound'], ['controls', 'Controls'], ['graphics', 'Graphics'], ['feedback', 'Feedback']];
  const bar = el('div', { class: 'mv-tabs', role: 'tablist' });
  for (const [id, label] of tabs) {
    bar.append(el('button', { type: 'button', role: 'tab', 'aria-selected': String(state.tab === id), text: label,
      onclick: () => { state.tab = id; rerender(); } }));
  }
  panel.append(bar);
  const s = settings ? settings.get() : null;

  if (state.tab === 'sound') {
    if (sfx && typeof sfx.toggleMuted === 'function') {
      panel.append(button(sfx.isMuted() ? 'Sound: Off (muted)' : 'Sound: On', () => { sfx.toggleMuted(); rerender(); }));
    }
    if (s) {
      const vol = (key, label) => slider(label, { min: 0, max: 1, step: 0.05, value: s.volume[key], format: pct,
        onInput: (v) => { settings.set({ volume: { [key]: v } }); if (applyLive.volume) applyLive.volume(settings.get().volume); } });
      panel.append(vol('master', 'Master volume'), vol('effects', 'Effects (steps, doors, car, TV)'), vol('ambience', 'Ambience (birds, wind, rain)'));
    }
  } else if (state.tab === 'controls') {
    if (s) {
      if (isMobile) {
        panel.append(slider('Touch look speed', { min: 0.5, max: 3, step: 0.1, value: s.touchLookSpeed,
          format: (v) => v.toFixed(1) + '×',
          onInput: (v) => { settings.set({ touchLookSpeed: v }); if (applyLive.look) applyLive.look(settings.get()); }
        }));
      }
      panel.append(slider('Look sensitivity', { min: 0.2, max: 3, step: 0.1, value: s.sensitivity, format: (v) => v.toFixed(1) + '×',
        onInput: (v) => { settings.set({ sensitivity: v }); if (applyLive.look) applyLive.look(settings.get()); } }));
      panel.append(button(s.invertY ? 'Invert look up/down: On' : 'Invert look up/down: Off', () => {
        settings.set({ invertY: !settings.get().invertY }); if (applyLive.look) applyLive.look(settings.get()); rerender();
      }));
      panel.append(slider('Field of view', { min: 50, max: 100, step: 1, value: s.fov, format: (v) => v + '°',
        onInput: (v) => { settings.set({ fov: v }); if (applyLive.fov) applyLive.fov(v); } }));
    }
    panel.append(el('h3', { text: isMobile ? 'Touch controls' : 'Keys' }));
    const table = el('table', { class: 'mv-keys' });
    for (const [k, v] of (isMobile ? TOUCH_KEYS : DESKTOP_KEYS)) table.append(el('tr', {}, el('td', { text: k }), el('td', { text: v })));
    panel.append(table);
  } else if (state.tab === 'graphics') {
    if (s) {
      panel.append(choices('Quality', [['auto', 'Auto'], ['low', 'Low'], ['medium', 'Medium'], ['high', 'High']], s.quality, (v) => {
        settings.set({ quality: v }); rerender();
      }));
      panel.append(el('p', { class: 'mv-note', text: 'Low is fastest on older phones. High adds sun shadows and the full film effect. Auto picks for your device. Changes apply after a reload.' }));
      if (onReload) panel.append(button('Reload now', onReload));
    }
  } else if (state.tab === 'feedback') {
    renderFeedbackTab(panel, rerender);
  } else {
    state.tab = 'display';
    if (display) {
      const d = display.get();
      if (typeof display.setPreset === 'function') {
        panel.append(choices('Look preset', [
          ['classic', 'Classic'],
          ['autumn', 'Cozy Autumn'],
          ['pnw', 'Sunlit PNW'],
          ['dusk', 'Moody Dusk']
        ], d.preset || 'classic', (v) => {
          display.setPreset(v);
          rerender();
        }));
      }
      panel.append(slider('Brightness', { min: 0.5, max: 2, step: 0.05, value: d.brightness, format: pct, onInput: (v) => display.setBrightness(v) }));
      panel.append(slider('Film look', { min: 0, max: 1, step: 0.05, value: d.film, format: pct, onInput: (v) => display.setFilm(v) }));
      if (display.hasGrain()) panel.append(button(d.grain ? 'Film grain: On' : 'Film grain: Off', () => { display.setGrain(!display.get().grain); rerender(); }));
      panel.append(button('Reset display', () => { display.reset(); rerender(); }));
    }
  }
  panel.append(button('Back', onBack, { primary: true }));
}

/**
 * Settings > Feedback: connect the camera button / F9 screenshots to the
 * repo's feedback folder (githubFeedback.js). The token is typed by the player
 * and kept in this browser only.
 */
function renderFeedbackTab(panel, rerender) {
  const cfg = readGithubFeedbackConfig();
  const folder = `https://github.com/${(cfg && cfg.repo) || DEFAULT_REPO}/tree/main/feedback`;
  const status = el('div', { class: 'mv-note' });
  panel.append(el('p', { class: 'mv-sub', text: cfg
    ? 'Connected: screenshots you save with a note go to the feedback folder on GitHub.'
    : 'Not set up: screenshots download to this device.' }));
  panel.append(el('div', { class: 'mv-row' }, el('a', { href: folder, target: '_blank', rel: 'noopener', text: 'Open the feedback folder on GitHub' })));
  if (cfg) {
    panel.append(button('Test connection', async () => {
      status.textContent = 'Checking…';
      const r = await createGithubFeedback().test();
      status.textContent = r.message;
    }));
    panel.append(button('Disconnect this device', () => { writeGithubFeedbackConfig(null); rerender(); }, { danger: true }));
  } else {
    panel.append(el('h3', { text: 'Set up (once per device)' }));
    const steps = el('ol', { class: 'mv-steps' });
    for (const t of [
      'On github.com: Settings > Developer settings > Personal access tokens > Fine-grained tokens > Generate new token.',
      'Repository access: Only select repositories > MapleValleyLifeSimulator.',
      'Permissions: Contents > Read and write. Pick an expiry date, then Generate.',
      'Copy the token and paste it below. It stays in this browser only.'
    ]) steps.append(el('li', { text: t }));
    panel.append(steps);
    const input = el('input', { class: 'mv-input', type: 'password', placeholder: 'Paste your GitHub token', autocomplete: 'off', 'aria-label': 'GitHub token' });
    input.addEventListener('keydown', (e) => e.stopPropagation());
    panel.append(el('div', { class: 'mv-row' }, input));
    panel.append(button('Save and test', async () => {
      const token = input.value.trim();
      if (!token) { status.textContent = 'Paste a token first.'; return; }
      status.textContent = 'Checking…';
      const config = { token, repo: DEFAULT_REPO, branch: 'main' };
      const r = await createGithubFeedback({ getConfig: () => config }).test(config);
      if (r.ok) { writeGithubFeedbackConfig(config); rerender(); }
      else status.textContent = r.message + ' Nothing was saved.';
    }, { primary: true }));
  }
  panel.append(status);
}
