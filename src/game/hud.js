import { createHudClock } from '../ui/hudClock.js';
import { createHudMute } from '../ui/hudMute.js';
import { createHudNeeds } from '../ui/hudNeeds.js';
import { createHudMoney } from '../ui/hudMoney.js';

/**
 * The always-on HUD (clock, mute, Hunger / Energy, cash) and when the HUD
 * pieces show: only when the game has started and no menu, sleep or work is
 * in the way (mode.hudVisible()). The minimap, phone button and save
 * indicator are created elsewhere but shown and hidden here with the rest.
 */
export function createHud(g) {
  const { mode, clock, weather, sfx, needs, money } = g;
  const hudClock = createHudClock();
  const hudMute = createHudMute({
    isMuted: () => sfx.isMuted(),
    onToggle: () => sfx.toggleMuted()
  });
  const hudNeeds = createHudNeeds({ getNeeds: () => needs.get() });
  const hudMoney = createHudMoney({ getMoney: () => money.get() });

  function sync() {
    const show = mode.hudVisible();
    hudClock.setVisible(show);
    if (show) hudClock.update(clock.getTime(), weather.get());
    hudMute.setVisible(show);
    hudMute.refresh();
    hudNeeds.setVisible(show);
    if (show) hudNeeds.update();
    hudMoney.setVisible(show);
    if (show) hudMoney.update();
    g.phone.setVisible(show);
    g.minimap.setHudVisible(show);
    g.hudSave.setVisible(show);
  }

  clock.on('change', (t) => hudClock.update(t, weather.get()));
  weather.onChange((w) => {
    hudClock.update(clock.getTime(), w);
    g.save();
  });
  sfx.on('mute', () => hudMute.refresh());
  needs.onChange(() => hudNeeds.update());
  money.onChange(() => hudMoney.update());

  for (const name of ['inventory', 'debug-modal', 'phone', 'dialogue']) {
    window.addEventListener(name + '-open', sync);
    window.addEventListener(name + '-close', sync);
  }
  // Sleep and work take over: close menus, leave the car / seat, hide the HUD.
  window.addEventListener('sleep-start', () => {
    mode.clearForBusy();
    sync();
  });
  window.addEventListener('sleep-end', sync);
  window.addEventListener('maple-slept', (e) => {
    needs.applySleep(e.detail || {});
  });
  window.addEventListener('work-start', () => {
    mode.clearForBusy();
    sync();
  });
  window.addEventListener('work-end', sync);

  return {
    sync,
    /** Short message on the right ("+$20", "Not enough cash."). */
    toast: (msg) => hudMoney.toast(msg)
  };
}
