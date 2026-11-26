// Run from the repo root with: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectMobile } from '../src/core/device.js';

const desktopUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';
const macUA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
const iphoneUA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const androidUA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36';

test('desktop with a mouse is not mobile (whatever the window width)', () => {
  assert.equal(detectMobile({ userAgent: desktopUA, canHover: true }), false);
});
test('iPhone and Android phones are mobile', () => {
  assert.equal(detectMobile({ userAgent: iphoneUA }), true);
  assert.equal(detectMobile({ userAgent: androidUA }), true);
});
test('an iPad reporting as a Mac is mobile; a real Mac is not', () => {
  assert.equal(detectMobile({ userAgent: macUA, platform: 'MacIntel', maxTouchPoints: 5 }), true);
  assert.equal(detectMobile({ userAgent: macUA, platform: 'MacIntel', maxTouchPoints: 0, canHover: true }), false);
});
test('a touch laptop whose primary pointer is a mouse stays desktop', () => {
  assert.equal(detectMobile({ userAgent: desktopUA, maxTouchPoints: 10, coarsePointer: false, canHover: true }), false);
});
test('an unknown touch-only device (coarse pointer, no hover) is mobile', () => {
  assert.equal(detectMobile({ userAgent: desktopUA, coarsePointer: true, canHover: false }), true);
});
test('?mobile=1 / ?mobile=0 override detection', () => {
  assert.equal(detectMobile({ userAgent: desktopUA, canHover: true, search: '?mobile=1' }), true);
  assert.equal(detectMobile({ userAgent: iphoneUA, search: '?x=2&mobile=0' }), false);
});
