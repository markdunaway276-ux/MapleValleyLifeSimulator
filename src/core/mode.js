/**
 * One place that answers "what is the player doing right now?".
 *
 * Activity (exactly one at a time):
 *   'title'     before Start is pressed
 *   'sleeping'  the sleep fade is running
 *   'working'   the desk "Working…" bar is running
 *   'driving'   in the car
 *   'sitting'   on a seat
 *   'walking'   on foot (the default)
 *
 * Menus (any number, on top of the activity): 'inventory', 'phone',
 * 'dialogue', 'debug' (the Debug menu or the F9 markup dialog), 'pause'
 * (the pause menu: the frame loop freezes the world while it is open). The bag,
 * phone and Debug menu can be open while driving or sitting.
 *
 * Systems are attached after they are created (main.js builds them in an
 * order where some need the mode before others exist), so every check
 * treats a missing system as "not doing that".
 *
 * New features should ask the mode instead of combining isSleeping() /
 * isWorking() / isOpen() checks by hand. A new busy activity (a cutscene,
 * a minigame) gets added to ACTIVITY and to busy() here, once.
 */
export const ACTIVITY = Object.freeze({
  TITLE: 'title',
  SLEEPING: 'sleeping',
  WORKING: 'working',
  DRIVING: 'driving',
  SITTING: 'sitting',
  WALKING: 'walking'
});

export const MENUS = Object.freeze(['inventory', 'phone', 'dialogue', 'cooking', 'debug', 'pause']);

export function createPlayerMode({ isStarted = () => true } = {}) {
  const parts = {
    sleeper: null,
    worker: null,
    car: null,
    sitter: null,
    inventory: null,
    phone: null,
    dialogue: null,
    cooking: null,
    debug: null,
    pause: null
  };

  function attach(systems) {
    for (const key of Object.keys(systems || {})) {
      if (!(key in parts)) throw new Error('mode.attach: unknown system ' + key);
      parts[key] = systems[key] || null;
    }
  }

  function ask(key, method) {
    const s = parts[key];
    return !!(s && typeof s[method] === 'function' && s[method]());
  }

  const started = () => !!isStarted();
  const sleeping = () => ask('sleeper', 'isSleeping');
  const working = () => ask('worker', 'isWorking');
  const driving = () => ask('car', 'isDriving');
  const sitting = () => ask('sitter', 'isSeated');

  /** Sleeping or working: the clock and needs pause, input and saving wait. */
  const busy = () => sleeping() || working();

  /** Is this one menu open? */
  function menu(name) {
    if (name === 'debug') return ask('debug', 'isModalOpen');
    return ask(name, 'isOpen');
  }

  /** Is any menu open? `except` leaves one out (a menu asking about the others). */
  function menuOpen({ except = null } = {}) {
    for (let i = 0; i < MENUS.length; i++) {
      if (MENUS[i] !== except && menu(MENUS[i])) return true;
    }
    return false;
  }

  /** Movement, look and the interact prompt are paused. */
  const uiBlocked = () => !started() || busy() || menuOpen();

  /** Started and not sleeping or working: free to drive, sit, open the phone, talk. */
  const canAct = () => started() && !busy();

  /** HUD (clock, needs, cash, minimap, buttons) is shown. */
  const hudVisible = () => started() && !uiBlocked();

  function activity() {
    if (!started()) return ACTIVITY.TITLE;
    if (sleeping()) return ACTIVITY.SLEEPING;
    if (working()) return ACTIVITY.WORKING;
    if (driving()) return ACTIVITY.DRIVING;
    if (sitting()) return ACTIVITY.SITTING;
    return ACTIVITY.WALKING;
  }

  /** Open menus by name, e.g. ['phone']. */
  function openMenus() {
    return MENUS.filter((m) => menu(m));
  }

  /**
   * Before a busy activity (sleep, work) takes over: close the bag, phone and
   * dialogue, get out of the car and stand up. The Debug menu is left alone.
   */
  function clearForBusy() {
    if (menu('inventory')) parts.inventory.close();
    if (menu('phone')) parts.phone.close();
    if (menu('dialogue')) parts.dialogue.close();
    if (menu('cooking')) parts.cooking.close();
    if (driving()) parts.car.exit();
    if (sitting()) parts.sitter.stand();
  }

  /**
   * A short line for feedback notes and the debug overlay, e.g. "driving · phone open".
   * `except` leaves one menu out (F9 notes skip 'debug', which is the F9 window itself).
   */
  function describe({ except = null } = {}) {
    const m = openMenus().filter((name) => name !== except);
    return activity() + (m.length ? ' · ' + m.join(', ') + ' open' : '');
  }

  return {
    attach,
    activity,
    started,
    sleeping,
    working,
    driving,
    sitting,
    busy,
    menu,
    menuOpen,
    openMenus,
    uiBlocked,
    canAct,
    hudVisible,
    clearForBusy,
    describe
  };
}
