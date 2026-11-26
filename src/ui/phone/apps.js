/**
 * Phone app registry. Each later app (Map, Style, Weather, …) is one
 * entry: add it here and it appears on the home grid.
 */
import { formatCash } from '../../systems/money.js';
import { renderStyleApp } from './style.js';

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
  }
];

export function getPhoneApp(id, apps = PHONE_APPS) {
  if (!id || !apps) return null;
  for (let i = 0; i < apps.length; i++) {
    if (apps[i] && apps[i].id === id) return apps[i];
  }
  return null;
}
