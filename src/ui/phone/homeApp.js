/**
 * Home Catalogue phone app: browse furniture, rugs, lamps, plants & wall art,
 * buy with earned cash, and immediately place them inside your Maple Lane house.
 */

import { HOME_DECOR_ITEMS, HOME_THEMES } from '../../data/homeDecor.js';

const STYLE_ID = 'maple-phone-home-app-css';

const CSS = `
.phome-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  gap: 8px;
  color: #edf2f8;
  font-family: system-ui, -apple-system, sans-serif;
}
.phome-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-shrink: 0;
}
.phome-title {
  margin: 0;
  font: 700 17px/1.15 system-ui, sans-serif;
  color: #f5f8fc;
}
.phome-bal {
  font: 700 12px/1 system-ui, sans-serif;
  color: #8fddb0;
  background: rgba(143, 221, 176, 0.14);
  border: 1px solid rgba(143, 221, 176, 0.28);
  border-radius: 999px;
  padding: 5px 9px;
}
.phome-sub {
  margin: -2px 0 2px;
  font: 400 11.5px/1.25 system-ui, sans-serif;
  color: rgba(255, 255, 255, 0.62);
  flex-shrink: 0;
}
.phome-themes {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
  flex-shrink: 0;
}
.phome-theme-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 8px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.06);
  color: rgba(240, 245, 252, 0.86);
  font: 600 10.5px/1 system-ui, sans-serif;
  cursor: pointer;
}
.phome-theme-btn.is-active {
  border-color: rgba(164, 206, 255, 0.72);
  background: rgba(68, 122, 214, 0.34);
  color: #fff;
}
.phome-theme-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 1px solid rgba(0, 0, 0, 0.35);
}
.phome-list {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-right: 2px;
}
.phome-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 10px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.055);
  border: 1px solid rgba(255, 255, 255, 0.08);
}
.phome-card.is-owned {
  border-color: rgba(143, 221, 176, 0.30);
  background: rgba(143, 221, 176, 0.08);
}
.phome-ico {
  width: 36px;
  height: 36px;
  border-radius: 11px;
  background: rgba(255, 255, 255, 0.08);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
}
.phome-info {
  flex: 1 1 auto;
  min-width: 0;
}
.phome-name {
  margin: 0;
  font: 600 12.5px/1.2 system-ui, sans-serif;
  color: #f4f7fb;
}
.phome-room {
  margin: 2px 0 0;
  font: 400 10.5px/1.2 system-ui, sans-serif;
  color: rgba(255, 255, 255, 0.56);
}
.phome-btn {
  border: none;
  border-radius: 999px;
  background: #1a73e8;
  color: #fff;
  font: 700 11px/1 system-ui, sans-serif;
  padding: 7px 11px;
  cursor: pointer;
  flex-shrink: 0;
}
.phome-btn:hover { background: #2b7de9; }
.phome-btn:disabled {
  background: rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.45);
  cursor: default;
}
.phome-owned-tag {
  font: 700 11px/1 system-ui, sans-serif;
  color: #8fddb0;
  padding: 6px 8px;
  flex-shrink: 0;
}
`;

function ensureStyles() {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

export function renderHomeApp(screen, ctx = {}) {
  if (!screen) return null;
  ensureStyles();

  function paint() {
    screen.innerHTML = '';
    const ownedList = typeof ctx.getHomeDecor === 'function' ? (ctx.getHomeDecor() || []) : [];
    const ownedSet = new Set(ownedList);
    const activeTheme = typeof ctx.getHomeTheme === 'function' ? ctx.getHomeTheme() : 'classic';
    const cash = typeof ctx.getMoney === 'function' ? Number(ctx.getMoney()) : 0;

    const root = document.createElement('div');
    root.className = 'phome-root';

    const head = document.createElement('div');
    head.className = 'phome-head';
    const title = document.createElement('h3');
    title.className = 'phome-title';
    title.textContent = 'Home';
    const bal = document.createElement('span');
    bal.className = 'phome-bal';
    bal.textContent = `$${cash}`;
    head.append(title, bal);

    const sub = document.createElement('p');
    sub.className = 'phome-sub';
    sub.textContent = `Furnish your house (${ownedSet.size}/${HOME_DECOR_ITEMS.length} placed)`;

    const themeBar = document.createElement('div');
    themeBar.className = 'phome-themes';
    for (const theme of HOME_THEMES) {
      const tbtn = document.createElement('button');
      tbtn.type = 'button';
      tbtn.className = 'phome-theme-btn' + (activeTheme === theme.id ? ' is-active' : '');
      const dot = document.createElement('span');
      dot.className = 'phome-theme-dot';
      dot.style.background = theme.swatch;
      tbtn.append(dot, document.createTextNode(theme.name));
      tbtn.addEventListener('click', () => {
        ctx.setHomeTheme?.(theme.id);
        paint();
      });
      themeBar.appendChild(tbtn);
    }

    const list = document.createElement('div');
    list.className = 'phome-list';
    for (const item of HOME_DECOR_ITEMS) {
      const owned = ownedSet.has(item.id);
      const card = document.createElement('div');
      card.className = 'phome-card' + (owned ? ' is-owned' : '');

      const ico = document.createElement('span');
      ico.className = 'phome-ico';
      ico.textContent = item.icon;

      const info = document.createElement('div');
      info.className = 'phome-info';
      const name = document.createElement('p');
      name.className = 'phome-name';
      name.textContent = item.name;
      const room = document.createElement('p');
      room.className = 'phome-room';
      room.textContent = item.room;
      info.append(name, room);

      card.append(ico, info);
      if (owned) {
        const tag = document.createElement('span');
        tag.className = 'phome-owned-tag';
        tag.textContent = 'Placed ✓';
        card.appendChild(tag);
      } else {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'phome-btn';
        btn.textContent = `$${item.price}`;
        btn.disabled = cash < item.price;
        btn.title = cash < item.price ? `Need $${item.price}` : `Buy & place ${item.name}`;
        btn.addEventListener('click', () => {
          ctx.buyHomeDecor?.(item.id);
          paint();
        });
        card.appendChild(btn);
      }
      list.appendChild(card);
    }

    root.append(head, sub, themeBar, list);
    screen.appendChild(root);
  }

  paint();
  const offDecor = typeof ctx.onHomeDecorChange === 'function' ? ctx.onHomeDecorChange(() => paint()) : null;
  const offMoney = typeof ctx.onMoneyChange === 'function' ? ctx.onMoneyChange(() => paint()) : null;
  return () => {
    if (typeof offDecor === 'function') offDecor();
    if (typeof offMoney === 'function') offMoney();
  };
}

export default renderHomeApp;
