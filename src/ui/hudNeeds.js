/**
 * Compact Hunger / Energy bars. Sit under the top-left info card so they
 * stay clear of the clock (top-centre), the camera / mute / Bag cluster
 * (top-right), Debug (bottom-right), the joystick (bottom-left) and the
 * interact prompt (bottom-centre). pointer-events:none — they never steal
 * look or lock. Hidden under inventory or menus, like the other HUD bits.
 */

const STYLE_ID = 'hud-needs-styles';

const CSS = `
#hud-needs {
  position: absolute;
  z-index: 34;
  display: none;
  box-sizing: border-box;
  top: calc(max(12px, env(safe-area-inset-top)) + 96px);
  left: max(10px, env(safe-area-inset-left));
  width: 152px;
  margin: 0;
  padding: 6px 8px 7px;
  font: 600 11px/1.2 system-ui, sans-serif;
  color: #fff;
  background: rgba(0, 0, 0, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.28);
  border-radius: 8px;
  pointer-events: none;
  user-select: none;
  opacity: 0.9;
}
#hud-needs.is-visible { display: block; }
#hud-needs .hud-need {
  display: grid;
  grid-template-columns: 48px 1fr 24px;
  align-items: center;
  gap: 6px;
}
#hud-needs .hud-need + .hud-need { margin-top: 5px; }
#hud-needs .hud-need-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  letter-spacing: 0.01em;
}
#hud-needs .hud-need-track {
  height: 8px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.18);
  overflow: hidden;
}
#hud-needs .hud-need-fill {
  height: 100%;
  width: 0%;
  border-radius: 4px;
  background: #3fbf6a;
}
#hud-needs .hud-need-value {
  text-align: right;
  font-variant-numeric: tabular-nums;
  opacity: 0.9;
}
#hud-needs .hud-need.is-low .hud-need-fill { background: #e8a03c; }
#hud-needs .hud-need.is-low .hud-need-label,
#hud-needs .hud-need.is-low .hud-need-value { color: #ffd089; }
`;

function ensureStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

export function createHudNeeds({
  getNeeds = () => null,
  container = document.body
} = {}) {
  ensureStyles();
  const el = document.createElement('div');
  el.id = 'hud-needs';
  el.className = 'hud-ui';
  el.setAttribute('aria-label', 'Needs');
  container.appendChild(el);

  const rows = new Map();

  function ensureRow(item) {
    let row = rows.get(item.id);
    if (row) return row;
    const wrap = document.createElement('div');
    wrap.className = 'hud-need';
    wrap.dataset.need = item.id;
    const label = document.createElement('span');
    label.className = 'hud-need-label';
    label.textContent = item.name;
    const track = document.createElement('div');
    track.className = 'hud-need-track';
    const fill = document.createElement('div');
    fill.className = 'hud-need-fill';
    track.appendChild(fill);
    const value = document.createElement('span');
    value.className = 'hud-need-value';
    wrap.append(label, track, value);
    el.appendChild(wrap);
    row = { wrap, fill, value, shown: null };
    rows.set(item.id, row);
    return row;
  }

  function update(snapshot) {
    const snap = snapshot || (typeof getNeeds === 'function' ? getNeeds() : null);
    if (!snap || !snap.items) return;
    for (let i = 0; i < snap.items.length; i++) {
      const item = snap.items[i];
      const row = ensureRow(item);
      const shown = Math.round(item.value);
      const key = shown + (item.low ? 'L' : '');
      if (row.shown === key) continue;
      row.shown = key;
      const max = item.max || 100;
      const pct = max > 0 ? (Math.max(0, item.value) / max) * 100 : 0;
      row.fill.style.width = pct.toFixed(1) + '%';
      row.value.textContent = String(shown);
      row.wrap.classList.toggle('is-low', !!item.low);
    }
  }

  function setVisible(v) {
    el.classList.toggle('is-visible', !!v);
    if (v) update();
  }

  function dispose() {
    el.remove();
    rows.clear();
  }

  return { element: el, setVisible, update, dispose };
}
