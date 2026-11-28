import { createPhotoLibrary } from './photos.js';
/**
 * Basic phone UI. A small HUD button (and P on desktop) opens a
 * phone-shaped overlay with a status bar (game time) and a home grid
 * of apps from `apps.js`. While it is open, pointer lock is released,
 * look and movement are blocked, and the other HUD bits hide like
 * they do under the bag or Debug menu.
 */
import { PHONE_APPS, INSTALLED_APPS, CALENDAR_APP, SKILLS_APP, getPhoneApp } from './apps.js';
import { APP_ICON_META, ANDROID_STATUS_ICONS_SVG, FINGERPRINT_SVG } from './icons.js';
import { requestPointerLock, exitPointerLock } from '../../core/pointerLock.js';

const MESSAGE_ALERT_MS = 6500;
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
  z-index: 36;
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
/* Single neat right-hand column on mobile (directly under Bag). */
body.mobile #hud-phone {
  top: calc(max(10px, env(safe-area-inset-top)) + 46px);
  right: max(10px, env(safe-area-inset-right));
  width: 40px; height: 40px; min-width: 40px; min-height: 40px;
  font-size: 19px;
}
@media (max-height: 500px) {
  body.mobile #hud-phone {
    top: max(8px, env(safe-area-inset-top));
    right: calc(max(10px, env(safe-area-inset-right)) + 44px);
    width: 36px; height: 36px; min-width: 36px; min-height: 36px;
    font-size: 17px;
  }
}

#hud-phone-alert {
  position: fixed; z-index: 38; left: 50%; transform: translateX(-50%);
  top: calc(max(12px, env(safe-area-inset-top)) + 104px);
  width: min(58vw, 310px); min-height: 44px; padding: 9px 14px;
  border-radius: 22px; border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(22, 26, 32, 0.94);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
  color: #f1f3f5; text-align: left; font: 13px/1.3 Roboto, 'Segoe UI', system-ui, sans-serif;
  cursor: pointer; touch-action: manipulation;
}
#hud-phone-alert strong, #hud-phone-alert span {
  display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
#hud-phone-alert strong { font-weight: 600; font-size: 12.5px; color: #a8c7fa; }
#hud-phone-alert span { color: #d6dce3; font-size: 12px; }
#hud-phone-alert:focus-visible { outline: 2px solid #a8c7fa; outline-offset: 2px; }
.phone-overlay {
  display: none;
  position: fixed;
  inset: 0;
  z-index: 50;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.55);
  font-family: Roboto, 'Segoe UI', system-ui, -apple-system, sans-serif;
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
    radial-gradient(ellipse at 82% 16%, rgba(88, 128, 178, 0.52) 0%, transparent 52%),
    radial-gradient(ellipse at 16% 84%, rgba(40, 96, 104, 0.58) 0%, transparent 58%),
    linear-gradient(168deg, #121a26 0%, #0d151d 55%, #091016 100%);
  color: #eef2f6;
  border: 0;
  border-radius: 6% / 3%;
  overflow: hidden;
  position: relative;
}
.phone-device.is-app-open {
  background: #111418;
}
.phone-device::before {
  content: ''; position: absolute; left: 50%; top: 8px; transform: translateX(-50%);
  width: 10px; height: 10px; z-index: 5;
  background: radial-gradient(circle at 38% 35%, #24303d 0%, #06080b 65%);
  border-radius: 50%;
  box-shadow: 0 0 0 1.5px rgba(0, 0, 0, 0.85), inset 0 0 0 1px rgba(255, 255, 255, 0.12);
  pointer-events: none;
}
.phone-device[data-wallpaper="dusk"]:not(.is-app-open) {
  background:
    radial-gradient(ellipse at 80% 18%, rgba(164, 98, 118, 0.45) 0%, transparent 52%),
    radial-gradient(ellipse at 20% 82%, rgba(74, 72, 134, 0.52) 0%, transparent 56%),
    linear-gradient(165deg, #1d1a2c, #281c28 52%, #11141f);
}
.phone-device[data-wallpaper="forest"]:not(.is-app-open) {
  background:
    radial-gradient(ellipse at 78% 18%, rgba(74, 128, 98, 0.44) 0%, transparent 52%),
    radial-gradient(ellipse at 18% 82%, rgba(36, 78, 72, 0.55) 0%, transparent 58%),
    linear-gradient(165deg, #13211b, #11221e 55%, #0a1411);
}
.phone-device[data-wallpaper="photo"]:not(.is-app-open) {
  background: linear-gradient(rgba(10, 14, 20, 0.45), rgba(10, 14, 20, 0.65)), var(--phone-photo) center / cover;
}
.phone-overlay.is-thumb-active .phone-device::after {
  content: ''; position: absolute; z-index: 4; pointer-events: none;
  left: var(--phone-thumb-x); top: var(--phone-thumb-y);
  width: 13%; height: 12%; border-radius: 49% 49% 46% 44% / 35% 39% 62% 65%;
  transform: translate(-38%, -40%) rotate(26deg);
  background:
    radial-gradient(ellipse at 50% 27%, #ffded860 0%, #edc9bb38 28%, transparent 43%),
    linear-gradient(110deg, #d6edff25, transparent 58%, #1d121e40), var(--phone-thumb-tint);
  box-shadow: 1px 3px 6px #12192262;
}
.phone-lock-preview {
  width: min(100%, 260px); color: #eef2f6;
  background: rgba(20, 25, 32, 0.72);
  backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.11);
  border-radius: 18px; min-height: 44px; padding: 10px 13px; cursor: pointer;
  text-align: left; overflow-wrap: anywhere;
}
.phone-lock-preview strong { font-size: 12.5px; font-weight: 600; color: #f1f5f9; display: block; }
.phone-lock-preview span { display: block; font-size: 11.5px; color: rgba(226, 232, 240, 0.78); margin-top: 2px; }
.phone-map-destination {
  min-height: 42px; flex-shrink: 0; margin-bottom: 8px; padding: 0 10px;
  border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.12);
  color: #eef2f6; background: #1c2128; font: 500 13px/1.2 Roboto, system-ui, sans-serif;
}
.phone-viewfinder { width: 100%; display: block; border-radius: 12px; touch-action: none; object-fit: contain; }
.phone-photo-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
.phone-photo-grid button { padding: 4px; min-width: 0; border-radius: 10px; border: 1px solid rgba(255, 255, 255, 0.08); background: #1c2128; }
.phone-photo-grid img { display: block; width: 100%; border-radius: 7px; }
.phone-status-left { touch-action: none; }
.phone-sys-icons {
  display: inline-flex; align-items: center; gap: 4px;
  color: rgba(241, 245, 249, 0.9); flex: 0 0 auto;
}
.phone-shade-toggle {
  flex: 0 0 auto; min-width: 30px; min-height: 34px; padding: 0 4px;
  color: rgba(241, 245, 249, 0.85); background: transparent; border: 0; font-size: 15px;
  cursor: pointer; touch-action: manipulation; border-radius: 8px;
}
.phone-shade-toggle:hover { background: rgba(255, 255, 255, 0.1); }
.phone-lock {
  display: flex; flex-direction: column; align-items: center; justify-content: space-between;
  gap: 10px; flex: 1 1 auto; padding: 18px 8px 12px;
  text-align: center; touch-action: none;
}
.phone-lock-clock { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.phone-lock-time {
  font: 300 clamp(38px, 8vw, 56px)/1 Roboto, 'Segoe UI', system-ui, sans-serif;
  letter-spacing: -0.04em; color: #f6f9fc;
  text-shadow: 0 2px 12px rgba(0, 0, 0, 0.35);
}
.phone-lock-day {
  font: 500 12.5px/1.2 Roboto, system-ui, sans-serif;
  color: rgba(235, 242, 250, 0.82); letter-spacing: 0.02em;
}
.phone-lock-cards {
  display: flex; flex-direction: column; align-items: center; gap: 7px; width: 100%;
}
.phone-lock-unlock {
  width: 50px; height: 50px; min-width: 50px; min-height: 50px;
  display: inline-flex; align-items: center; justify-content: center;
  border-radius: 50%; border: 1px solid rgba(168, 199, 250, 0.42);
  background: rgba(168, 199, 250, 0.14); color: #d3e3fd;
  cursor: pointer; touch-action: manipulation;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
}
.phone-lock-unlock:hover, .phone-lock-unlock:focus-visible {
  background: rgba(168, 199, 250, 0.28); outline: none;
}
.phone-lock-hint {
  font: 500 10.5px/1.2 Roboto, system-ui, sans-serif;
  color: rgba(235, 242, 250, 0.65); letter-spacing: 0.02em;
}
.phone-shade {
  position: absolute; z-index: 6; inset: 0; padding: 14px 14px 16px;
  overflow: auto;
  background: rgba(14, 17, 22, 0.96);
  backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
  color: #eef2f6;
}
.phone-shade[hidden] { display: none; }
.phone-shade-header {
  display: flex; align-items: center; justify-content: space-between; gap: 4px;
  touch-action: none; margin-bottom: 10px;
}
.phone-shade-header h3 { margin: 0; font: 500 14px/1.2 Roboto, system-ui, sans-serif; color: #c4cfdc; }
.phone-qs-grid {
  display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;
  margin-bottom: 14px;
}
.phone-qs-tile {
  display: flex; flex-direction: column; align-items: flex-start; justify-content: center;
  gap: 2px; min-height: 48px; padding: 8px 12px;
  border: 0; border-radius: 20px;
  background: #232932; color: #d5dde7;
  font: 500 12px/1.2 Roboto, system-ui, sans-serif;
  cursor: pointer; touch-action: manipulation; text-align: left;
}
.phone-qs-tile span { font-size: 10.5px; opacity: 0.72; }
.phone-qs-tile.is-on { background: #a8c7fa; color: #0b2242; }
.phone-qs-tile.is-on span { color: #173660; opacity: 0.88; }
.phone-shade-section {
  margin: 0 0 8px; font: 600 11px/1.2 Roboto, system-ui, sans-serif;
  text-transform: uppercase; letter-spacing: 0.06em; color: #8c98a8;
}
.phone-shade-row {
  width: 100%; min-height: 44px; text-align: left; margin-bottom: 8px;
  color: #eef2f6; font: inherit;
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 16px; background: #1c2129; padding: 10px 12px; cursor: pointer;
}
.phone-shade-row strong { display: block; font-size: 12.5px; font-weight: 600; }
.phone-shade-row span { display: block; font-size: 11.5px; color: #adb8c6; margin-top: 2px; overflow-wrap: anywhere; }
.phone-pref {
  display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between;
  gap: 8px; min-height: 48px; margin-bottom: 8px; padding: 8px 12px;
  border-radius: 14px; background: #1b2028; border: 1px solid rgba(255, 255, 255, 0.06);
  font-size: 13px;
}
.phone-pref select {
  min-height: 36px; padding: 0 8px; color: #eef2f6; background: #262d38;
  border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 10px;
}
.phone-pref input { width: 20px; height: 20px; accent-color: #a8c7fa; }
.phone-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  min-height: 36px;
  padding: 6px 8px 2px 14px;
  flex: 0 0 auto;
}
.phone-status-left {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 1 1 auto;
}
.phone-status-right {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 0 0 auto;
}
.phone-status-time {
  margin: 0;
  font: 600 11.5px/1.2 Roboto, system-ui, sans-serif;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.phone-status-weather {
  flex: 0 0 auto;
  font-size: 13px;
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
  font: 600 18px/1.2 Roboto, system-ui, sans-serif;
  text-align: center;
}
.phone-close {
  box-sizing: border-box;
  width: 34px; height: 34px; min-width: 34px; min-height: 34px;
  padding: 0; margin: 0;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: rgba(241, 245, 249, 0.9);
  font: 500 20px/1 Roboto, system-ui, sans-serif;
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
  padding: 6px 14px 4px;
  display: flex;
  flex-direction: column;
}

.phone-task-pin {
  margin-top: 6px;
  min-height: 40px;
  padding: 0 14px;
  border: 1px solid rgba(168, 199, 250, 0.28);
  border-radius: 20px;
  background: rgba(168, 199, 250, 0.14);
  color: #d3e3fd;
  font: 500 12.5px/1 Roboto, system-ui, sans-serif;
  cursor: pointer;
}
/* Pixel / Android "At a Glance" transparent home widget */
.phone-launcher-widget {
  flex: 0 0 auto; margin: 8px 2px 10px; padding: 6px 4px;
  background: transparent;
  font: 500 13px/1.3 Roboto, system-ui, sans-serif;
  text-shadow: 0 1px 6px rgba(0, 0, 0, 0.45);
}
.phone-launcher-widget strong {
  display: block; font-size: 16px; font-weight: 500; letter-spacing: -0.01em; color: #f8fafc;
}
.phone-launcher-widget span {
  display: block; font-size: 11.5px; color: rgba(226, 232, 240, 0.82); margin-top: 2px;
}
.phone-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px 6px;
  padding: 6px 0 4px;
}
.phone-app {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  min-width: 44px;
  min-height: 66px;
  padding: 2px;
  border: 0;
  background: transparent;
  color: #f1f5f9;
  cursor: pointer;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}
.phone-app:hover, .phone-app:focus { outline: none; }
.phone-app:hover .phone-app-icon,
.phone-app:focus .phone-app-icon {
  transform: scale(1.06);
  filter: brightness(1.08);
}
.phone-app-icon {
  box-sizing: border-box;
  width: 44px; height: 44px; min-width: 44px; min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 26%;
  background: linear-gradient(145deg, #3b4656, #242b35);
  color: #f1f5f9;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.34), inset 0 1px 0 rgba(255, 255, 255, 0.22);
  font-size: 20px;
  line-height: 1;
  transition: transform 0.14s ease, filter 0.14s ease;
}
.phone-app:focus-visible .phone-app-icon { outline: 2px solid #a8c7fa; outline-offset: 2px; }
.phone-app-name {
  font: 500 10.5px/1.2 Roboto, system-ui, sans-serif;
  text-align: center;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.65);
}

.phone-app-title {
  margin: 4px 0 12px;
  font: 500 18px/1.2 Roboto, system-ui, sans-serif;
  letter-spacing: -0.01em;
  color: #f1f5f9;
}
.phone-placeholder {
  margin: 8px 0 0;
  font: 14px/1.45 Roboto, system-ui, sans-serif;
  color: rgba(226, 232, 240, 0.78);
}
.phone-messages {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0 0 8px;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  flex: 1 1 auto;
  min-height: 0;
}
.phone-message {
  box-sizing: border-box;
  min-height: 44px;
  padding: 11px 13px;
  border-radius: 16px;
  background: #1b2028;
  border: 1px solid rgba(255, 255, 255, 0.06);
}
.phone-message-from {
  font: 600 13px/1.3 Roboto, system-ui, sans-serif;
  color: #a8c7fa;
}
.phone-message-day {
  margin-top: 2px;
  font: 500 10.5px/1.2 Roboto, system-ui, sans-serif;
  color: #8c98a8;
}
.phone-message-body {
  margin: 6px 0 0;
  font: 13.5px/1.45 Roboto, system-ui, sans-serif;
  color: #e4eaf2;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.phone-bank-label {
  margin: 4px 0 0;
  font: 500 12.5px/1.2 Roboto, system-ui, sans-serif;
  color: #9aa7b8;
}
.phone-bank-balance {
  margin: 6px 0 0;
  font: 600 32px/1.1 Roboto, system-ui, sans-serif;
  font-variant-numeric: tabular-nums;
  color: #81c995;
}

.phone-home-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  min-height: 36px;
  padding: 0 16px 4px;
}
.phone-home {
  box-sizing: border-box;
  width: 112px; height: 32px;
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
  margin: auto; background: rgba(238, 242, 246, 0.82); border-radius: 8px;
}
.phone-home:hover, .phone-home:focus-visible {
  background: rgba(255, 255, 255, 0.12);
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
  getFinances = null,
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
  addInboxMessage = null,
  markInboxRead = null,
  onInboxChange = null,
  getHomeDecor = null,
  buyHomeDecor = null,
  onHomeDecorChange = null,
  getFriendship = null,
  onTextSent = null,
  playNotification = null,
  getDestinations = null,
  getWaypointId = null,
  setWaypoint = null,
  capturePhoto = null
} = {}) {
  ensureStyles();

  let opened = false;
  let locked = false;
  let hudVisible = false;
  let pendingMessage = null;
  let messageTimer = null;
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

  const alert = document.createElement('button');
  alert.type = 'button';
  alert.id = 'hud-phone-alert';
  alert.className = 'hud-ui';
  alert.hidden = true;
  alert.setAttribute('aria-live', 'polite');
  const alertTitle = document.createElement('strong');
  const alertPreview = document.createElement('span');
  alert.append(alertTitle, alertPreview);

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
  shadeToggle.title = 'Notifications & Quick Settings';
  shadeToggle.setAttribute('aria-label', 'Open notifications');
  shadeToggle.setAttribute('aria-expanded', 'false');
  const statusRight = document.createElement('div');
  statusRight.className = 'phone-status-right';
  statusRight.insertAdjacentHTML('afterbegin', ANDROID_STATUS_ICONS_SVG);
  statusRight.append(shadeToggle, closeBtn);
  status.append(statusLeft, statusRight);

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
  lockDay.className = 'phone-lock-day';
  const shade = document.createElement('section');
  shade.className = 'phone-shade';
  shade.hidden = true;
  shade.setAttribute('aria-label', 'Notifications');
  device.append(status, screen, homeBar, shade);
  overlay.appendChild(device);
  container.append(button, alert, overlay);

  const ctx = {
    getTime: () => (typeof getTime === 'function' ? getTime() : (clock && typeof clock.getTime === 'function' ? clock.getTime() : null)),
    getFinances,
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
    addInboxMessage: typeof addInboxMessage === 'function' ? addInboxMessage : null,
    markInboxRead: typeof markInboxRead === 'function' ? markInboxRead : null,
    onInboxChange: typeof onInboxChange === 'function' ? onInboxChange : null,
    getHomeDecor: typeof getHomeDecor === 'function' ? getHomeDecor : null,
    buyHomeDecor: typeof buyHomeDecor === 'function' ? buyHomeDecor : null,
    onHomeDecorChange: typeof onHomeDecorChange === 'function' ? onHomeDecorChange : null,
    getFriendship: typeof getFriendship === 'function' ? getFriendship : null,
    onTextSent: typeof onTextSent === 'function' ? onTextSent : null,
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

  let dndOn = false;
  let wifiOn = true;

  function updateStatus(time) {
    const t = time || ctx.getTime();
    const w = ctx.getWeather ? ctx.getWeather() : null;
    const shortClock = t?.label?.match(/\b\d{1,2}:\d{2}\b/)?.[0] || '--:--';
    timeEl.textContent = shortClock;
    lockTime.textContent = shortClock;
    const dayLabel = t?.day != null ? 'Day ' + t.day + ' · Maple Lane' : 'Maple Lane';
    lockDay.textContent = w?.name ? `${dayLabel} · ${w.name}` : dayLabel;
    launcherWidget.replaceChildren();
    const titleLine = document.createElement('strong');
    titleLine.textContent = t && t.day != null ? 'Day ' + t.day + ' · Maple Lane' : 'Maple Lane';
    const subLine = document.createElement('span');
    const pinned = ctx.getPinnedTask?.();
    subLine.textContent = pinned?.title
      ? `${w?.name ? w.name + ' · ' : ''}${pinned.title}`
      : (w?.name ? `${w.name} · 5G` : '5G · Connected');
    launcherWidget.append(titleLine, subLine);
    paintWeather(w);
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
    title.textContent = lockTime.textContent + ' · Quick Settings';
    const dismiss = document.createElement('button');
    dismiss.type = 'button';
    dismiss.className = 'phone-shade-toggle';
    dismiss.setAttribute('aria-label', 'Close notifications');
    dismiss.textContent = '⌃';
    dismiss.addEventListener('click', () => { setShade(false); shadeToggle.focus(); });
    header.append(title, dismiss);
    swipe(header, -1, () => setShade(false));
    shade.append(header);

    // Android Material 3 Quick Settings pill tiles
    const qsGrid = document.createElement('div');
    qsGrid.className = 'phone-qs-grid';
    function addQsTile(label, sub, on, onClick) {
      const tile = document.createElement('button');
      tile.type = 'button';
      tile.className = 'phone-qs-tile' + (on ? ' is-on' : '');
      const strong = document.createElement('strong');
      strong.textContent = label;
      const span = document.createElement('span');
      span.textContent = sub;
      tile.append(strong, span);
      tile.addEventListener('click', () => { onClick(); renderShade(); });
      qsGrid.append(tile);
    }
    addQsTile('Internet', wifiOn ? 'MapleLane 5G' : 'Off', wifiOn, () => { wifiOn = !wifiOn; });
    addQsTile('Sound', prefs.sound ? 'Ring on' : 'Muted', !!prefs.sound, () => {
      ctx.setPhonePrefs({ sound: !prefs.sound });
      if (prefs.sound) ctx.previewNotification();
    });
    const wpKeys = Object.keys(WALLPAPERS);
    const wpName = WALLPAPERS[prefs.wallpaper] || 'Photo';
    addQsTile('Wallpaper', wpName, true, () => {
      const idx = wpKeys.indexOf(prefs.wallpaper);
      ctx.setPhonePrefs({ wallpaper: wpKeys[(idx + 1) % wpKeys.length] });
    });
    addQsTile('Do Not Disturb', dndOn ? 'On' : 'Off', dndOn, () => { dndOn = !dndOn; });
    shade.append(qsGrid);

    const sec = document.createElement('p');
    sec.className = 'phone-shade-section';
    sec.textContent = 'Notifications';
    shade.append(sec);

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
    for (const note of notes) addRow('messages', note.from || 'Messages', note.body || '');
    for (const task of tasks) addRow('tasks', task.title, task.step || '');
    if (!notes.length && !tasks.length) {
      const empty = document.createElement('p');
      empty.className = 'phone-placeholder';
      empty.textContent = 'No notifications.';
      shade.append(empty);
    }
  }

  function renderLock(preferredMessage = null) {
    clearApp();
    device.classList.remove('is-app-open');
    locked = true;
    closeBtn.textContent = '\u00d7';
    closeBtn.setAttribute('aria-label', 'Put phone away');
    homeBtn.setAttribute('aria-label', 'Unlock phone');
    const lock = document.createElement('div');
    lock.className = 'phone-lock';
    const clockWrap = document.createElement('div');
    clockWrap.className = 'phone-lock-clock';
    clockWrap.append(lockTime, lockDay);

    const cardsWrap = document.createElement('div');
    cardsWrap.className = 'phone-lock-cards';
    const latest = preferredMessage ?? (ctx.getInbox?.() ?? []).find(Boolean);
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
      cardsWrap.append(card);
    }

    const unlockWrap = document.createElement('div');
    unlockWrap.style.display = 'flex';
    unlockWrap.style.flexDirection = 'column';
    unlockWrap.style.alignItems = 'center';
    unlockWrap.style.gap = '6px';
    const unlock = document.createElement('button');
    unlock.type = 'button';
    unlock.className = 'phone-lock-unlock';
    unlock.setAttribute('aria-label', 'Unlock phone');
    unlock.innerHTML = FINGERPRINT_SVG;
    unlock.addEventListener('click', renderHome);
    const hint = document.createElement('span');
    hint.className = 'phone-lock-hint';
    hint.textContent = 'Tap or swipe up to unlock';
    unlockWrap.append(unlock, hint);

    lock.append(clockWrap, cardsWrap, unlockWrap);
    swipe(lock, -1, renderHome);
    screen.append(lock);
  }

  function renderHome() {
    clearApp();
    device.classList.remove('is-app-open');
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
      const meta = APP_ICON_META[app.id];
      if (meta) {
        icon.style.background = meta.bg;
        icon.style.color = meta.fg;
        icon.innerHTML = meta.svg;
      } else {
        icon.textContent = app.icon || '';
      }
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
    device.classList.add('is-app-open');
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
    const message = pendingMessage;
    clearAlert();
    opened = true;
    renderLock(message);
    updateStatus();
    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');
    exitPointerLock();
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
    if (!mobile() && started() && !blocked()) {
      requestPointerLock(canvas);
    }
  }

  function toggle() {
    if (opened) close();
    else open();
  }

  function isOpen() {
    return opened;
  }

  function clearAlert() {
    clearTimeout(messageTimer);
    messageTimer = null;
    pendingMessage = null;
    alert.hidden = true;
  }

  function syncAlert() {
    alert.hidden = !pendingMessage || !hudVisible || opened;
    if (!alert.hidden && messageTimer === null) messageTimer = setTimeout(clearAlert, MESSAGE_ALERT_MS);
  }

  function notifyMessage(note) {
    clearAlert();
    pendingMessage = note;
    alertTitle.textContent = 'New message from ' + (note.from || 'Mail');
    alertPreview.textContent = note.body || 'Open phone to read';
    syncAlert();
  }

  function setVisible(v) {
    hudVisible = !!v;
    button.classList.toggle('is-visible', hudVisible);
    syncAlert();
  }

  shadeToggle.addEventListener('click', () => setShade(true));
  swipe(statusLeft, 1, () => setShade(true));
  let knownMessages = new Set((ctx.getInbox?.() ?? []).filter(Boolean).map(note => note.id));
  const offInbox = ctx.onInboxChange?.((list) => {
    const notes = (list ?? ctx.getInbox?.() ?? []).filter(Boolean);
    const latest = notes.find(note => !knownMessages.has(note.id));
    knownMessages = new Set(notes.map(note => note.id));
    if (latest) {
      if (prefs.sound) playNotification?.();
      if (!opened) notifyMessage(latest);
      else if (locked && shade.hidden) {
        renderLock(latest);
        updateStatus();
      }
    }
    if (!shade.hidden) renderShade();
  });

  alert.addEventListener('pointerdown', (event) => event.stopPropagation());
  alert.addEventListener('touchstart', (event) => event.stopPropagation(), { passive: true });
  alert.addEventListener('click', (event) => {
    event.stopPropagation();
    if (pendingMessage) open();
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
    clearAlert();
    clearApp();
    alert.remove();
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
