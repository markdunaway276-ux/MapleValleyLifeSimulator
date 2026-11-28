import {
  RECIPES,
  countIngredient,
  ingredientLabel,
  ingredientIcon,
  canCookRecipe
} from '../data/recipes.js';
import { requestPointerLock, exitPointerLock } from '../core/pointerLock.js';

const STYLE_ID = 'cooking-menu-styles';

const CSS = `
.cooking-overlay {
  display: none;
  position: fixed;
  inset: 0;
  z-index: 46;
  align-items: center;
  justify-content: center;
  background: rgba(10, 12, 14, 0.58);
  font-family: system-ui, -apple-system, sans-serif;
  pointer-events: auto;
}
.cooking-overlay.is-open { display: flex; }

.cooking-panel {
  width: min(94vw, 660px);
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  background: rgba(20, 19, 18, 0.95);
  color: #f6f2ea;
  border: 1px solid rgba(255, 224, 178, 0.22);
  border-radius: 14px;
  padding: clamp(14px, 2.4vmin, 22px);
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.55);
}

.cooking-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}
.cooking-title-wrap {
  display: flex;
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
}
.cooking-header h2 {
  margin: 0;
  font-size: clamp(17px, 3.2vmin, 21px);
  font-weight: 700;
  color: #ffe2b3;
}
.cooking-level {
  font-size: 13px;
  color: rgba(255, 232, 198, 0.78);
  background: rgba(255, 200, 120, 0.14);
  border: 1px solid rgba(255, 200, 120, 0.28);
  border-radius: 999px;
  padding: 2px 10px;
}
.cooking-close {
  width: 34px;
  height: 34px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #fff;
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
}
.cooking-close:hover, .cooking-close:focus {
  background: rgba(255, 255, 255, 0.12);
  outline: none;
}

.cooking-list {
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-right: 4px;
}

.cooking-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 11px 13px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.045);
  border: 1px solid rgba(255, 255, 255, 0.12);
}
.cooking-card.is-ready {
  border-color: rgba(140, 214, 146, 0.42);
  background: rgba(72, 138, 82, 0.12);
}

.cooking-card-main {
  display: flex;
  align-items: flex-start;
  gap: 11px;
  min-width: 0;
  flex: 1;
}
.cooking-icon {
  font-size: 28px;
  line-height: 1.1;
  flex: 0 0 auto;
}
.cooking-info {
  min-width: 0;
}
.cooking-name {
  margin: 0;
  font-size: 15px;
  font-weight: 650;
  color: #fff;
}
.cooking-buff {
  font-size: 12px;
  color: #a9e3a8;
  margin-top: 2px;
}
.cooking-ings {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}
.cooking-ing {
  font-size: 12px;
  padding: 2px 7px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.07);
  color: rgba(255, 255, 255, 0.72);
}
.cooking-ing.is-have {
  background: rgba(88, 170, 96, 0.22);
  color: #d6f7d6;
}
.cooking-ing.is-missing {
  background: rgba(196, 78, 66, 0.18);
  color: #f7c2bc;
}

.cooking-actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 0 0 auto;
}
.cooking-btn {
  min-height: 36px;
  padding: 6px 13px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.22);
  background: #2f7242;
  color: #fff;
  font: 600 13px system-ui, sans-serif;
  cursor: pointer;
  white-space: nowrap;
  touch-action: manipulation;
}
.cooking-btn:hover:not(:disabled), .cooking-btn:focus:not(:disabled) {
  background: #3a8b51;
  outline: none;
}
.cooking-btn.secondary {
  background: rgba(255, 255, 255, 0.08);
  font-size: 12px;
  min-height: 30px;
  padding: 4px 10px;
}
.cooking-btn.secondary:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.16);
}
.cooking-btn:disabled {
  opacity: 0.42;
  cursor: not-allowed;
  background: rgba(255, 255, 255, 0.08);
}

.cooking-footer {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}
.cooking-tip {
  margin: 0;
  font-size: 12px;
  color: rgba(255, 244, 224, 0.68);
}
`;

function ensureStyles() {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

export function createCookingMenu({
  container = typeof document !== 'undefined' ? document.body : null,
  canvas = null,
  isMobile = false,
  isStarted = () => true,
  isBlocked = () => false,
  onBeforeOpen = null,
  cooking = null,
  inventory = null,
  skills = null,
  onCooked = null,
  onPractice = null
} = {}) {
  if (!container) {
    return { open: () => false, close: () => {}, isOpen: () => false, render: () => {} };
  }
  ensureStyles();

  let opened = false;

  const overlay = document.createElement('div');
  overlay.className = 'cooking-overlay';
  overlay.id = 'cooking-menu';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-label', 'Kitchen Stove Recipes');

  const panel = document.createElement('div');
  panel.className = 'cooking-panel';

  const header = document.createElement('div');
  header.className = 'cooking-header';
  const titleWrap = document.createElement('div');
  titleWrap.className = 'cooking-title-wrap';
  const title = document.createElement('h2');
  title.textContent = 'Kitchen Stove';
  const levelBadge = document.createElement('span');
  levelBadge.className = 'cooking-level';
  titleWrap.append(title, levelBadge);

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'cooking-close';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.textContent = '\u00d7';
  header.append(titleWrap, closeBtn);

  const list = document.createElement('div');
  list.className = 'cooking-list';

  const footer = document.createElement('div');
  footer.className = 'cooking-footer';
  const tip = document.createElement('p');
  tip.className = 'cooking-tip';
  tip.textContent = 'Tip: Grow tomatoes, herbs & pumpkins in your backyard beds, or catch fish at Maple Lane Park!';
  const practiceBtn = document.createElement('button');
  practiceBtn.type = 'button';
  practiceBtn.className = 'cooking-btn secondary';
  practiceBtn.textContent = 'Practice Cooking (+XP)';
  footer.append(tip, practiceBtn);

  panel.append(header, list, footer);
  overlay.appendChild(panel);
  container.appendChild(overlay);

  function render() {
    const cookSkill = skills?.get?.('cooking');
    const lvl = cookSkill ? cookSkill.level : 1;
    levelBadge.textContent = `Cooking Lv. ${lvl}`;

    list.replaceChildren();
    for (let i = 0; i < RECIPES.length; i++) {
      const recipe = RECIPES[i];
      const ready = canCookRecipe(recipe, inventory);

      const card = document.createElement('div');
      card.className = 'cooking-card' + (ready ? ' is-ready' : '');

      const main = document.createElement('div');
      main.className = 'cooking-card-main';

      const icon = document.createElement('div');
      icon.className = 'cooking-icon';
      icon.textContent = recipe.icon;

      const info = document.createElement('div');
      info.className = 'cooking-info';
      const name = document.createElement('h3');
      name.className = 'cooking-name';
      name.textContent = recipe.name;
      const buff = document.createElement('div');
      buff.className = 'cooking-buff';
      buff.textContent = `${recipe.buffText} · ${recipe.cookMinutes}m · +${recipe.xp} XP`;

      const ings = document.createElement('div');
      ings.className = 'cooking-ings';
      for (let j = 0; j < recipe.ingredients.length; j++) {
        const req = recipe.ingredients[j];
        const have = countIngredient(inventory, req);
        const need = req.count || 1;
        const pill = document.createElement('span');
        pill.className = 'cooking-ing ' + (have >= need ? 'is-have' : 'is-missing');
        pill.textContent = `${ingredientIcon(req)} ${ingredientLabel(req)} ${have}/${need}`;
        ings.appendChild(pill);
      }

      info.append(name, buff, ings);
      main.append(icon, info);

      const actions = document.createElement('div');
      actions.className = 'cooking-actions';

      const cookBtn = document.createElement('button');
      cookBtn.type = 'button';
      cookBtn.className = 'cooking-btn';
      cookBtn.textContent = 'Cook';
      cookBtn.disabled = !ready;
      cookBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const res = cooking?.cookRecipe?.(recipe.id, { eatNow: false });
        if (res && res.ok) {
          onCooked?.(res);
          render();
        }
      });

      const eatBtn = document.createElement('button');
      eatBtn.type = 'button';
      eatBtn.className = 'cooking-btn secondary';
      eatBtn.textContent = 'Cook & Eat';
      eatBtn.disabled = !ready;
      eatBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const res = cooking?.cookRecipe?.(recipe.id, { eatNow: true });
        if (res && res.ok) {
          onCooked?.(res);
          render();
        }
      });

      actions.append(cookBtn, eatBtn);
      card.append(main, actions);
      list.appendChild(card);
    }
  }

  function open() {
    if (opened || !isStarted() || isBlocked()) return false;
    onBeforeOpen?.();
    opened = true;
    render();
    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');
    exitPointerLock();
    return true;
  }

  function close() {
    if (!opened) return;
    opened = false;
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    if (!isMobile && isStarted() && !isBlocked()) {
      requestPointerLock(canvas);
    }
  }

  practiceBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const ok = onPractice?.();
    if (ok) render();
  });

  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    close();
  });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  panel.addEventListener('click', (e) => e.stopPropagation());

  document.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && opened) {
      e.preventDefault();
      close();
    }
  });

  return {
    open,
    close,
    isOpen: () => opened,
    render,
    element: overlay
  };
}
