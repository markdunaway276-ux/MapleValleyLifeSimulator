// Run from the repo root with: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPlayerMode, ACTIVITY } from '../src/core/mode.js';

function fakeWorld() {
  const st = { started: true, sleeping: false, working: false, driving: false, seated: false,
    inventory: false, phone: false, dialogue: false, debug: false, log: [] };
  const menu = (k) => ({ isOpen: () => st[k], close: () => { st[k] = false; st.log.push('close ' + k); } });
  const mode = createPlayerMode({ isStarted: () => st.started });
  mode.attach({
    sleeper: { isSleeping: () => st.sleeping },
    worker: { isWorking: () => st.working },
    car: { isDriving: () => st.driving, exit: () => { st.driving = false; st.log.push('exit car'); } },
    sitter: { isSeated: () => st.seated, stand: () => { st.seated = false; st.log.push('stand'); } },
    inventory: menu('inventory'), phone: menu('phone'), dialogue: menu('dialogue'),
    debug: { isModalOpen: () => st.debug }
  });
  return { st, mode };
}

test('activity follows the priority title > sleeping > working > driving > sitting > walking', () => {
  const { st, mode } = fakeWorld();
  assert.equal(mode.activity(), ACTIVITY.WALKING);
  st.seated = true; assert.equal(mode.activity(), ACTIVITY.SITTING);
  st.driving = true; assert.equal(mode.activity(), ACTIVITY.DRIVING);
  st.working = true; assert.equal(mode.activity(), ACTIVITY.WORKING);
  st.sleeping = true; assert.equal(mode.activity(), ACTIVITY.SLEEPING);
  st.started = false; assert.equal(mode.activity(), ACTIVITY.TITLE);
});

test('busy, canAct, uiBlocked and hudVisible match the old hand-written checks', () => {
  const { st, mode } = fakeWorld();
  const old = {
    canAct: () => st.started && !st.sleeping && !st.working,
    uiBlocked: () => st.inventory || st.debug || st.sleeping || st.working || st.phone || st.dialogue,
    phoneBlocked: () => st.inventory || st.debug || st.sleeping || st.working || st.dialogue,
    phoneCanOpen: () => st.started && !st.sleeping && !st.working && !st.dialogue,
    dialogueBlocked: () => st.inventory || st.debug || st.sleeping || st.working || st.phone,
    hud: () => st.started && !(st.inventory || st.debug || st.sleeping || st.working || st.phone || st.dialogue)
  };
  const keys = ['started', 'sleeping', 'working', 'inventory', 'phone', 'dialogue', 'debug'];
  for (let bits = 0; bits < 1 << keys.length; bits++) {
    keys.forEach((k, i) => { st[k] = !!(bits & (1 << i)); });
    const tag = JSON.stringify(Object.fromEntries(keys.map((k) => [k, st[k]])));
    assert.equal(mode.canAct(), old.canAct(), 'canAct ' + tag);
    assert.equal(mode.uiBlocked(), old.uiBlocked(), 'uiBlocked ' + tag);
    assert.equal(mode.busy() || mode.menuOpen({ except: 'phone' }), old.phoneBlocked(), 'phone blocked ' + tag);
    assert.equal(mode.canAct() && !mode.menu('dialogue'), old.phoneCanOpen(), 'phone canOpen ' + tag);
    assert.equal(mode.busy() || mode.menuOpen({ except: 'dialogue' }), old.dialogueBlocked(), 'dialogue blocked ' + tag);
    assert.equal(mode.hudVisible(), old.hud(), 'hud ' + tag);
  }
});

test('clearForBusy closes the bag, phone and dialogue, leaves the car and stands up, but not the Debug menu', () => {
  const { st, mode } = fakeWorld();
  Object.assign(st, { inventory: true, phone: true, dialogue: true, debug: true, driving: true, seated: false });
  mode.clearForBusy();
  assert.deepEqual(st.log, ['close inventory', 'close phone', 'close dialogue', 'exit car']);
  assert.equal(st.debug, true);
  st.log.length = 0; st.seated = true;
  mode.clearForBusy();
  assert.deepEqual(st.log, ['stand']);
});

test('describe() names the activity and any open menus', () => {
  const { st, mode } = fakeWorld();
  assert.equal(mode.describe(), 'walking');
  st.driving = true; st.phone = true;
  assert.equal(mode.describe(), 'driving · phone open');
  st.debug = true;
  assert.equal(mode.describe(), 'driving · phone, debug open');
  assert.equal(mode.describe({ except: 'debug' }), 'driving · phone open');
});

test('systems not attached yet count as "not doing that"', () => {
  const mode = createPlayerMode({ isStarted: () => true });
  assert.equal(mode.activity(), ACTIVITY.WALKING);
  assert.equal(mode.uiBlocked(), false);
  assert.doesNotThrow(() => mode.clearForBusy());
  assert.throws(() => mode.attach({ spaceship: {} }), /unknown system/);
});
