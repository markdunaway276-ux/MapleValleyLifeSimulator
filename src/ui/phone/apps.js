/**
 * Phone app registry. Each later app is one entry: add it here and it
 * appears on the home grid.
 */
import { formatCash } from '../../systems/money.js';
import { renderStyleApp } from './style.js';
import { renderCalendarApp } from './calendar.js';

export const PHONE_APPS = [
  {
    id: 'messages',
    name: 'Messages',
    icon: '💬',
    placeholder: 'No new messages.'
  },
  {
    id: 'bank',
    name: 'Bank',
    icon: '🏦',
    render(screen, ctx) {
      const title = document.createElement('h3');
      title.className = 'phone-app-title';
      title.textContent = 'Bank';
      const label = document.createElement('p');
      label.className = 'phone-bank-label';
      label.textContent = 'Cash';
      const bal = document.createElement('p');
      bal.className = 'phone-bank-balance';
      function paint(value) {
        const raw = value != null ? value : (ctx.getMoney ? ctx.getMoney() : 0);
        bal.textContent = formatCash(raw);
      }
      paint();
      const off = ctx.onMoneyChange ? ctx.onMoneyChange(paint) : null;
      screen.append(title, label, bal);
      return () => { if (typeof off === 'function') off(); };
    }
  },
  {
    id: 'map',
    name: 'Map',
    icon: '🗺️',
    render(screen, ctx) {
      const title = document.createElement('h3');
      title.className = 'phone-app-title';
      title.textContent = 'Map';
      const wrap = document.createElement('div');
      wrap.className = 'phone-map';
      screen.append(title, wrap);
      if (ctx && typeof ctx.attachMap === 'function') return ctx.attachMap(wrap);
      return null;
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
      function paint(state) {
        const w = state || (ctx && ctx.getWeather ? ctx.getWeather() : null);
        icon.textContent = (w && w.icon) || '☀️';
        name.textContent = (w && w.name) || 'Clear';
      }
      paint();
      const off = ctx && typeof ctx.onWeatherChange === 'function'
        ? ctx.onWeatherChange(paint)
        : null;
      screen.append(title, icon, name);
      return () => { if (typeof off === 'function') off(); };
    }
  }
];

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
 * path; main.js passes INSTALLED_APPS so Calendar appears on the live phone.
 */
export const INSTALLED_APPS = PHONE_APPS.concat(CALENDAR_APP);

export function getPhoneApp(id, apps = INSTALLED_APPS) {
  if (!id || !apps) return null;
  for (let i = 0; i < apps.length; i++) {
    if (apps[i] && apps[i].id === id) return apps[i];
  }
  return null;
}
