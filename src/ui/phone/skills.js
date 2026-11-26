/**
 * Skills phone app: lists each skill's level and a progress bar toward the next.
 */
const STYLE_ID = 'phone-skills-styles';

const CSS = `
.phone-skills-title { margin: 8px 0 10px; }
.phone-skill {
  margin: 0 0 12px;
  padding: 10px 10px 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.06);
}
.phone-skill-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin: 0 0 8px;
}
.phone-skill-name {
  margin: 0;
  font: 650 15px/1.2 system-ui, sans-serif;
  color: #fff;
}
.phone-skill-level {
  margin: 0;
  font: 650 12px/1.2 system-ui, sans-serif;
  color: rgba(255, 255, 255, 0.75);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.phone-skill-track {
  height: 10px;
  border-radius: 5px;
  background: rgba(255, 255, 255, 0.16);
  overflow: hidden;
}
.phone-skill-fill {
  height: 100%;
  width: 0%;
  border-radius: 5px;
  background: #3fbf6a;
}
.phone-skill-xp {
  margin: 6px 0 0;
  font: 600 11px/1.2 system-ui, sans-serif;
  color: rgba(255, 255, 255, 0.62);
  font-variant-numeric: tabular-nums;
}
`;

function ensureStyles() {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

function skillsFromCtx(ctx) {
  if (ctx && typeof ctx.getSkills === 'function') return ctx.getSkills();
  return null;
}

function paintRow(row, skill) {
  if (!row || !skill) return;
  const name = row.querySelector('.phone-skill-name');
  const level = row.querySelector('.phone-skill-level');
  const fill = row.querySelector('.phone-skill-fill');
  const xp = row.querySelector('.phone-skill-xp');
  if (name) name.textContent = (skill.icon ? skill.icon + ' ' : '') + (skill.name || skill.id);
  if (level) level.textContent = skill.xpToNext === 0 ? 'Max' : ('Lv. ' + skill.level);
  if (fill) fill.style.width = Math.round((skill.progress || 0) * 100) + '%';
  if (xp) {
    if (skill.xpToNext === 0) xp.textContent = 'Max level';
    else xp.textContent = Math.floor(skill.xpIntoLevel) + ' / ' + skill.xpToNext + ' XP';
  }
}

export function renderSkillsApp(screen, ctx) {
  ensureStyles();
  const title = document.createElement('h3');
  title.className = 'phone-app-title phone-skills-title';
  title.textContent = 'Skills';
  screen.appendChild(title);

  const rows = new Map();
  const snap = skillsFromCtx(ctx);
  const items = (snap && snap.items) || [];
  for (let i = 0; i < items.length; i++) {
    const skill = items[i];
    const card = document.createElement('div');
    card.className = 'phone-skill';
    card.dataset.skill = skill.id;
    const head = document.createElement('div');
    head.className = 'phone-skill-head';
    const name = document.createElement('p');
    name.className = 'phone-skill-name';
    const level = document.createElement('p');
    level.className = 'phone-skill-level';
    head.append(name, level);
    const track = document.createElement('div');
    track.className = 'phone-skill-track';
    const fill = document.createElement('div');
    fill.className = 'phone-skill-fill';
    track.appendChild(fill);
    const xp = document.createElement('p');
    xp.className = 'phone-skill-xp';
    card.append(head, track, xp);
    paintRow(card, skill);
    screen.appendChild(card);
    rows.set(skill.id, card);
  }

  function paint(state) {
    const next = state || skillsFromCtx(ctx);
    const list = (next && next.items) || [];
    for (let i = 0; i < list.length; i++) {
      const row = rows.get(list[i].id);
      if (row) paintRow(row, list[i]);
    }
  }

  const off = ctx && typeof ctx.onSkillsChange === 'function'
    ? ctx.onSkillsChange(paint)
    : null;
  return () => { if (typeof off === 'function') off(); };
}
