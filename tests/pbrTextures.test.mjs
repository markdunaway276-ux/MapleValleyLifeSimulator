import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { register } from 'node:module';

register(new URL('./helpers/threeHook.mjs', import.meta.url));

const THREE = await import('three');
const { PBR_SETS, applyPbrSurface, applyRoadAsphaltPbr } = await import('../src/world/pbrTextures.js');
const { placeGltfProp } = await import('../src/world/modelProps.js');

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

test('all 9 CC0 interior furniture GLBs exist with valid glTF binary headers and placeGltfProp is headless-safe', () => {
  const models = [
    'sofa', 'coffee-table', 'armchair', 'dining-chair',
    'dining-table', 'nightstand', 'laptop', 'potted-plant', 'bookshelf'
  ];
  for (const name of models) {
    const file = path.join(ROOT, 'assets', 'models', 'interior', `${name}.glb`);
    assert.ok(fs.existsSync(file), `missing interior GLB: ${file}`);
    const head = fs.readFileSync(file).subarray(0, 4).toString('ascii');
    assert.equal(head, 'glTF', `invalid GLB header for ${name}.glb`);
  }
  const group = new THREE.Group();
  assert.equal(placeGltfProp(group, './assets/models/interior/sofa.glb', { x: 0, y: 0, z: 0 }), null);
});

test('all 6 CC0 outdoor prop GLBs exist with valid glTF binary headers', () => {
  const models = [
    'park-bench', 'picnic-table', 'trash-can',
    'planter-box', 'rocking-chair', 'patio-set'
  ];
  for (const name of models) {
    const file = path.join(ROOT, 'assets', 'models', 'props', `${name}.glb`);
    assert.ok(fs.existsSync(file), `missing outdoor prop GLB: ${file}`);
    const head = fs.readFileSync(file).subarray(0, 4).toString('ascii');
    assert.equal(head, 'glTF', `invalid GLB header for ${name}.glb`);
  }
});

test('all CC0 traffic vehicle GLBs and mallard duck GLB exist with valid glTF binary headers', () => {
  const files = [
    ['vehicles', 'traffic-sedan.glb'],
    ['vehicles', 'traffic-suv.glb'],
    ['vehicles', 'traffic-coupe.glb'],
    ['scenery', 'mallard-duck.glb']
  ];
  for (const [dir, name] of files) {
    const file = path.join(ROOT, 'assets', 'models', dir, name);
    assert.ok(fs.existsSync(file), `missing GLB: ${file}`);
    const head = fs.readFileSync(file).subarray(0, 4).toString('ascii');
    assert.equal(head, 'glTF', `invalid GLB header for ${dir}/${name}`);
  }
});

test('Wardrobe outfit & accessory slots and 3D characterAccessories helpers work cleanly', async () => {
  const { APPEARANCE_SLOTS, DEFAULT_APPEARANCE, normalizeAppearance } = await import('../src/data/appearance.js');
  const { outfitToBody, attachAccessories, applyAppearanceToModel } = await import('../src/world/characterAccessories.js');

  const slotIds = APPEARANCE_SLOTS.map((s) => s.id);
  assert.ok(slotIds.includes('outfit') && slotIds.includes('accessory'));
  assert.equal(DEFAULT_APPEARANCE.outfit, 'casual');
  assert.equal(DEFAULT_APPEARANCE.accessory, 'none');
  assert.equal(outfitToBody('workwear'), 'clerk');
  assert.equal(outfitToBody('cozy'), 'june');

  const fakeRoot = new THREE.Group();
  const head = new THREE.Bone();
  head.name = 'Head';
  const spine = new THREE.Bone();
  spine.name = 'spine_03';
  const suit = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.4, 0.2), new THREE.MeshStandardMaterial({ color: 0xffffff }));
  suit.name = 'female_casualsuit02';
  fakeRoot.add(head, spine, suit);

  const look = normalizeAppearance({ outfit: 'casual', accessory: 'cap', shirt: 'red', pants: 'denim' });
  applyAppearanceToModel(fakeRoot, look);
  assert.ok(suit.material.userData.suitSplit, 'suit mesh should receive shirt/pants split shader');

  const capRes = attachAccessories(fakeRoot, 'cap', { shirtColor: '#c43b3b' });
  assert.equal(capRes.headAccessories.length, 1);
  assert.ok(head.getObjectByName('maple-accessory-mount'));

  const bagRes = attachAccessories(fakeRoot, 'backpack', { shirtColor: '#2f6b3a' });
  assert.equal(bagRes.headAccessories.length, 0);
  assert.ok(spine.getObjectByName('maple-accessory-mount'));
});
