import { createPhotoLibrary } from './photos.js';
/**
 * Basic phone UI. A small HUD button (and P on desktop) opens a
 * phone-shaped overlay with a status bar (game time) and a home grid
 * of apps from `apps.js`. While it is open, pointer lock is released,
 * look and movement are blocked, and the other HUD bits hide like
 * they do under the bag or Debug menu.
 */
import { PHONE_APPS, INSTALLED_APPS, CALENDAR_APP, SKILLS_APP, getPhoneApp } from './apps.js';

const PHONE_PREFS_KEY = 'mapleValleyLife_phonePrefs';
const WALLPAPERS = Object.freeze({ coast: 'Coast', dusk: 'Dusk', forest: 'Forest' });

function readPhonePrefs() {
  try {
    const saved = JSON.parse(localStorage.getItem(PHONE_PREFS_KEY));
    return {
      wallpaper: saved?.wallpaper === 'photo' || Object.hasOwn(WALLPAPERS, saved?.wallpaper) ? saved.wallpaper : 'coast',
      photoId: typeof saved?.photoId === 'string' ? saved.photoId : null,
      sound: saved?.sound === true
    };
  } catch {
    return { wallpaper: 'coast', sound: false };
  }
}

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
.phone-overlay.is-open { display: flex; background: transparent; }
.phone-overlay .phone-device { visibility: hidden; }
.phone-overlay.is-focused .phone-device { visibility: visible; }

.phone-device {
  box-sizing: border-box;
  width: var(--phone-screen-width);
  height: var(--phone-screen-height);
  display: flex;
  flex-direction: column;
  background:
    radial-gradient(ellipse at 90% 15%, #627a9c 0%, transparent 47%),
    radial-gradient(ellipse at 12% 79%, #355c64 0%, transparent 60%),
    linear-gradient(160deg, #263044, #132029 80%);
  color: #fff;
  border: 0;
  border-radius: 6% / 3%;
  overflow: hidden;
  position: relative;
}

.phone-device::before {
  content: ''; position: absolute; left: 50%; top: 9px; transform: translateX(-50%);
  width: 9px; height: 9px; background: #080d10; border-radius: 50%;
  box-shadow: inset 0 0 0 2px #252d35; pointer-events: none;
}
.phone-device[data-wallpaper="dusk"] { background: linear-gradient(156deg, #51507f, #6b4857 48%, #1e2538); }
.phone-device[data-wallpaper="forest"] { background: linear-gradient(156deg, #537768, #263e3c 50%, #152622); }
.phone-device[data-wallpaper="photo"] {
  background: linear-gradient(#151f3380, #151f3390), var(--phone-photo) center / cover;
}
.phone-overlay.is-thumb-active .phone-device::after {
  content: ''; position: absolute; z-index: 4; pointer-events: none;
  left: var(--phone-thumb-x); top: var(--phone-thumb-y);
  width: 15%; height: 15%; border-radius: 45%;
  transform: translate(-38%, -40%) rotate(24deg);
  background: linear-gradient(110deg, #83bdca33, transparent), var(--phone-thumb-tint);
  box-shadow: 0 2px 6px #12192266;
}
.phone-lock-preview {
  width: min(100%, 250px); color: #fff; background: #243041bb; border: 0;
  border-radius: 14px; min-height: 44px; padding: 8px; cursor: pointer;
  text-align: left; overflow-wrap: anywhere;
}
.phone-lock-preview span { display: block; opacity: 0.8; }
.phone-map-destination {
  min-height: 44px; flex-shrink: 0; margin-bottom: 8px;
  border-radius: 8px; color: white; background: #293748;
}
.phone-viewfinder { width: 100%; display: block; border-radius: 10px; touch-action: none; object-fit: contain; }
.phone-photo-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
.phone-photo-grid button { padding: 4px; min-width: 0; }
.phone-photo-grid img { display: block; width: 100%; }
.phone-status-left { touch-action: none; }
.phone-shade-toggle {
  flex: 0 0 auto; min-width: 38px; min-height: 44px; padding: 0;
  color: inherit; background: transparent; border: 0; font-size: 18px;
  cursor: pointer; touch-action: manipulation;
}
.phone-lock {
  display: grid; place-content: center; justify-items: center; gap: 8px;
  flex: 1 0 auto; min-height: 170px; text-align: center; touch-action: none;
}
.phone-lock-time { font: 350 clamp(30px, 7vw, 64px)/1 system-ui, sans-serif; }
.phone-lock-unlock, .phone-shade-row {
  min-height: 44px; color: inherit; font: inherit; border: 0;
  border-radius: 14px; background: #334355; padding: 8px 12px; cursor: pointer;
}
.phone-shade {
  position: absolute; z-index: 2; inset: 0; padding: 14px;
  overflow: auto; background: #202b39; color: white;
}
.phone-shade[hidden] { display: none; }
.phone-shade-header {
  display: flex; align-items: center; justify-content: space-between; gap: 4px;
  touch-action: none;
}
.phone-shade-row { width: 100%; text-align: left; margin-bottom: 8px; }
.phone-shade-row span { display: block; opacity: 0.8; overflow-wrap: anywhere; }
.phone-pref {
  display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between;
  gap: 8px; min-height: 44px; margin-bottom: 8px;
}
.phone-pref select { min-height: 44px; color: #fff; background: #293748; border-radius: 8px; }
.phone-pref input { width: 24px; height: 24px; accent-color: #9ed4c4; }
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

.phone-task-pin {
  margin-top: 6px;
  min-height: 44px;
  padding: 0 12px;
  border: 1px solid #687867;
  border-radius: 8px;
  background: #263a2c;
  color: #fff;
  font: inherit;
  cursor: pointer;
}
.phone-launcher-widget {
  flex: 0 0 auto; margin: 10px 0 8px; padding: 13px 14px;
  border-radius: 19px; background: rgba(20, 27, 37, 0.55);
  font: 500 13px/1.3 system-ui, sans-serif;
}
.phone-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 18px 10px;
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
  width: 44px; height: 44px; min-width: 44px; min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #d6ebe0;
  box-shadow: inset 0 -3px 6px rgba(0, 0, 0, 0.12);
  font-size: 23px;
  line-height: 1;
}
.phone-app:nth-child(3n + 2) .phone-app-icon { background: #dce2fa; }
.phone-app:nth-child(3n) .phone-app-icon { background: #f0dfca; }
.phone-app:focus-visible .phone-app-icon { outline: 2px solid white; outline-offset: 2px; }
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
.phone-messages {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0 0 8px;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  flex: 1 1 auto;
  min-height: 0;
}
.phone-message {
  box-sizing: border-box;
  min-height: 44px;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.08);
}
.phone-message-from {
  font: 650 14px/1.3 system-ui, sans-serif;
}
.phone-message-day {
  margin-top: 2px;
  font: 600 11px/1.2 system-ui, sans-serif;
  color: rgba(255, 255, 255, 0.62);
}
.phone-message-body {
  margin: 6px 0 0;
  font: 14px/1.45 system-ui, sans-serif;
  color: rgba(255, 255, 255, 0.9);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
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
  min-height: 44px;
  padding: 0 16px;
}
.phone-home {
  box-sizing: border-box;
  width: 104px; height: 44px;
  padding: 0; margin: 0;
  border: 0;
  border-radius: 16px;
  background: transparent;
  color: #fff;
  cursor: pointer;
  touch-action: manipulation;
}
.phone-home::after {
  content: ''; display: block; width: 88px; height: 4px;
  margin: auto; background: #e9eef0; border-radius: 8px;
}
.phone-home:hover, .phone-home:focus-visible {
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
  getTasks = null,
  getTaskLocation = null,
  getPinnedTask = null,
  togglePinnedTask = null,
  onSkillsChange = null,
  getInbox = null,
  onInboxChange = null,
  playNotification = null,
  getDestinations = null,
  getWaypointId = null,
  setWaypoint = null,
  capturePhoto = null
} = {}) {
  ensureStyles();

  let opened = false;
  let locked = false;
  let prefs = readPhonePrefs();
  const photos = createPhotoLibrary({
    getItem: (key) => localStorage.getItem(key),
    setItem: (key, value) => localStorage.setItem(key, value)
  });
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
  function applyWallpaper() {
    const photo = prefs.wallpaper === 'photo' && photos.list().find(item => item.id === prefs.photoId);
    device.dataset.wallpaper = prefs.wallpaper === 'photo' && !photo ? 'coast' : prefs.wallpaper;
    if (photo) device.style.setProperty('--phone-photo', 'url("' + photo.image + '")');
    else device.style.removeProperty('--phone-photo');
  }
  applyWallpaper();

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
  const launcherWidget = document.createElement('div');
  launcherWidget.className = 'phone-launcher-widget';
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'phone-close';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.textContent = '\u00d7';
  const shadeToggle = document.createElement('button');
  shadeToggle.type = 'button';
  shadeToggle.className = 'phone-shade-toggle';
  shadeToggle.textContent = '⌄';
  shadeToggle.title = 'Notifications';
  shadeToggle.setAttribute('aria-label', 'Open notifications');
  shadeToggle.setAttribute('aria-expanded', 'false');
  status.append(statusLeft, shadeToggle, closeBtn);

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

  const lockTime = document.createElement('div');
  lockTime.className = 'phone-lock-time';
  const lockDay = document.createElement('div');
  const shade = document.createElement('section');
  shade.className = 'phone-shade';
  shade.hidden = true;
  shade.setAttribute('aria-label', 'Notifications');
  device.append(status, screen, homeBar, shade);
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
    getTasks,
    getTaskLocation,
    getPinnedTask,
    togglePinnedTask,
    getSkills: typeof getSkills === 'function' ? getSkills : null,
    onSkillsChange: typeof onSkillsChange === 'function' ? onSkillsChange : null,
    getInbox: typeof getInbox === 'function' ? getInbox : null,
    onInboxChange: typeof onInboxChange === 'function' ? onInboxChange : null,
    wallpapers: WALLPAPERS,
    getDestinations,
    getWaypointId,
    setWaypoint,
    capturePhoto,
    photos,
    openApp,
    getPhonePrefs: () => ({ ...prefs }),
    setPhonePrefs(patch) {
      const next = { ...prefs, ...patch };
      try { localStorage.setItem(PHONE_PREFS_KEY, JSON.stringify(next)); } catch { return false; }
      prefs = next;
      applyWallpaper();
      return true;
    },
    previewNotification: () => playNotification?.(),
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
    lockTime.textContent = t?.label?.match(/\b\d{1,2}:\d{2}\b/)?.[0] || '--:--';
    lockDay.textContent = t?.day != null ? 'Day ' + t.day : 'Maple Lane';
    launcherWidget.textContent = t && t.day != null ? 'Maple Lane · Day ' + t.day : 'Maple Lane';
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

  function setShade(open) {
    shade.hidden = !open;
    shadeToggle.setAttribute('aria-expanded', String(open));
    status.inert = screen.inert = homeBar.inert = open;
    if (open) renderShade();
  }

  function swipe(element, direction, action) {
    let start = null;
    element.addEventListener('pointerdown', (event) => {
      if (event.isPrimary === false || event.button !== 0 || event.target.closest?.('button')) return;
      start = { id: event.pointerId, x: event.clientX, y: event.clientY };
      element.setPointerCapture?.(event.pointerId);
    });
    element.addEventListener('pointercancel', () => { start = null; });
    element.addEventListener('pointerup', (event) => {
      if (!start || event.pointerId !== start.id) return;
      const dx = event.clientX - start.x;
      const dy = (event.clientY - start.y) * direction;
      start = null;
      if (dy > 36 && dy > Math.abs(dx)) action();
    });
  }

  function renderShade() {
    shade.replaceChildren();
    const header = document.createElement('div');
    header.className = 'phone-shade-header';
    const title = document.createElement('h3');
    title.textContent = 'Notifications';
    const dismiss = document.createElement('button');
    dismiss.type = 'button';
    dismiss.className = 'phone-shade-toggle';
    dismiss.setAttribute('aria-label', 'Close notifications');
    dismiss.textContent = '⌃';
    dismiss.addEventListener('click', () => { setShade(false); shadeToggle.focus(); });
    header.append(title, dismiss);
    swipe(header, -1, () => setShade(false));
    shade.append(header);
    const notes = (ctx.getInbox?.() ?? []).filter(Boolean).slice(0, 3);
    const tasks = (ctx.getTasks?.() ?? []).filter(task => !task.complete).slice(0, 3);
    function addRow(app, heading, summary) {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'phone-shade-row';
      const name = document.createElement('strong');
      name.textContent = heading;
      const preview = document.createElement('span');
      preview.textContent = summary;
      row.append(name, preview);
      row.addEventListener('click', () => openApp(app));
      shade.append(row);
    }
    for (const note of notes) addRow('messages', note.from || 'Mail', note.body || '');
    for (const task of tasks) addRow('tasks', task.title, task.step || '');
    if (!notes.length && !tasks.length) {
      const empty = document.createElement('p');
      empty.textContent = 'No messages or task reminders.';
      shade.append(empty);
    }
  }

  function renderLock() {
    clearApp();
    locked = true;
    closeBtn.textContent = '\u00d7';
    closeBtn.setAttribute('aria-label', 'Put phone away');
    homeBtn.setAttribute('aria-label', 'Unlock phone');
    const lock = document.createElement('div');
    lock.className = 'phone-lock';
    const unlock = document.createElement('button');
    unlock.type = 'button';
    unlock.className = 'phone-lock-unlock';
    unlock.textContent = 'Unlock';
    unlock.addEventListener('click', renderHome);
    lock.append(lockTime, lockDay);
    const latest = (ctx.getInbox?.() ?? []).find(Boolean);
    const task = ctx.getPinnedTask?.() ?? (ctx.getTasks?.() ?? []).find(item => !item.complete);
    for (const [app, title, summary] of [
      ['messages', latest?.from, latest?.body],
      ['tasks', task?.title, task?.step]
    ]) {
      if (!title) continue;
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'phone-lock-preview';
      const name = document.createElement('strong');
      name.textContent = title;
      const preview = document.createElement('span');
      preview.textContent = summary?.length > 92 ? summary.slice(0, 89) + '…' : summary || '';
      card.append(name, preview);
      card.addEventListener('click', () => openApp(app));
      lock.append(card);
    }
    lock.append(unlock);
    swipe(lock, -1, renderHome);
    screen.append(lock);
  }

  function renderHome() {
    clearApp();
    locked = false;
    homeBtn.setAttribute('aria-label', 'Home');
    closeBtn.textContent = '\u00d7';
    closeBtn.setAttribute('aria-label', 'Put phone away');
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
    screen.append(launcherWidget, grid);
  }

  function openApp(id) {
    const app = getPhoneApp(id, apps) || getPhoneApp(id, PHONE_APPS);
    if (!app) return null;
    clearApp();
    setShade(false);
    locked = false;
    homeBtn.setAttribute('aria-label', 'Home');
    current = app.id;
    closeBtn.textContent = '‹';
    closeBtn.setAttribute('aria-label', 'Back to home');
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
    renderLock();
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
    setShade(false);
    clearApp();
    overlay.classList.remove('is-open', 'is-focused');
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

  shadeToggle.addEventListener('click', () => setShade(true));
  swipe(statusLeft, 1, () => setShade(true));
  let knownMessages = new Set((ctx.getInbox?.() ?? []).filter(Boolean).map(note => note.id));
  const offInbox = ctx.onInboxChange?.((list) => {
    const ids = new Set((list ?? ctx.getInbox?.() ?? []).filter(Boolean).map(note => note.id));
    if (prefs.sound && [...ids].some(id => !knownMessages.has(id))) playNotification?.();
    knownMessages = ids;
    if (!shade.hidden) renderShade();
  });

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
    if (current) renderHome();
    else close();
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
      e.stopPropagation();
      if (!shade.hidden) setShade(false);
      else if (current && !locked) renderHome();
      else close();
      return;
    }
    if (bindKey && !isMobile && e.code === PHONE_KEY && !e.repeat && (opened || allowedToOpen())) {
      e.preventDefault();
      e.stopPropagation();
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
    offInbox?.();
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
