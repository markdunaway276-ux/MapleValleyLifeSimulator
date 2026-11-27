// Run from the repo root with: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLightPool, POOL_BUDGET } from '../src/world/lightPool.js';

function fakeVec() {
  return {
    x: 0, y: 0, z: 0,
    set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  };
}

class FakePointLight {
  constructor(color, intensity, distance, decay) {
    this.color = { hex: color, setHex(h) { this.hex = h; } };
    this.intensity = intensity;
    this.distance = distance;
    this.decay = decay;
    this.position = fakeVec();
    this.userData = {};
  }
}

class FakeSpotLight extends FakePointLight {
  constructor(color, intensity, distance, angle, penumbra, decay) {
    super(color, intensity, distance, decay);
    this.angle = angle;
    this.penumbra = penumbra;
    this.target = {
      position: fakeVec(),
      matrixUpdates: 0,
      updateMatrixWorld() { this.matrixUpdates += 1; }
    };
  }
}

test('lightPool allocates fixed desktop and mobile budgets once without adding lights later', () => {
  const desktopAdded = [];
  const desktopPool = createLightPool({
    scene: { add(...objs) { desktopAdded.push(...objs); } },
    quality: { shadows: true },
    PointLight: FakePointLight,
    SpotLight: FakeSpotLight
  });
  assert.equal(desktopPool.pointPool.length, POOL_BUDGET.desktop.point);
  assert.equal(desktopPool.spotPool.length, POOL_BUDGET.desktop.spot);
  const initialCount = desktopAdded.length;

  // Adding many fixtures does not add more Three.js lights to the scene.
  for (let i = 0; i < 12; i++) desktopPool.addPoint({ x: i * 5, y: 3, z: 0, intensity: 10 });
  for (let i = 0; i < 10; i++) desktopPool.addSpot({ x: i * 4, y: 4, z: 0, intensity: 20 });
  assert.equal(desktopAdded.length, initialCount);

  const mobileAdded = [];
  const mobilePool = createLightPool({
    scene: { add(...objs) { mobileAdded.push(...objs); } },
    quality: { shadows: false },
    PointLight: FakePointLight,
    SpotLight: FakeSpotLight
  });
  assert.equal(mobilePool.pointPool.length, POOL_BUDGET.mobile.point);
  assert.equal(mobilePool.spotPool.length, POOL_BUDGET.mobile.spot);
  assert.equal(mobileAdded.length, 3); // 1 PointLight + 1 SpotLight + 1 SpotLight.target
});

test('lightPool moves pooled lights to the nearest active fixtures and zeros unused slots', () => {
  const pool = createLightPool({
    scene: { add() {} },
    PointLight: FakePointLight,
    SpotLight: FakeSpotLight,
    pointCount: 2,
    spotCount: 2
  });

  const pOff = pool.addPoint({ x: 0, y: 2, z: 0, color: 0x111111, intensity: 0, distance: 8 });
  const pNear = pool.addPoint({ x: 2, y: 2, z: 0, color: 0xffaa00, intensity: 18, distance: 9, decay: 1.8 });
  const pMid = pool.addPoint({ x: 10, y: 2, z: 0, color: 0x00ffaa, intensity: 12, distance: 11, decay: 2 });
  const pFar = pool.addPoint({ x: 30, y: 2, z: 0, color: 0x0000ff, intensity: 25, distance: 12 });

  const sOne = pool.addSpot({ x: 5, y: 4, z: 1, tx: 5, ty: 0, tz: 2, color: 0xffddaa, intensity: 30, distance: 7.2, angle: 0.9, penumbra: 0.6, decay: 2 });

  pool.update({ x: 0, y: 1.6, z: 0 });
  // pOff is skipped (intensity 0); pNear and pMid take the 2 point slots.
  assert.equal(pool.pointPool[0].intensity, 18);
  assert.equal(pool.pointPool[0].position.x, 2);
  assert.equal(pool.pointPool[0].color.hex, 0xffaa00);
  assert.equal(pool.pointPool[1].intensity, 12);
  assert.equal(pool.pointPool[1].position.x, 10);

  // Only 1 active spot: slot 0 gets sOne, slot 1 stays at intensity 0.
  assert.equal(pool.spotPool[0].intensity, 30);
  assert.equal(pool.spotPool[0].angle, 0.9);
  assert.equal(pool.spotPool[0].penumbra, 0.6);
  assert.equal(pool.spotPool[0].target.position.x, 5);
  assert.equal(pool.spotPool[0].target.position.z, 2);
  assert.equal(pool.spotPool[0].target.matrixUpdates, 1);
  assert.equal(pool.spotPool[1].intensity, 0);

  // Move player near pFar and turn pOff on: pool reassigns dynamically.
  pOff.intensity = 15;
  pool.update({ x: 29, y: 1.6, z: 0 });
  assert.equal(pool.pointPool[0].intensity, 25);
  assert.equal(pool.pointPool[0].position.x, 30);
  assert.equal(pool.pointPool[1].position.x, 10);

  // Turn off sOne: both spot slots go to intensity 0.
  sOne.intensity = 0;
  pool.update({ x: 29, y: 1.6, z: 0 });
  assert.equal(pool.spotPool[0].intensity, 0);
  assert.equal(pool.spotPool[1].intensity, 0);
});
