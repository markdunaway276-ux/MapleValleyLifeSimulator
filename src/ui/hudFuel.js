/**
 * Gas gauge: one row under the Hunger / Energy bars, in the same style,
 * shown only while you drive. Turns red when the tank is low.
 */
export function createHudFuel({ getFuel = () => null } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'hud-need';
  wrap.dataset.need = 'fuel';
  wrap.setAttribute('aria-label', 'Gas');
  const label = document.createElement('span');
  label.className = 'hud-need-label';
  label.textContent = 'Gas';
  const track = document.createElement('div');
  track.className = 'hud-need-track';
  const fill = document.createElement('div');
  fill.className = 'hud-need-fill';
  fill.style.background = '#e0a63a';
  track.appendChild(fill);
  const value = document.createElement('span');
  value.className = 'hud-need-value';
  wrap.append(label, track, value);
  wrap.style.display = 'none';

  let mounted = false;
  let shown = null;
  function mount() {
    if (mounted) return;
    const host = document.getElementById('hud-needs');
    if (!host) return;
    host.appendChild(wrap);
    mounted = true;
  }

  function update() {
    const tank = getFuel();
    if (!tank) return;
    const litres = Math.ceil(tank.get());
    const key = litres + (tank.isLow() ? 'L' : '');
    if (key === shown) return;
    shown = key;
    fill.style.width = (tank.fraction() * 100).toFixed(1) + '%';
    fill.style.background = tank.isLow() ? '#e05a4a' : '#e0a63a';
    value.textContent = litres + ' L';
    wrap.classList.toggle('is-low', tank.isLow());
  }

  function setVisible(v) {
    mount();
    wrap.style.display = v ? '' : 'none';
    if (v) update();
  }

  return { setVisible, update };
}
