import { makeSection, makeSlider } from './style.js';

/**
 * Debug menu — View tab: Display sliders, overlay toggles (FPS, collision,
 * highlight, perf), Minimap toggle, Save indicator toggle, and Sound mute.
 */
export function buildViewTab(pane, { menuItems, makeMenuRow, getDisplay, getMinimap, getSaveHud, getSfx }) {
  let displayEls = null;
  let minimapEls = null;
  let saveHudEls = null;
  let soundEls = null;

  function refreshDisplay() {
    if (!displayEls || typeof getDisplay !== 'function') return;
    const x = getDisplay();
    if (!x) return;
    const s = x.get();
    displayEls.bright.text.textContent = `Brightness ${Math.round(s.brightness * 100)}%`;
    displayEls.film.text.textContent = `Film look ${Math.round(s.film * 100)}%`;
    if (document.activeElement !== displayEls.bright.input) displayEls.bright.input.value = String(s.brightness);
    if (document.activeElement !== displayEls.film.input) displayEls.film.input.value = String(s.film);
    displayEls.grainBtn.textContent = s.grain ? 'Grain: on' : 'Grain: off';
    displayEls.grainBtn.setAttribute('aria-pressed', s.grain ? 'true' : 'false');
  }

  function refreshMinimap() {
    if (!minimapEls || typeof getMinimap !== 'function') return;
    const map = getMinimap();
    const on = !!(map && map.isEnabled && map.isEnabled());
    minimapEls.btn.setAttribute('aria-checked', on ? 'true' : 'false');
    minimapEls.btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  }

  function refreshSaveHud() {
    if (!saveHudEls || typeof getSaveHud !== 'function') return;
    const hud = getSaveHud();
    const on = !!(hud && hud.isEnabled && hud.isEnabled());
    saveHudEls.btn.setAttribute('aria-checked', on ? 'true' : 'false');
    saveHudEls.btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  }

  function refreshMute() {
    if (!soundEls || typeof getSfx !== 'function') return;
    const sfx = getSfx();
    const muted = !!(sfx && sfx.isMuted && sfx.isMuted());
    soundEls.muteBtn.setAttribute('aria-checked', muted ? 'true' : 'false');
    soundEls.muteBtn.setAttribute('aria-pressed', muted ? 'true' : 'false');
    const label = soundEls.muteBtn.querySelector('.dm-label');
    if (label) label.textContent = muted ? 'Muted' : 'Mute';
  }

  if (typeof getDisplay === 'function') {
    const { section, body } = makeSection('display', 'Display', 'dm-sublist dm-time');
    const d = () => getDisplay && getDisplay();
    const bright = makeSlider({ label: 'Brightness', min: 0.5, max: 2, step: 0.05, onInput: (v) => { const x = d(); if (x) x.setBrightness(v); refreshDisplay(); } });
    const film = makeSlider({ label: 'Film look', min: 0, max: 1, step: 0.05, onInput: (v) => { const x = d(); if (x) x.setFilm(v); refreshDisplay(); } });
    const row = document.createElement('div');
    row.className = 'dm-time-row';
    const grainBtn = document.createElement('button');
    grainBtn.type = 'button';
    grainBtn.dataset.displayAction = 'grain';
    grainBtn.addEventListener('click', () => { const x = d(); if (x) x.setGrain(!x.get().grain); refreshDisplay(); });
    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.dataset.displayAction = 'reset';
    resetBtn.textContent = 'Reset';
    resetBtn.addEventListener('click', () => { const x = d(); if (x) x.reset(); refreshDisplay(); });
    const x0 = d();
    if (x0 && x0.hasGrain()) row.appendChild(grainBtn);
    row.appendChild(resetBtn);
    body.append(bright.wrap, film.wrap, row);
    displayEls = { section, bright, film, grainBtn };
    refreshDisplay();
    pane.appendChild(section);
  }

  for (const item of menuItems) {
    if (item.type === 'toggle') pane.appendChild(makeMenuRow(item));
  }

  if (typeof getMinimap === 'function') {
    const { section, body: list } = makeSection('minimap', 'Map', 'dm-sublist');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dm-subrow';
    btn.dataset.item = 'minimap-toggle';
    btn.setAttribute('role', 'switch');
    const label = document.createElement('span');
    label.className = 'dm-label';
    label.textContent = 'Minimap';
    const key = document.createElement('span');
    key.className = 'dm-key';
    key.textContent = 'M';
    label.appendChild(key);
    const sw = document.createElement('span');
    sw.className = 'dm-switch';
    btn.append(label, sw);
    btn.addEventListener('click', () => {
      const map = getMinimap && getMinimap();
      if (map && typeof map.toggle === 'function') map.toggle();
      refreshMinimap();
    });
    list.appendChild(btn);
    minimapEls = { section, btn };
    refreshMinimap();
    pane.appendChild(section);
  }

  if (typeof getSaveHud === 'function') {
    const { section, body: list } = makeSection('save-indicator', 'HUD', 'dm-sublist');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dm-subrow';
    btn.dataset.item = 'save-indicator-toggle';
    btn.setAttribute('role', 'switch');
    const label = document.createElement('span');
    label.className = 'dm-label';
    label.textContent = 'Save indicator';
    const sw = document.createElement('span');
    sw.className = 'dm-switch';
    btn.append(label, sw);
    btn.addEventListener('click', () => {
      const hud = getSaveHud && getSaveHud();
      if (hud && typeof hud.toggle === 'function') hud.toggle();
      refreshSaveHud();
    });
    list.appendChild(btn);
    saveHudEls = { section, btn };
    refreshSaveHud();
    pane.appendChild(section);
  }

  if (typeof getSfx === 'function') {
    const { section, body: list } = makeSection('sound', 'Sound', 'dm-sublist');
    const muteBtn = document.createElement('button');
    muteBtn.type = 'button';
    muteBtn.className = 'dm-subrow';
    muteBtn.dataset.item = 'mute';
    muteBtn.setAttribute('role', 'switch');
    const label = document.createElement('span');
    label.className = 'dm-label';
    label.textContent = 'Mute';
    const sw = document.createElement('span');
    sw.className = 'dm-switch';
    muteBtn.append(label, sw);
    muteBtn.addEventListener('click', () => {
      const sfx = getSfx && getSfx();
      if (sfx && typeof sfx.toggleMuted === 'function') sfx.toggleMuted();
      refreshMute();
    });
    list.appendChild(muteBtn);
    soundEls = { section, muteBtn };
    refreshMute();
    pane.appendChild(section);
  }

  return { refreshDisplay, refreshMinimap, refreshSaveHud, refreshMute };
}
