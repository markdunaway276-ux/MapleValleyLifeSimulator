/**
 * Shared styles and DOM builders for the Debug menu tabs (src/ui/debug/).
 */

const STYLE_ID = 'debug-menu-styles';

export const CSS = `
#debug-button {
  position: absolute; z-index: 35; display: none; margin: 0;
  right: max(12px, env(safe-area-inset-right)); bottom: max(12px, env(safe-area-inset-bottom));
  min-width: 56px; min-height: 44px; padding: 8px 14px;
  font: 600 14px system-ui, sans-serif; color: #fff; background: rgba(0, 0, 0, 0.65);
  border: 1px solid rgba(255, 255, 255, 0.35); border-radius: 8px; cursor: pointer;
  touch-action: manipulation; pointer-events: auto; -webkit-tap-highlight-color: transparent;
  opacity: 0.85;
}
#debug-button.is-visible { display: block; }
#debug-button:hover, #debug-button:focus { opacity: 1; background: rgba(0, 0, 0, 0.85); outline: none; }

#debug-menu {
  position: fixed; inset: 0; z-index: 60; display: none; align-items: flex-end; justify-content: center;
  background: rgba(0, 0, 0, 0.5); font: 16px system-ui, sans-serif; color: #fff;
  touch-action: none; -webkit-user-select: none; user-select: none;
}
#debug-menu.is-open { display: flex; }
@media (min-width: 700px) { #debug-menu { align-items: center; } }
#debug-menu .dm-panel {
  box-sizing: border-box; width: min(440px, 100%); max-height: 92vh; overflow-y: auto; touch-action: pan-y;
  background: #1b1b1f; border: 1px solid #44444c; border-radius: 14px 14px 0 0;
  padding: 10px 12px max(14px, env(safe-area-inset-bottom));
}
@media (min-width: 700px) { #debug-menu .dm-panel { border-radius: 14px; } }
#debug-menu .dm-head { display: flex; align-items: center; justify-content: space-between; padding: 4px 4px 8px; }
#debug-menu h2 { margin: 0; font-size: 18px; }
#debug-menu button {
  margin: 0; font: inherit; color: inherit; cursor: pointer; touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}
#debug-menu .dm-close {
  min-width: 44px; min-height: 44px; font-size: 20px; background: #2b2b31; border: 1px solid #555; border-radius: 10px;
}
#debug-menu .dm-row {
  box-sizing: border-box; width: 100%; min-height: 52px; margin-top: 8px; padding: 8px 14px;
  display: flex; align-items: center; justify-content: space-between; gap: 10px; text-align: left;
  background: #2a2a30; border: 1px solid #44444c; border-radius: 10px;
}
#debug-menu .dm-row:active { background: #35353d; }
#debug-menu .dm-label { flex: 1 1 auto; font-weight: 600; }
#debug-menu .dm-key { font-size: 12px; color: #9a9aa5; font-weight: 400; display: block; }
body.mobile #debug-menu .dm-key { display: none; }
#debug-menu .dm-switch {
  flex: 0 0 auto; width: 46px; height: 26px; border-radius: 13px; background: #555; position: relative; transition: background 0.15s;
}
#debug-menu .dm-switch::after {
  content: ''; position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: 50%;
  background: #fff; transition: transform 0.15s;
}
#debug-menu .dm-row[aria-checked="true"] .dm-switch { background: #2e9e4f; }
#debug-menu .dm-row[aria-checked="true"] .dm-switch::after { transform: translateX(20px); }
#debug-menu .dm-subrow[aria-checked="true"] .dm-switch { background: #2e9e4f; }
#debug-menu .dm-subrow[aria-checked="true"] .dm-switch::after { transform: translateX(20px); }
#debug-menu .dm-subrow[role="switch"] { width: 100%; }
#debug-menu .dm-danger { border-color: #8a3a35; }
#debug-menu .dm-danger.is-armed { background: #7a1f1a; border-color: #ff6b61; }
#debug-menu .dm-foot { margin: 10px 4px 0; font-size: 12px; color: #8b8b95; }

#debug-menu .dm-section { margin-top: 8px; border: 1px solid #44444c; border-radius: 10px; background: #222228; overflow: hidden; }
#debug-menu .dm-section-toggle {
  box-sizing: border-box; width: 100%; min-height: 52px; padding: 8px 14px; margin: 0;
  display: flex; align-items: center; justify-content: space-between; gap: 10px; text-align: left;
  background: #2a2a30; border: 0; border-bottom: 1px solid #44444c;
}
#debug-menu .dm-chevron { flex: 0 0 auto; font-size: 18px; color: #c8c8d0; transition: transform 0.15s; }
#debug-menu .dm-section.is-open .dm-chevron { transform: rotate(180deg); }
#debug-menu .dm-sublist { display: none; padding: 0 8px 8px; }
#debug-menu .dm-section.is-open .dm-sublist { display: block; }
#debug-menu .dm-subrow {
  box-sizing: border-box; width: 100%; min-height: 48px; margin-top: 6px; padding: 8px 14px;
  display: flex; align-items: center; justify-content: space-between; gap: 10px; text-align: left;
  background: #2a2a30; border: 1px solid #3a3a44; border-radius: 10px; font-weight: 600;
}
#debug-menu .dm-subrow:active { background: #35353d; }

#debug-toast {
  position: fixed; left: 50%; bottom: max(80px, 18vh); transform: translateX(-50%); z-index: 65;
  max-width: 90vw; padding: 8px 14px; border-radius: 8px; font: 600 14px system-ui, sans-serif; color: #fff;
  background: rgba(0, 0, 0, 0.8); border: 1px solid rgba(255,255,255,0.3); pointer-events: none;
  opacity: 0; transition: opacity 0.2s ease; text-align: center;
}
#debug-toast.is-visible { opacity: 1; }
#debug-menu .dm-time { padding: 10px 14px 12px; }
#debug-menu .dm-time-label { font-weight: 600; margin: 0 0 6px; }
#debug-menu .dm-time input[type=range] {
  display: block; width: 100%; height: 44px; margin: 0; padding: 0; cursor: pointer;
  accent-color: #3fbf6a; background: transparent;
}
#debug-menu .dm-time-row { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; }
#debug-menu .dm-time-row button {
  min-height: 44px; min-width: 52px; padding: 8px 10px; font-weight: 600;
  background: #2a2a30; border: 1px solid #44444c; border-radius: 10px;
}
#debug-menu .dm-time-row button[aria-pressed="true"] { background: #1f6f3a; border-color: #3fbf6a; }
#debug-menu .dm-needs { padding: 10px 14px 12px; }
#debug-menu .dm-needs-label { font-weight: 600; margin: 0 0 8px; }
#debug-menu .dm-needs-row { display: flex; gap: 6px; flex-wrap: wrap; }
#debug-menu .dm-needs-row button {
  min-height: 44px; min-width: 72px; padding: 8px 10px; font-weight: 600;
  background: #2a2a30; border: 1px solid #44444c; border-radius: 10px;
}
#debug-menu .dm-quick { margin: 0 0 8px; padding: 8px; background: #222228; border: 1px solid #44444c; border-radius: 10px; }
#debug-menu .dm-quick-row { display: flex; gap: 6px; flex-wrap: wrap; }
#debug-menu .dm-quick-row + .dm-quick-row { margin-top: 6px; }
#debug-menu .dm-chip {
  min-height: 44px; padding: 8px 12px; font-weight: 600; flex: 1 1 auto;
  background: #2a2a30; border: 1px solid #44444c; border-radius: 10px;
}
#debug-menu .dm-chip-small { flex: 1 1 0; padding: 8px 6px; }
#debug-menu .dm-chip-dev[aria-pressed="true"] { background: #1f6f3a; border-color: #3fbf6a; }
#debug-menu .dm-select {
  flex: 3 1 auto; min-height: 44px; padding: 8px 10px; font: inherit; color: #fff;
  background: #2a2a30; border: 1px solid #44444c; border-radius: 10px;
}
#debug-menu .dm-tabs { display: flex; gap: 4px; margin: 4px 0 2px; position: sticky; top: -10px; z-index: 1; background: #1b1b1f; padding: 4px 0; }
#debug-menu .dm-tab {
  flex: 1 1 0; min-height: 40px; font-weight: 600; color: #c8c8d0;
  background: #222228; border: 1px solid #44444c; border-radius: 10px;
}
#debug-menu .dm-tab[aria-selected="true"] { color: #fff; background: #3a3a44; border-color: #8a8a96; }
#debug-menu .dm-help { font-size: 13px; color: #a8a8b2; margin: 8px 4px 2px; }
#debug-menu .dm-money { padding: 10px 14px 12px; }
#debug-menu .dm-money-label { font-weight: 600; margin: 0 0 8px; }
#debug-menu .dm-money-row { display: flex; gap: 6px; flex-wrap: wrap; }
#debug-menu .dm-money-row button {
  min-height: 44px; min-width: 72px; padding: 8px 10px; font-weight: 600;
  background: #2a2a30; border: 1px solid #44444c; border-radius: 10px;
}
`;

export function ensureStyles() {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

/** Collapsible section shell shared across Debug menu tabs. */
export function makeSection(id, titleText, bodyClass = 'dm-sublist') {
  const section = document.createElement('div');
  section.className = 'dm-section is-open';
  section.dataset.item = id;
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'dm-section-toggle';
  toggle.setAttribute('aria-expanded', 'true');
  const title = document.createElement('span');
  title.className = 'dm-label';
  title.textContent = titleText;
  const chev = document.createElement('span');
  chev.className = 'dm-chevron';
  chev.textContent = '▾';
  toggle.append(title, chev);
  const body = document.createElement('div');
  body.className = bodyClass;
  toggle.addEventListener('click', () => {
    const open = !section.classList.contains('is-open');
    section.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  section.append(toggle, body);
  return { section, toggle, body };
}

export function makeSlider({ label, min, max, step, onInput }) {
  const wrap = document.createElement('div');
  const text = document.createElement('div');
  text.className = 'dm-time-label';
  const input = document.createElement('input');
  input.type = 'range';
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.setAttribute('aria-label', label);
  input.addEventListener('pointerdown', (e) => e.stopPropagation());
  input.addEventListener('input', () => onInput(Number(input.value)));
  wrap.append(text, input);
  return { wrap, text, input };
}
