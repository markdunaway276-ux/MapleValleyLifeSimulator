import { makeSection } from './style.js';

/**
 * Debug menu — World tab: Time of day (slider, pause, speed multipliers)
 * and Weather overrides (Auto, Clear, Cloudy, Rain).
 */
export function buildWorldTab(pane, { getClock, getWeather }) {
  let timeEls = null;
  let weatherEls = null;

  function refreshTime() {
    if (!timeEls || typeof getClock !== 'function') return;
    const clock = getClock();
    if (!clock) return;
    const t = clock.getTime();
    timeEls.label.textContent = t.label + (t.paused ? '  (paused)' : '');
    if (document.activeElement !== timeEls.slider) timeEls.slider.value = String(Math.floor(t.minutes));
    timeEls.pauseBtn.textContent = t.paused ? 'Resume' : 'Pause';
    timeEls.pauseBtn.setAttribute('aria-pressed', t.paused ? 'true' : 'false');
    const scale = clock.getScale();
    for (const b of timeEls.speedBtns) {
      const on = Math.abs(scale - 60 * Number(b.dataset.timeScale)) < 1e-6;
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
  }

  function refreshWeather() {
    if (!weatherEls || typeof getWeather !== 'function') return;
    const w = getWeather();
    const cur = w && typeof w.get === 'function' ? w.get() : w;
    const override = w && typeof w.getOverride === 'function' ? w.getOverride() : (cur && cur.override);
    const active = override || 'auto';
    const name = (cur && cur.name) || 'Clear';
    weatherEls.label.textContent = override ? (name + '  (override)') : (name + '  (auto)');
    for (const b of weatherEls.btns) {
      b.setAttribute('aria-pressed', b.dataset.weather === active ? 'true' : 'false');
    }
  }

  if (typeof getClock === 'function') {
    const { section, body } = makeSection('time', 'Time of day', 'dm-sublist dm-time');
    const label = document.createElement('div');
    label.className = 'dm-time-label';
    label.dataset.timeLabel = '1';
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '1439';
    slider.step = '1';
    slider.setAttribute('aria-label', 'Time of day');
    slider.addEventListener('pointerdown', (e) => e.stopPropagation());
    slider.addEventListener('input', () => {
      const clock = getClock && getClock();
      if (clock) clock.setTime(Number(slider.value));
    });
    const row = document.createElement('div');
    row.className = 'dm-time-row';
    const pauseBtn = document.createElement('button');
    pauseBtn.type = 'button';
    pauseBtn.dataset.timeAction = 'pause';
    pauseBtn.addEventListener('click', () => {
      const clock = getClock && getClock();
      if (!clock) return;
      clock.setPaused(!clock.isPaused());
      refreshTime();
    });
    row.appendChild(pauseBtn);
    const speedBtns = [1, 4, 16, 60].map((mult) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.timeScale = String(mult);
      b.textContent = mult === 1 ? '1×' : mult + '×';
      b.addEventListener('click', () => {
        const clock = getClock && getClock();
        if (!clock) return;
        clock.setScale(60 * mult);
        refreshTime();
      });
      row.appendChild(b);
      return b;
    });
    body.append(label, slider, row);
    timeEls = { section, label, slider, pauseBtn, speedBtns };
    refreshTime();
    pane.appendChild(section);
  }

  if (typeof getWeather === 'function') {
    const { section, body } = makeSection('weather', 'Weather', 'dm-sublist');
    const box = document.createElement('div');
    box.className = 'dm-time';
    const label = document.createElement('p');
    label.className = 'dm-time-label';
    label.textContent = 'Weather';
    const row = document.createElement('div');
    row.className = 'dm-time-row';
    const choices = [
      { id: 'auto', label: 'Auto' },
      { id: 'clear', label: 'Clear' },
      { id: 'cloudy', label: 'Cloudy' },
      { id: 'rain', label: 'Rain' }
    ];
    const btns = choices.map((c) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.weather = c.id;
      btn.textContent = c.label;
      btn.addEventListener('click', () => {
        const w = getWeather && getWeather();
        if (w && typeof w.setOverride === 'function') w.setOverride(c.id);
        refreshWeather();
      });
      row.appendChild(btn);
      return btn;
    });
    box.append(label, row);
    body.appendChild(box);
    weatherEls = { section, label, btns };
    refreshWeather();
    pane.appendChild(section);
  }

  return { refreshTime, refreshWeather };
}
