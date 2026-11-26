/**
 * Basic phone UI. A small HUD button (and P on desktop) opens a
 * phone-shaped overlay with a status bar (game time) and a home grid
 * of apps from `apps.js`. While it is open, pointer lock is released,
 * look and movement are blocked, and the other HUD bits hide like
 * they do under the bag or Debug menu.
 */
import { PHONE_APPS, INSTALLED_APPS, CALENDAR_APP, SKILLS_APP, getPhoneApp } from './apps.js';

const STYLE_ID = 'phone-styles';
export const PHONE_KEY = 'KeyP';

const CSS = `
#hud-phone {
  position: absolute;
  z-index: 45;
  display: none;
  box-sizing: border-box;
  top: calc(max(12px, env(safe-area-inset-top)) + 104px);
  right: max(12px, env(safe-area-inset-right));
  width: 44px; height: 44px; min-width: 44px; min-height: 44px;
  padding: 0; margin: 0;
  font: 22px/1 system-ui, sans-serif;
  color: #fff;
  background: rgba(0, 0, 0, 0.65);
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 8px;
  cursor: pointer;
  touch-action: manipulation;
  pointer-events: auto;
  -webkit-tap-highlight-color: transparent;
  align-items: center;
  justify-content: center;
  opacity: 0.9;
}
#hud-phone.is-visible { display: flex; }
#hud-phone:hover, #hud-phone:focus { opacity: 1; background: rgba(0, 0, 0, 0.85); outline: none; }
/* Stack under mute, in the camera column (left of Bag on a phone). */
body.mobile #hud-phone {
  right: calc(max(12px, env(safe-area-inset-right)) + 76px);
}

.phone-overlay {
  display: none;
  position: fixed;
  inset: 0;
  z-index: 50;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.55);
  font-family: system-ui, sans-serif;
  pointer-events: auto;
  -webkit-tap-highlight-color: transparent;
}
.phone-overlay.is-open { display: flex; }

.phone-device {
  box-sizing: border-box;
  width: min(92vw, 320px);
  height: min(84vh, 620px);
  display: flex;
  flex-direction: column;
  background: #14151c;
  color: #fff;
  border: 3px solid #2c2f3a;
  border-radius: 36px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5), inset 0 0 0 2px rgba(255, 255, 255, 0.06);
  overflow: hidden;
  position: relative;
}

.phone-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 44px;
  padding: 8px 10px 4px 16px;
  flex: 0 0 auto;
}
.phone-status-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1 1 auto;
}
.phone-status-time {
  margin: 0;
  font: 600 13px/1.2 system-ui, sans-serif;
  letter-spacing: 0.02em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1 1 auto;
}
.phone-status-weather {
  flex: 0 0 auto;
  font-size: 16px;
  line-height: 1;
}
.phone-status-weather:empty { display: none; }
.phone-weather-icon {
  margin: 8px 0 0;
  font-size: 48px;
  line-height: 1;
  text-align: center;
}
.phone-weather-name {
  margin: 10px 0 0;
  font: 650 18px/1.2 system-ui, sans-serif;
  text-align: center;
}
.phone-close {
  box-sizing: border-box;
  width: 44px; height: 44px; min-width: 44px; min-height: 44px;
  padding: 0; margin: 0;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: #fff;
  font: 600 22px/1 system-ui, sans-serif;
  cursor: pointer;
  touch-action: manipulation;
}
.phone-close:hover, .phone-close:focus {
  background: rgba(255, 255, 255, 0.12);
  outline: none;
}

.phone-screen {
  flex: 1 1 auto;
  overflow: auto;
  padding: 8px 16px 4px;
  display: flex;
  flex-direction: column;
}

.phone-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px 10px;
  padding: 8px 0 4px;
}
.phone-app {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  min-width: 44px;
  min-height: 72px;
  padding: 4px;
  border: 0;
  background: transparent;
  color: #fff;
  cursor: pointer;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}
.phone-app:hover, .phone-app:focus { outline: none; }
.phone-app:hover .phone-app-icon,
.phone-app:focus .phone-app-icon {
  filter: brightness(1.12);
}
.phone-app-icon {
  box-sizing: border-box;
  width: 56px; height: 56px; min-width: 44px; min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 16px;
  background: #2a3144;
  font-size: 28px;
  line-height: 1;
}
.phone-app-name {
  font: 600 11px/1.2 system-ui, sans-serif;
  text-align: center;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.phone-app-title {
  margin: 8px 0 12px;
  font: 650 18px/1.2 system-ui, sans-serif;
}
.phone-placeholder {
  margin: 8px 0 0;
  font: 15px/1.45 system-ui, sans-serif;
  color: rgba(255, 255, 255, 0.82);
}
.phone-bank-label {
  margin: 4px 0 0;
  font: 600 13px/1.2 system-ui, sans-serif;
  color: rgba(255, 255, 255, 0.7);
}
.phone-bank-balance {
  margin: 8px 0 0;
  font: 700 32px/1.1 system-ui, sans-serif;
  font-variant-numeric: tabular-nums;
  color: #8fddb0;
}

.phone-home-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  min-height: 56px;
  padding: 8px 16px 14px;
}
.phone-home {
  box-sizing: border-box;
  width: 44px; height: 44px; min-width: 44px; min-height: 44px;
  padding: 0; margin: 0;
  border: 2px solid rgba(255, 255, 255, 0.55);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.06);
  color: #fff;
  cursor: pointer;
  touch-action: manipulation;
}
.phone-home:hover, .phone-home:focus {
  background: rgba(255, 255, 255, 0.16);
  outline: none;
}
`;

function ensureStyles() {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

export function createPhone({
  container = document.body,
  canvas = null,
  isMobile = false,
  isStarted = null,
  isBlocked = null,
  canOpen = null,
  getTime = null,
  getMoney = null,
  onMoneyChange = null,
  clock = null,
  apps = PHONE_APPS,
  bindKey = true,
  onBeforeOpen = null,
  attachMap = null,
  getAppearance = null,
  setAppearance = null,
  onAppearanceChange = null,
  getWeather = null,
  onWeatherChange = null,
  getSkills = null,
  onSkillsChange = null
} = {}) {
  ensureStyles();

  let opened = false;
  let current = null;
  let appCleanup = null;

  const button = document.createElement('button');
  button.type = 'button';
  button.id = 'hud-phone';
  button.className = 'hud-ui';
  button.textContent = '📱';
  button.setAttribute('aria-label', 'Phone');
  button.title = bindKey && !isMobile ? 'Phone (P)' : 'Phone';

  const overlay = document.createElement('div');
  overlay.className = 'phone-overlay';
  overlay.id = 'phone';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-label', 'Phone');

  const device = document.createElement('div');
  device.className = 'phone-device';

  const status = document.createElement('div');
  status.className = 'phone-status';
  const timeEl = document.createElement('p');
  timeEl.className = 'phone-status-time';
  timeEl.setAttribute('aria-live', 'polite');
  const weatherEl = document.createElement('span');
  weatherEl.className = 'phone-status-weather';
  weatherEl.setAttribute('aria-hidden', 'true');
  const statusLeft = document.createElement('div');
  statusLeft.className = 'phone-status-left';
  statusLeft.append(timeEl, weatherEl);
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'phone-close';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.textContent = '\u00d7';
  status.append(statusLeft, closeBtn);

  const screen = document.createElement('div');
  screen.className = 'phone-screen';

  const homeBar = document.createElement('div');
  homeBar.className = 'phone-home-bar';
  const homeBtn = document.createElement('button');
  homeBtn.type = 'button';
  homeBtn.className = 'phone-home';
  homeBtn.setAttribute('aria-label', 'Home');
  homeBtn.title = 'Home';
  homeBar.appendChild(homeBtn);

  device.append(status, screen, homeBar);
  overlay.appendChild(device);
  container.append(button, overlay);

  const ctx = {
    getTime: () => (typeof getTime === 'function' ? getTime() : (clock && typeof clock.getTime === 'function' ? clock.getTime() : null)),
    getMoney: () => (typeof getMoney === 'function' ? getMoney() : 0),
    onMoneyChange: typeof onMoneyChange === 'function' ? onMoneyChange : null,
    attachMap: typeof attachMap === 'function' ? attachMap : null,
    getAppearance: typeof getAppearance === 'function' ? getAppearance : null,
    setAppearance: typeof setAppearance === 'function' ? setAppearance : null,
    onAppearanceChange: typeof onAppearanceChange === 'function' ? onAppearanceChange : null,
    getWeather: typeof getWeather === 'function' ? getWeather : null,
    onWeatherChange: typeof onWeatherChange === 'function' ? onWeatherChange : null,
    getSkills: typeof getSkills === 'function' ? getSkills : null,
    onSkillsChange: typeof onSkillsChange === 'function' ? onSkillsChange : null,
    clock: clock || null
  };

  function started() {
    return typeof isStarted === 'function' ? !!isStarted() : true;
  }

  function mobile() {
    return !!isMobile || (typeof document !== 'undefined' && document.body.classList.contains('mobile'));
  }

  function blocked() {
    return typeof isBlocked === 'function' && !!isBlocked();
  }

  function allowedToOpen() {
    if (typeof canOpen === 'function') return !!canOpen();
    return started();
  }

  function paintWeather(state) {
    const w = state || (ctx.getWeather ? ctx.getWeather() : null);
    weatherEl.textContent = (w && w.icon) || '';
    if (w && w.name) weatherEl.setAttribute('aria-label', w.name);
    else weatherEl.removeAttribute('aria-label');
    weatherEl.setAttribute('aria-hidden', weatherEl.textContent ? 'false' : 'true');
  }

  function updateStatus(time) {
    const t = time || ctx.getTime();
    timeEl.textContent = (t && t.label) || '';
    paintWeather();
  }

  function clearApp() {
    if (typeof appCleanup === 'function') {
      try { appCleanup(); } catch (_) { /* ignore */ }
    }
    appCleanup = null;
    current = null;
    screen.replaceChildren();
  }

  function renderHome() {
    clearApp();
    const grid = document.createElement('div');
    grid.className = 'phone-grid';
    const list = apps || PHONE_APPS;
    for (let i = 0; i < list.length; i++) {
      const app = list[i];
      if (!app) continue;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'phone-app';
      btn.dataset.app = app.id || '';
      btn.setAttribute('aria-label', app.name || app.id || 'App');
      const icon = document.createElement('span');
      icon.className = 'phone-app-icon';
      icon.textContent = app.icon || '';
      const name = document.createElement('span');
      name.className = 'phone-app-name';
      name.textContent = app.name || app.id || '';
      btn.append(icon, name);
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openApp(app.id);
      });
      grid.appendChild(btn);
    }
    screen.appendChild(grid);
  }

  function openApp(id) {
    const app = getPhoneApp(id, apps) || getPhoneApp(id, PHONE_APPS);
    if (!app) return null;
    clearApp();
    current = app.id;
    if (typeof app.render === 'function') {
      const ret = app.render(screen, ctx);
      appCleanup = typeof ret === 'function' ? ret : null;
    } else {
      const title = document.createElement('h3');
      title.className = 'phone-app-title';
      title.textContent = app.name || app.id;
      const p = document.createElement('p');
      p.className = 'phone-placeholder';
      p.textContent = app.placeholder || 'Coming soon';
      screen.append(title, p);
    }
    return app;
  }

  function currentApp() {
    return current;
  }

  function open() {
    if (opened) return;
    if (!allowedToOpen()) return;
    if (typeof onBeforeOpen === 'function') onBeforeOpen();
    opened = true;
    renderHome();
    updateStatus();
    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');
    if (typeof document !== 'undefined' && typeof document.exitPointerLock === 'function') {
      document.exitPointerLock();
    }
    window.dispatchEvent(new Event('phone-open'));
  }

  function close() {
    if (!opened) return;
    opened = false;
    clearApp();
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    window.dispatchEvent(new Event('phone-close'));
    if (!mobile() && started() && !blocked() && canvas && typeof canvas.requestPointerLock === 'function') {
      canvas.requestPointerLock();
    }
  }

  function toggle() {
    if (opened) close();
    else open();
  }

  function isOpen() {
    return opened;
  }

  function setVisible(v) {
    button.classList.toggle('is-visible', !!v);
  }

  button.addEventListener('pointerdown', (e) => e.stopPropagation());
  button.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
  button.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    open();
  });
  closeBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    close();
  });
  homeBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    renderHome();
  });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  device.addEventListener('click', (e) => e.stopPropagation());

  function onKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target && e.target.closest && e.target.closest('input, textarea, [contenteditable]')) return;
    if (e.code === 'Escape' && opened) {
      e.preventDefault();
      close();
      return;
    }
    if (bindKey && !isMobile && e.code === PHONE_KEY) {
      e.preventDefault();
      toggle();
    }
  }
  document.addEventListener('keydown', onKey);

  window.addEventListener('inventory-open', () => {
    if (opened) close();
  });

  if (clock && typeof clock.on === 'function') {
    clock.on('change', (t) => { if (opened) updateStatus(t); });
  }
  if (typeof onWeatherChange === 'function') {
    onWeatherChange(() => { if (opened) paintWeather(); });
  }

  function dispose() {
    document.removeEventListener('keydown', onKey);
    clearApp();
    button.remove();
    overlay.remove();
  }

  return {
    open,
    close,
    toggle,
    isOpen,
    setVisible,
    openApp,
    currentApp,
    update: updateStatus,
    element: overlay,
    button,
    dispose
  };
}

export { getPhoneApp, PHONE_APPS, INSTALLED_APPS, CALENDAR_APP, SKILLS_APP };
