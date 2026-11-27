import { makeSection } from './style.js';

/**
 * Debug menu — Player tab: Development tools (mode, fly, fast machines, car tank),
 * Needs refill/drain, Money +$100/reset, and Skills XP boosts.
 */
export function buildPlayerTab(pane, { getDev, getNeeds, getMoney, getSkills, toggleDevelopment, refresh, quickEls }) {
  let devEls = null;
  let needsEls = null;
  let moneyEls = null;
  let skillsEls = null;

  function refreshDev() {
    const dev = getDev && getDev();
    const needs = getNeeds && getNeeds();
    const on = dev ? dev.isOn() : !!(needs && needs.isDevelopmentMode && needs.isDevelopmentMode());
    if (quickEls && quickEls.devBtn) {
      quickEls.devBtn.textContent = 'Development mode: ' + (on ? 'On' : 'Off');
      quickEls.devBtn.setAttribute('aria-pressed', String(on));
    }
    if (devEls) for (const s of devEls.switches) s.row.setAttribute('aria-checked', s.get() ? 'true' : 'false');
  }

  function refreshNeeds() {
    if (!needsEls || typeof getNeeds !== 'function') return;
    const needs = getNeeds();
    if (!needs || typeof needs.get !== 'function') return;
    const development = !!needs.isDevelopmentMode?.();
    needsEls.developmentBtn.hidden = true; // now in the quick bar and Player → Development
    needsEls.developmentBtn.textContent = 'Development mode: ' + (development ? 'On' : 'Off');
    needsEls.developmentBtn.setAttribute('aria-pressed', String(development));
    needsEls.refillBtn.disabled = needsEls.drainBtn.disabled = development;
    const snap = needs.get();
    const parts = (snap.items || []).map((it) => it.name + ' ' + Math.round(it.value));
    needsEls.label.textContent = parts.length ? parts.join('  ·  ') : 'Needs';
  }

  function refreshMoney() {
    if (!moneyEls || typeof getMoney !== 'function') return;
    const money = getMoney();
    if (!money || typeof money.get !== 'function') return;
    const n = money.get();
    const shown = Number.isInteger(n) ? String(n) : Number(n).toFixed(2);
    moneyEls.label.textContent = 'Cash $' + shown;
  }

  function refreshSkills() {
    if (!skillsEls || typeof getSkills !== 'function') return;
    const skills = getSkills();
    if (!skills || typeof skills.get !== 'function') return;
    const snap = skills.get();
    const parts = (snap.items || []).map((it) => it.name + ' Lv.' + it.level);
    skillsEls.label.textContent = parts.length ? parts.join('  ·  ') : 'Skills';
  }

  // Development extras: fly, fast laundry machines, fill the car's tank.
  {
    const { section, body: list } = makeSection('development', 'Development', 'dm-sublist');
    const help = document.createElement('div');
    help.className = 'dm-help';
    help.textContent = 'Fly and fast machines also turn on development mode; turning development mode off turns them off.';
    list.appendChild(help);
    const dev = () => (getDev && getDev()) || null;
    const makeSwitch = (id, label, sub, get, set) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'dm-subrow';
      row.dataset.item = id;
      row.setAttribute('role', 'switch');
      const text = document.createElement('span');
      text.className = 'dm-label';
      text.textContent = label;
      const key = document.createElement('span');
      key.className = 'dm-key';
      key.textContent = sub;
      text.appendChild(key);
      const sw = document.createElement('span');
      sw.className = 'dm-switch';
      row.append(text, sw);
      row.addEventListener('click', () => { set(!get()); refresh(); });
      list.appendChild(row);
      return { row, get };
    };
    const switches = [
      makeSwitch('dev-mode', 'Development mode', 'Needs stay full · reach up to 12 m (not through walls)',
        () => (dev() ? dev().isOn() : !!getNeeds?.()?.isDevelopmentMode?.()), () => toggleDevelopment()),
      makeSwitch('dev-fly', 'Fly', 'Move where you look · Space up · C down · passes through walls',
        () => !!dev()?.isFly(), (v) => dev()?.setFly(v)),
      makeSwitch('dev-fast', 'Fast laundry machines', 'Washers and dryers finish in a minute · new bags every 5 min',
        () => !!dev()?.isFast(), (v) => dev()?.setFast(v))
    ];
    const fuelRow = document.createElement('button');
    fuelRow.type = 'button';
    fuelRow.className = 'dm-subrow';
    fuelRow.dataset.item = 'dev-fuel';
    const fuelText = document.createElement('span');
    fuelText.className = 'dm-label';
    fuelText.textContent = 'Fill car tank';
    const fuelKey = document.createElement('span');
    fuelKey.className = 'dm-key';
    fuelKey.textContent = 'Fills the gas tank · press again on a full tank to empty it';
    fuelText.appendChild(fuelKey);
    fuelRow.appendChild(fuelText);
    fuelRow.addEventListener('click', () => dev()?.fillTank?.());
    list.appendChild(fuelRow);
    devEls = { switches };
    pane.appendChild(section);
  }

  if (typeof getNeeds === 'function') {
    const { section, body } = makeSection('needs', 'Needs', 'dm-sublist dm-needs');
    const label = document.createElement('div');
    label.className = 'dm-needs-label';
    const row = document.createElement('div');
    row.className = 'dm-needs-row';
    const refillBtn = document.createElement('button');
    refillBtn.type = 'button';
    refillBtn.dataset.needsAction = 'refill';
    refillBtn.textContent = 'Refill';
    refillBtn.addEventListener('click', () => {
      const needs = getNeeds && getNeeds();
      if (needs && typeof needs.refill === 'function') needs.refill();
      refreshNeeds();
    });
    const drainBtn = document.createElement('button');
    drainBtn.type = 'button';
    drainBtn.dataset.needsAction = 'drain';
    drainBtn.textContent = 'Drain';
    drainBtn.addEventListener('click', () => {
      const needs = getNeeds && getNeeds();
      if (needs && typeof needs.drain === 'function') needs.drain();
      refreshNeeds();
    });
    const developmentBtn = document.createElement('button');
    developmentBtn.type = 'button';
    developmentBtn.addEventListener('click', () => {
      const needs = getNeeds();
      needs.setDevelopmentMode(!needs.isDevelopmentMode());
      refreshNeeds();
    });
    const help = document.createElement('p');
    help.hidden = true;
    row.append(developmentBtn, refillBtn, drainBtn);
    body.append(help, label, row);
    needsEls = { section, label, refillBtn, drainBtn, developmentBtn };
    refreshNeeds();
    pane.appendChild(section);
  }

  if (typeof getMoney === 'function') {
    const { section, body } = makeSection('money', 'Money', 'dm-sublist dm-money');
    const label = document.createElement('div');
    label.className = 'dm-money-label';
    const row = document.createElement('div');
    row.className = 'dm-money-row';
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.dataset.moneyAction = 'add';
    addBtn.textContent = '+$100';
    addBtn.addEventListener('click', () => {
      const money = getMoney && getMoney();
      if (money && typeof money.add === 'function') money.add(100, { category: 'Adjustment', label: 'Debug cash added' });
      refreshMoney();
    });
    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.dataset.moneyAction = 'reset';
    resetBtn.textContent = 'Reset cash';
    resetBtn.addEventListener('click', () => {
      const money = getMoney && getMoney();
      if (money && typeof money.reset === 'function') money.reset();
      else if (money && typeof money.set === 'function') money.set(50);
      refreshMoney();
    });
    row.append(addBtn, resetBtn);
    body.append(label, row);
    moneyEls = { section, label, addBtn, resetBtn };
    refreshMoney();
    pane.appendChild(section);
  }

  if (typeof getSkills === 'function') {
    const { section, body } = makeSection('skills', 'Skills', 'dm-sublist dm-money dm-skills');
    const label = document.createElement('div');
    label.className = 'dm-money-label';
    const row = document.createElement('div');
    row.className = 'dm-money-row';
    const fitBtn = document.createElement('button');
    fitBtn.type = 'button';
    fitBtn.dataset.skillsAction = 'fitness';
    fitBtn.textContent = '+50 Fitness';
    fitBtn.addEventListener('click', () => {
      const skills = getSkills && getSkills();
      const amount = (skills && skills.DEBUG_XP) || 50;
      if (skills && typeof skills.addXp === 'function') skills.addXp('fitness', amount);
      refreshSkills();
    });
    const cookBtn = document.createElement('button');
    cookBtn.type = 'button';
    cookBtn.dataset.skillsAction = 'cooking';
    cookBtn.textContent = '+50 Cooking';
    cookBtn.addEventListener('click', () => {
      const skills = getSkills && getSkills();
      const amount = (skills && skills.DEBUG_XP) || 50;
      if (skills && typeof skills.addXp === 'function') skills.addXp('cooking', amount);
      refreshSkills();
    });
    row.append(fitBtn, cookBtn);
    body.append(label, row);
    skillsEls = { section, label, fitBtn, cookBtn };
    refreshSkills();
    pane.appendChild(section);
  }

  return { refreshDev, refreshNeeds, refreshMoney, refreshSkills };
}
