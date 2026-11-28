/**
 * Phone app registry. Each later app is one entry: add it here and it
 * appears on the home grid.
 */
import { renderBankApp } from './bank.js';
import { renderStyleApp } from './style.js';
import { renderCalendarApp } from './calendar.js';
import { renderSkillsApp } from './skills.js';
import { renderMessagesApp } from './messages.js';
import { renderTasksApp } from './tasks.js';
import { renderMapApp } from './mapApp.js';
import { renderHomeApp } from './homeApp.js';
import { CAMERA_APP, GALLERY_APP } from './photos.js';

export const PHONE_APPS = [
  {
    id: 'messages',
    name: 'Messages',
    icon: '💬',
    placeholder: 'No new messages.',
    render: renderMessagesApp
  },
  {
    id: 'bank',
    name: 'Bank',
    icon: '🏦',
    render: renderBankApp
  },
  {
    id: 'map',
    name: 'Map',
    icon: '🗺️',
    render(screen, ctx) {
      return renderMapApp(screen, ctx);
    }
  },
  {
    id: 'style',
    name: 'Style',
    icon: '👕',
    render(screen, ctx) {
      return renderStyleApp(screen, ctx);
    }
  },
  {
    id: 'weather',
    name: 'Weather',
    icon: '🌦️',
    render(screen, ctx) {
      const title = document.createElement('h3');
      title.className = 'phone-app-title';
      title.textContent = 'Weather';
      const icon = document.createElement('p');
      icon.className = 'phone-weather-icon';
      const name = document.createElement('p');
      name.className = 'phone-weather-name';
      const detail = document.createElement('p');
      detail.className = 'phone-weather-detail';
      function paint(state) {
        const w = state || (ctx && ctx.getWeather ? ctx.getWeather() : null);
        icon.textContent = (w && w.icon) || '☀️';
        name.textContent = ((w && w.name) || 'Clear') + (w && Number.isFinite(w.tempF) ? ` · ${w.tempF}°F` : '');
        const bits = [];
        if (w && w.progress < 1 && w.from && w.from !== w.to) bits.push('Conditions changing');
        if (w && w.snowCover > 0.15) bits.push(w.snowCover > 0.7 ? 'Snow on the ground' : 'A dusting of snow');
        if (w && w.cold) bits.push('Cold spell');
        detail.textContent = bits.join(' · ');
      }
      paint();
      const off = ctx && typeof ctx.onWeatherChange === 'function'
        ? ctx.onWeatherChange(paint)
        : null;
      screen.append(title, icon, name, detail);
      return () => { if (typeof off === 'function') off(); };
    }
  }
];

/** Skills is a first-class registry entry, installed in the live phone. */
export const SKILLS_APP = {
  id: 'skills',
  name: 'Skills',
  icon: '🏅',
  render(screen, ctx) {
    return renderSkillsApp(screen, ctx);
  }
};

/** Calendar is a first-class registry entry, installed in the live phone. */
export const CALENDAR_APP = {
  id: 'calendar',
  name: 'Calendar',
  icon: '📅',
  render(screen, ctx) {
    return renderCalendarApp(screen, ctx);
  }
};

/**
 * Apps shown in the game. PHONE_APPS stays the original five-entry list so
 * older tests that pin the home grid can keep using the default createPhone()
 * path; main.js passes INSTALLED_APPS so Skills and Calendar appear on the
 * live phone. Calendar stays last so older calendar tests keep passing.
 */
const PHONE_SETTINGS_APP = {
  id: 'settings',
  name: 'Settings',
  icon: '⚙️',
  render(screen, ctx) {
    const heading = document.createElement('h3');
    heading.className = 'phone-app-title';
    heading.textContent = 'Phone settings';
    const wallpaper = document.createElement('label');
    wallpaper.className = 'phone-pref';
    wallpaper.textContent = 'Wallpaper';
    const select = document.createElement('select');
    for (const [value, name] of Object.entries(ctx.wallpapers)) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = name;
      select.append(option);
    }
    const currentWallpaper = ctx.getPhonePrefs().wallpaper;
    if (currentWallpaper === 'photo') {
      const photo = document.createElement('option');
      photo.value = 'photo';
      photo.textContent = 'Current photo';
      photo.disabled = true;
      select.append(photo);
    }
    select.value = currentWallpaper;
    select.addEventListener('change', () => ctx.setPhonePrefs({ wallpaper: select.value }));
    wallpaper.append(select);
    const sound = document.createElement('label');
    sound.className = 'phone-pref';
    sound.textContent = 'Notification sound';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = ctx.getPhonePrefs().sound;
    checkbox.addEventListener('change', () => {
      ctx.setPhonePrefs({ sound: checkbox.checked });
      if (checkbox.checked) ctx.previewNotification();
    });
    sound.append(checkbox);
    screen.append(heading, wallpaper, sound);
  }
};

export const INSTALLED_APPS = PHONE_APPS.concat(SKILLS_APP, PHONE_SETTINGS_APP, CAMERA_APP, GALLERY_APP, {
  id: 'tasks', name: 'Tasks', icon: '📋', render: renderTasksApp
}, {
  id: 'home', name: 'Home', icon: '🏠', render: renderHomeApp
}, CALENDAR_APP);

export function getPhoneApp(id, apps = INSTALLED_APPS) {
  if (!id || !apps) return null;
  for (let i = 0; i < apps.length; i++) {
    if (apps[i] && apps[i].id === id) return apps[i];
  }
  return null;
}
