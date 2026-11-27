/**
 * Top quick-action bar for the Debug menu: Development mode toggle,
 * Screenshot button, Teleport preset picker, and quick time-of-day skips.
 */
export function buildQuickBar({ actions, getTeleports, getClock, rows, close, toggleDevelopment, refresh, refreshTime }) {
  const bar = document.createElement('div');
  bar.className = 'dm-quick';

  const devBtn = document.createElement('button');
  devBtn.type = 'button';
  devBtn.className = 'dm-chip dm-chip-dev';
  devBtn.dataset.item = 'development-quick';
  devBtn.addEventListener('click', () => { toggleDevelopment(); refresh(); });

  const shotBtn = document.createElement('button');
  shotBtn.type = 'button';
  shotBtn.className = 'dm-chip';
  shotBtn.textContent = 'Screenshot';
  shotBtn.addEventListener('click', () => { close(); actions.screenshot(); });

  const top = document.createElement('div');
  top.className = 'dm-quick-row';
  top.append(devBtn, shotBtn);

  // Teleport: one dropdown instead of a column of buttons.
  const tpRow = document.createElement('div');
  tpRow.className = 'dm-quick-row';
  const select = document.createElement('select');
  select.className = 'dm-select';
  select.setAttribute('aria-label', 'Teleport to');
  for (const p of getTeleports() || []) {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.label;
    select.appendChild(opt);
    rows[p.id] = { row: opt, label: opt, item: p };
  }
  select.addEventListener('pointerdown', (e) => e.stopPropagation());
  const goBtn = document.createElement('button');
  goBtn.type = 'button';
  goBtn.className = 'dm-chip';
  goBtn.textContent = 'Teleport';
  goBtn.dataset.item = 'teleport-go';
  goBtn.addEventListener('click', () => {
    close();
    if (typeof actions.teleportTo === 'function') actions.teleportTo(select.value);
    else if (select.value === 'street-start' && actions.teleport) actions.teleport();
  });
  tpRow.append(select, goBtn);
  bar.append(top, tpRow);

  // Skip to a time of day.
  if (typeof getClock === 'function') {
    const timeRow = document.createElement('div');
    timeRow.className = 'dm-quick-row';
    for (const [label, minutes] of [['6 AM', 360], ['Noon', 720], ['6 PM', 1080], ['Midnight', 0]]) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'dm-chip dm-chip-small';
      b.textContent = label;
      b.addEventListener('click', () => {
        const clock = getClock();
        if (clock) clock.setTime(minutes);
        refreshTime();
      });
      timeRow.appendChild(b);
    }
    bar.appendChild(timeRow);
  }

  return { bar, devBtn, select };
}
