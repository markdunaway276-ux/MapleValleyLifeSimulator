// Run from the repo root with: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createStats } from '../src/systems/stats.js';

function readZIndex(relPath, selectorPattern) {
  const src = readFileSync(new URL('../' + relPath, import.meta.url), 'utf8');
  const m = src.match(new RegExp(selectorPattern + '[\\s\\S]{0,220}?z-index:\\s*(\\d+)'));
  assert.ok(m, `Could not find z-index for ${selectorPattern} in ${relPath}`);
  return Number(m[1]);
}

test('stats records met NPCs from dialogue-open events without polling', () => {
  const prevWin = globalThis.window;
  const win = new EventTarget();
  globalThis.window = win;
  try {
    let current = 'sam';
    const dialogue = { isOpen: () => false, currentNpc: () => current };
    const stats = createStats({ dialogue });

    assert.deepEqual(stats.get().met, []);
    // Event with detail.id
    win.dispatchEvent(new CustomEvent('dialogue-open', { detail: { id: 'june' } }));
    assert.deepEqual(stats.get().met, ['june']);

    // Event without detail falls back to dialogue.currentNpc()
    win.dispatchEvent(new Event('dialogue-open'));
    assert.deepEqual(stats.get().met, ['june', 'sam']);

    // Duplicate meetings are ignored
    win.dispatchEvent(new CustomEvent('dialogue-open', { detail: { id: 'sam' } }));
    assert.deepEqual(stats.get().met, ['june', 'sam']);

    // dispose() removes the listener
    stats.dispose();
    current = 'dottie';
    win.dispatchEvent(new CustomEvent('dialogue-open', { detail: { id: 'dottie' } }));
    assert.deepEqual(stats.get().met, ['june', 'sam']);
  } finally {
    if (prevWin === undefined) delete globalThis.window;
    else globalThis.window = prevWin;
  }
});

test('UI z-index tiers stay strictly ordered: HUD < overlays < pause/title < feedback < transitions < toasts', () => {
  const hudButtons = [
    readZIndex('src/ui/hudScreenshot.js', '#hud-screenshot\\s*\\{'),
    readZIndex('src/ui/hudMute.js', '#hud-mute\\s*\\{'),
    readZIndex('src/ui/phone/phone.js', '#hud-phone\\s*\\{'),
    readZIndex('src/ui/inventory.js', '#inventory-toggle\\s*\\{'),
    readZIndex('src/ui/pauseMenu.js', '#pause-button\\s*\\{'),
    readZIndex('src/game/presentation.js', '#hud-camera-view\\s*\\{')
  ];
  const phoneAlert = readZIndex('src/ui/phone/phone.js', '#hud-phone-alert\\s*\\{');
  const inventoryOverlay = readZIndex('src/ui/inventory.js', '\\.inventory-overlay\\s*\\{');
  const phoneOverlay = readZIndex('src/ui/phone/phone.js', '\\.phone-overlay\\s*\\{');
  const dialogueOverlay = readZIndex('src/ui/dialogue.js', '\\.dialogue-overlay\\s*\\{');
  const debugMenu = readZIndex('src/ui/debugMenu.js', '#debug-menu\\s*\\{');
  const mvOverlay = readZIndex('src/ui/menuKit.js', '\\.mv-overlay\\s*\\{');
  const feedback = readZIndex('src/ui/feedback.js', '#debug-feedback\\s*\\{');
  const workOverlay = readZIndex('src/systems/work.js', '#work-overlay\\s*\\{');
  const sleepFade = readZIndex('src/systems/sleep.js', '#sleep-fade\\s*\\{');
  const gameToast = readZIndex('src/ui/hudMoney.js', '#game-toast\\s*\\{');
  const skillToast = readZIndex('src/systems/skills.js', '#skill-toast\\s*\\{');

  for (const z of hudButtons) {
    assert.ok(z < inventoryOverlay, `HUD button z-index ${z} must be below inventory overlay ${inventoryOverlay}`);
  }
  assert.ok(phoneAlert < inventoryOverlay, `phone alert ${phoneAlert} must be below inventory overlay ${inventoryOverlay}`);
  assert.ok(inventoryOverlay < phoneOverlay);
  assert.ok(phoneOverlay < dialogueOverlay);
  assert.ok(dialogueOverlay < debugMenu);
  assert.ok(debugMenu < mvOverlay);
  assert.ok(mvOverlay < feedback);
  assert.ok(feedback < workOverlay);
  assert.ok(workOverlay < sleepFade);
  assert.ok(sleepFade < gameToast);
  assert.ok(gameToast < skillToast);
});

test('polling setIntervals are removed from stats.js, main.js, and pauseMenu.js HUD visibility', () => {
  const statsSrc = readFileSync(new URL('../src/systems/stats.js', import.meta.url), 'utf8');
  const mainSrc = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const pauseSrc = readFileSync(new URL('../src/ui/pauseMenu.js', import.meta.url), 'utf8');

  assert.equal(statsSrc.includes('setInterval'), false, 'stats.js should not use setInterval');
  assert.equal(mainSrc.includes('setInterval'), false, 'main.js should not use setInterval');
  assert.equal((pauseSrc.match(/setInterval/g) || []).length, 1, 'pauseMenu.js should only have mapTimer setInterval');
});
