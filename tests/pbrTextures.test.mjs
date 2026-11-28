import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { register } from 'node:module';

register(new URL('./helpers/threeHook.mjs', import.meta.url));

const THREE = await import('three');
const { PBR_SETS, applyPbrSurface, applyRoadAsphaltPbr } = await import('../src/world/pbrTextures.js');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('all CC0 PBR texture sets exist on disk as WebP maps', () => {
  const names = Object.keys(PBR_SETS);
  assert.ok(names.length >= 5, 'expected at least 5 PBR texture sets');
  for (const name of names) {
    for (const suffix of ['diff', 'nor', 'rough']) {
      const file = path.join(ROOT, 'assets', 'textures', 'pbr', `${name}_${suffix}.webp`);
      assert.ok(fs.existsSync(file), `missing PBR map: ${file}`);
      assert.ok(fs.statSync(file).size > 200, `PBR map unexpectedly empty: ${file}`);
    }
  }
});

test('applyPbrSurface and applyRoadAsphaltPbr are safe no-ops in headless Node', () => {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff });
  assert.equal(applyPbrSurface(mat, 'grass', { repeat: [4, 4] }), mat);
  assert.equal(applyPbrSurface(mat, 'nonexistent'), mat);
  assert.equal(applyRoadAsphaltPbr(mat, { repeat: new THREE.Vector2(10, 1) }), mat);
});
