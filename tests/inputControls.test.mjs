// Run from the repo root with: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupInput } from '../src/core/input.js';
import { requestPointerLock, exitPointerLock } from '../src/core/pointerLock.js';
import { DESKTOP_KEYS } from '../src/ui/menuKit.js';

function createFakeDom() {
  const win = new EventTarget();
  const doc = new EventTarget();
  doc.pointerLockElement = null;
  doc.body = { classList: { add() {}, remove() {}, toggle() {} } };
  const prevWin = globalThis.window;
  const prevDoc = globalThis.document;
  globalThis.window = win;
  globalThis.document = doc;
  return {
    win,
    doc,
    restore() {
      if (prevWin === undefined) delete globalThis.window;
      else globalThis.window = prevWin;
      if (prevDoc === undefined) delete globalThis.document;
      else globalThis.document = prevDoc;
    }
  };
}

function makePlayer() {
  return {
    keys: { forward: false, back: false, left: false, right: false, jump: false, down: false, run: false },
    mouseX: 0,
    mouseY: 0,
    joystickX: 0,
    joystickY: 0
  };
}

function dispatch(target, type, props = {}) {
  const ev = new Event(type);
  Object.assign(ev, props);
  target.dispatchEvent(ev);
  return ev;
}

test('desktop mousemove accumulates deltas while pointer-locked and ignores unlocked movement', () => {
  const dom = createFakeDom();
  try {
    const player = makePlayer();
    setupInput(player, false, { isInventoryOpen: () => false });

    // Not pointer-locked: movement is ignored.
    dispatch(dom.doc, 'mousemove', { movementX: 10, movementY: -4 });
    assert.equal(player.mouseX, 0);
    assert.equal(player.mouseY, 0);

    // Pointer-locked: multiple events in the same frame accumulate (+=).
    dom.doc.pointerLockElement = {};
    dispatch(dom.doc, 'mousemove', { movementX: 12, movementY: -5 });
    dispatch(dom.doc, 'mousemove', { movementX: 8, movementY: 3 });
    assert.equal(player.mouseX, 20);
    assert.equal(player.mouseY, -2);
  } finally {
    dom.restore();
  }
});

test('blocked input ignores movement keys, interact, and mousemove', () => {
  const dom = createFakeDom();
  try {
    const player = makePlayer();
    let isBlocked = true;
    let interacts = 0;
    dom.win.addEventListener('interact', () => { interacts += 1; });
    setupInput(player, false, { isInventoryOpen: () => isBlocked });

    dom.doc.pointerLockElement = {};
    dispatch(dom.doc, 'keydown', { code: 'KeyW' });
    dispatch(dom.doc, 'keydown', { code: 'KeyE', repeat: false });
    dispatch(dom.doc, 'mousemove', { movementX: 15, movementY: 7 });
    assert.equal(player.keys.forward, false);
    assert.equal(interacts, 0);
    assert.equal(player.mouseX, 0);
    assert.equal(player.mouseY, 0);

    // Unblocked: keys, interact, and mousemove take effect.
    isBlocked = false;
    dispatch(dom.doc, 'keydown', { code: 'KeyW' });
    dispatch(dom.doc, 'keydown', { code: 'KeyE', repeat: false });
    dispatch(dom.doc, 'keydown', { code: 'KeyE', repeat: true });
    dispatch(dom.doc, 'mousemove', { movementX: 4, movementY: 6 });
    assert.equal(player.keys.forward, true);
    assert.equal(interacts, 1);
    assert.equal(player.mouseX, 4);
    assert.equal(player.mouseY, 6);
  } finally {
    dom.restore();
  }
});

test('clearMotion resets held keys, mouse deltas, and joystick on dialogue-open, work-start, blur, and menu events', () => {
  const dom = createFakeDom();
  try {
    const player = makePlayer();
    setupInput(player, false, { isInventoryOpen: () => false });

    const events = ['dialogue-open', 'work-start', 'blur', 'inventory-open', 'pause-open', 'phone-open', 'sleep-start', 'debug-modal-open'];
    for (const evName of events) {
      player.keys.forward = true;
      player.keys.left = true;
      player.keys.jump = true;
      player.keys.down = true;
      player.mouseX = 14;
      player.mouseY = -9;
      player.joystickX = 0.7;
      player.joystickY = -0.5;

      dom.win.dispatchEvent(new Event(evName));

      assert.deepEqual(player.keys, { forward: false, back: false, left: false, right: false, jump: false, down: false, run: false }, evName + ' keys');
      assert.equal(player.mouseX, 0, evName + ' mouseX');
      assert.equal(player.mouseY, 0, evName + ' mouseY');
      assert.equal(player.joystickX, 0, evName + ' joystickX');
      assert.equal(player.joystickY, 0, evName + ' joystickY');
    }
  } finally {
    dom.restore();
  }
});

test('requestPointerLock safely handles missing targets, synchronous throws, and rejected Promises', async () => {
  assert.equal(requestPointerLock(null), false);
  assert.equal(requestPointerLock({}), false);

  let called = 0;
  assert.equal(requestPointerLock({ requestPointerLock() { called += 1; } }), true);
  assert.equal(called, 1);

  assert.equal(requestPointerLock({
    requestPointerLock() { throw new Error('SecurityError'); }
  }), false);

  // Rejected Promise must be caught internally without an unhandled rejection.
  assert.equal(requestPointerLock({
    requestPointerLock() { return Promise.reject(new Error('WrongDocumentError')); }
  }), true);
  await new Promise((r) => setTimeout(r, 0));
});

test('exitPointerLock safely checks lock state and catches throws', async () => {
  assert.equal(exitPointerLock(null), false);
  assert.equal(exitPointerLock({}), false);

  let exits = 0;
  assert.equal(exitPointerLock({ pointerLockElement: null, exitPointerLock() { exits += 1; } }), false);
  assert.equal(exits, 0);

  assert.equal(exitPointerLock({ pointerLockElement: {}, exitPointerLock() { exits += 1; } }), true);
  assert.equal(exits, 1);

  assert.equal(exitPointerLock({
    pointerLockElement: {},
    exitPointerLock() { throw new Error('failed'); }
  }), false);

  assert.equal(exitPointerLock({
    pointerLockElement: {},
    exitPointerLock() { return Promise.reject(new Error('rejected')); }
  }), true);
  await new Promise((r) => setTimeout(r, 0));
});

test('DESKTOP_KEYS lists Esc (Pause), P (Phone), I (Inventory / Bag), and V (Third-person view) without conflict', () => {
  const byKey = new Map(DESKTOP_KEYS);
  assert.equal(byKey.get('Esc'), 'Pause');
  assert.equal(byKey.get('P'), 'Phone');
  assert.equal(byKey.get('I'), 'Inventory / Bag');
  assert.equal(byKey.get('V'), 'Third-person view');
  assert.equal(byKey.has('Esc or P'), false);
});
