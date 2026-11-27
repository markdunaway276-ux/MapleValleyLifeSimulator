// Run from the repo root with: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPlayerMode, ACTIVITY } from '../src/core/mode.js';

function fakeWorld() {
  const st = { started: true, sleeping: false, working: false, driving: false, seated: false,
    inventory: false, phone: false, dialogue: false, debug: false, pause: false, log: [] };
  const menu = (k) => ({ isOpen: () => st[k], close: () => { st[k] = false; st.log.push('close ' + k); } });
  const mode = createPlayerMode({ isStarted: () => st.started });
  mode.attach({
    sleeper: { isSleeping: () => st.sleeping },
    worker: { isWorking: () => st.working },
    car: { isDriving: () => st.driving, exit: () => { st.driving = false; st.log.push('exit car'); } },
    sitter: { isSeated: () => st.seated, stand: () => { st.seated = false; st.log.push('stand'); } },
    inventory: menu('inventory'), phone: menu('phone'), dialogue: menu('dialogue'), pause: menu('pause'),
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

test('busy, canAct, uiBlocked and hudVisible match the expected rules including title screen and pause', () => {
  const { st, mode } = fakeWorld();
  const expected = {
    canAct: () => st.started && !st.sleeping && !st.working,
    uiBlocked: () => !st.started || st.inventory || st.debug || st.pause || st.sleeping || st.working || st.phone || st.dialogue,
    inventoryBlocked: () => st.debug || st.pause || st.sleeping || st.working || st.phone || st.dialogue,
    phoneBlocked: () => st.inventory || st.debug || st.pause || st.sleeping || st.working || st.dialogue,
    phoneCanOpen: () => st.started && !st.sleeping && !st.working && !st.dialogue && !st.pause && !st.debug,
    dialogueBlocked: () => st.inventory || st.debug || st.pause || st.sleeping || st.working || st.phone,
    hud: () => st.started && !(st.inventory || st.debug || st.pause || st.sleeping || st.working || st.phone || st.dialogue)
  };
  const keys = ['started', 'sleeping', 'working', 'inventory', 'phone', 'dialogue', 'debug', 'pause'];
  for (let bits = 0; bits < 1 << keys.length; bits++) {
    keys.forEach((k, i) => { st[k] = !!(bits & (1 << i)); });
    const tag = JSON.stringify(Object.fromEntries(keys.map((k) => [k, st[k]])));
    assert.equal(mode.canAct(), expected.canAct(), 'canAct ' + tag);
    assert.equal(mode.uiBlocked(), expected.uiBlocked(), 'uiBlocked ' + tag);
    assert.equal(mode.busy() || mode.menuOpen({ except: 'inventory' }), expected.inventoryBlocked(), 'inventory blocked ' + tag);
    assert.equal(mode.busy() || mode.menuOpen({ except: 'phone' }), expected.phoneBlocked(), 'phone blocked ' + tag);
    assert.equal(mode.canAct() && !mode.menu('dialogue') && !mode.menu('pause') && !mode.menu('debug'), expected.phoneCanOpen(), 'phone canOpen ' + tag);
    assert.equal(mode.busy() || mode.menuOpen({ except: 'dialogue' }), expected.dialogueBlocked(), 'dialogue blocked ' + tag);
    assert.equal(mode.hudVisible(), expected.hud(), 'hud ' + tag);
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
  st.pause = true;
  assert.equal(mode.describe({ except: 'debug' }), 'driving · phone, pause open');
});

test('systems not attached yet count as "not doing that"', () => {
  const mode = createPlayerMode({ isStarted: () => true });
  assert.equal(mode.activity(), ACTIVITY.WALKING);
  assert.equal(mode.uiBlocked(), false);
  assert.doesNotThrow(() => mode.clearForBusy());
  assert.throws(() => mode.attach({ spaceship: {} }), /unknown system/);

  const unstarted = createPlayerMode({ isStarted: () => false });
  assert.equal(unstarted.activity(), ACTIVITY.TITLE);
  assert.equal(unstarted.uiBlocked(), true);
  assert.equal(unstarted.hudVisible(), false);
});
