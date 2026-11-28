// Run from the repo root with: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register(new URL('./helpers/threeHook.mjs', import.meta.url));

const THREE = await import('three');
const { LOOK } = await import('../src/world/palette.js');
const { GradeShader } = await import('../src/world/post.js');
const { createVertexMaterial, useWorldGrit, useVertexEmissive } = await import('../src/world/surfaces.js');
const { buildValleyHorizon, buildStreetDetails, updateWetSurfaces, createAmbientParticles } = await import('../src/world/atmosphere.js');

function fakeShader() {
  return {
    vertexShader: '#include <common>\nvoid main() {\n#include <begin_vertex>\n}',
    fragmentShader: [
      '#include <common>',
      'void main() {',
      '#include <color_fragment>',
      '#include <roughnessmap_fragment>',
      '#include <normal_fragment_maps>',
      '#include <emissivemap_fragment>',
      '}'
    ].join('\n')
  };
}

test('createVertexMaterial composes vertex roughness, world grit, and vertex emissive hooks', () => {
  const m = useVertexEmissive(createVertexMaterial({ metalness: 0.04, emissive: 0xffffff }));
  assert.equal(m.userData.vertexRoughness, true);
  assert.equal(m.userData.worldGrit, true);
  assert.equal(m.userData.vertexEmissive, true);

  const shader = fakeShader();
  m.onBeforeCompile(shader);

  assert.match(shader.vertexShader, /attribute float aRough;/);
  assert.match(shader.vertexShader, /vGritWorldPos =/);
  assert.match(shader.vertexShader, /vGritWorldNormal =/);
  assert.match(shader.fragmentShader, /float roughnessFactor = roughness \* vRough;/);
  assert.match(shader.fragmentShader, /gritSplash/);
  assert.match(shader.fragmentShader, /gritMicro/);
  assert.doesNotMatch(shader.fragmentShader, /dFdx\(/);
  assert.match(shader.fragmentShader, /totalEmissiveRadiance \*= vColor\.rgb;/);
  assert.match(shader.fragmentShader, /roofMatMask/);
  assert.match(shader.fragmentShader, /brickMask/);
  assert.match(shader.fragmentShader, /sidingMask/);
  assert.match(m.customProgramCacheKey(), /vertex-roughness-v1\|world-grit-v3:.*\|vertex-emissive-v2/);
});

test('useWorldGrit patches plain MeshStandardMaterial and is idempotent', () => {
  const m = new THREE.MeshStandardMaterial({ color: 0x989386, roughness: 0.95 });
  useWorldGrit(m, { strength: 1.1, groundGrime: 0.3 });
  const keyOnce = m.customProgramCacheKey();
  useWorldGrit(m, { strength: 0.5 });
  assert.equal(m.customProgramCacheKey(), keyOnce);

  const shader = fakeShader();
  m.onBeforeCompile(shader);
  assert.match(shader.fragmentShader, /float gritBaseRough = roughness;/);
  assert.match(shader.fragmentShader, /#include <roughnessmap_fragment>/);
  assert.match(shader.fragmentShader, /roughnessFactor = clamp\(roughnessFactor \+/);
});

test('GradeShader wires gritty grade uniforms including sharpen and highlight bloom', () => {
  assert.equal(GradeShader.uniforms.sharpen.value, LOOK.grade.sharpen);
  assert.equal(GradeShader.uniforms.bloom.value, LOOK.grade.bloom);
  assert.equal(GradeShader.uniforms.bloomThreshold.value, LOOK.grade.bloomThreshold);
  assert.ok(GradeShader.uniforms.resolution.value.isVector2);
  assert.match(GradeShader.fragmentShader, /sampleBloom\(vUv, px\)/);
  assert.match(GradeShader.fragmentShader, /edge \* sharpen/);
});

test('atmosphere builders add valley horizon, power lines, street clutter, wet roads, and fireflies', () => {
  const scene = new THREE.Scene();
  const road = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.MeshStandardMaterial({ roughness: 0.90 }));
  road.name = 'road';
  const walk = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.MeshStandardMaterial({ roughness: 0.90 }));
  walk.name = 'sidewalk-north';
  scene.add(road, walk);

  const horizon = buildValleyHorizon(scene, { shadows: true });
  assert.equal(horizon.name, 'valley-horizon');
  assert.equal(horizon.children.length, 0);

  const details = buildStreetDetails(scene, { shadows: true });
  assert.ok(details.getObjectByName('power-lines'));
  assert.ok(details.getObjectByName('street-clutter'));

  updateWetSurfaces(scene, 0);
  assert.ok(Math.abs(road.material.roughness - 0.90) < 1e-6);
  updateWetSurfaces(scene, 1);
  assert.ok(road.material.roughness < 0.35);
  assert.ok(road.material.envMapIntensity > 1.5);
  assert.ok(walk.material.roughness < 0.45);

  const particles = createAmbientParticles(scene, { shadows: true });
  particles.update(0.05, { playerPos: { x: 0, z: 0 }, minutes: 12 * 60, rain: 0 });
  assert.equal(particles.points.visible, false);
  particles.update(0.05, { playerPos: { x: 0, z: 0 }, minutes: 21 * 60, rain: 0 });
  assert.equal(particles.points.visible, true);
  particles.update(0.05, { playerPos: { x: 0, z: 0 }, minutes: 21 * 60, rain: 0.8 });
  assert.equal(particles.points.visible, false);
});

test('graphics overhaul: 3D instanced foliage, headless sky envMap guard, and pickup headlight beams work cleanly', async () => {
  const { buildGroundFoliage } = await import('../src/world/foliage.js');
  const { createSkyEnvMap } = await import('../src/world/envMap.js');
  const { createPlayerPickup } = await import('../src/world/pickup.js');

  const scene = new THREE.Scene();
  const foliage = buildGroundFoliage(scene, { shadows: true });
  assert.ok(foliage.group.getObjectByName('foliage-grass-tufts'));
  assert.ok(foliage.group.getObjectByName('foliage-fallen-leaves'));
  assert.ok(foliage.group.getObjectByName('foliage-wildflowers'));
  assert.ok(foliage.group.getObjectByName('foliage-drifting-leaves'));
  foliage.update(0.05, { playerPos: { x: 0, z: 0 }, rain: 0 });
  assert.equal(foliage.group.getObjectByName('foliage-drifting-leaves').visible, true);
  foliage.update(0.05, { playerPos: { x: 0, z: 0 }, rain: 0.9 });
  assert.equal(foliage.group.getObjectByName('foliage-drifting-leaves').visible, false);

  // Headless renderer without WebGL context safely no-ops.
  const env = createSkyEnvMap(null, scene, { shadows: true });
  assert.doesNotThrow(() => env.update({ skyTop: 0x4a7ea4, skyBottom: 0xc2d2dc }, 1));
  assert.doesNotThrow(() => env.dispose());

  // Pickup volumetric headlights toggle on at night and off at midday.
  const car = createPlayerPickup({ shadows: true });
  const headlights = car.getObjectByName('pickup-headlights');
  assert.ok(headlights);
  car.userData.updateHeadlights(12 * 60, 0, false);
  assert.equal(headlights.visible, false);
  car.userData.updateHeadlights(21 * 60, 0, true);
  assert.equal(headlights.visible, true);
});

test('living world bundle and live Look Presets work cleanly across time, rain, driving, and TV state', async () => {
  const { buildLivingWorld } = await import('../src/world/livingWorld.js');
  const { createDisplay, LOOK_PRESETS } = await import('../src/systems/display.js');

  const applied = { preset: null, strength: null, grain: null };
  const renderer = { toneMappingExposure: 1 };
  const post = {
    setPreset(p) { applied.preset = p; },
    setGradeStrength(v) { applied.strength = v; },
    setGrain(on) { applied.grain = on; }
  };
  const display = createDisplay({ renderer, post, storage: null });
  assert.equal(display.get().preset, 'classic');
  display.setPreset('autumn');
  assert.equal(display.get().preset, 'autumn');
  assert.equal(applied.preset, LOOK_PRESETS.autumn);
  assert.ok(renderer.toneMappingExposure > 1.08);
  display.setPreset('unknown-id');
  assert.equal(display.get().preset, 'classic');

  const scene = new THREE.Scene();
  const lw = buildLivingWorld(scene, { shadows: true });
  assert.ok(lw.group.getObjectByName('chimney-smoke'));
  assert.ok(lw.group.getObjectByName('pickup-exhaust'));
  assert.ok(lw.group.getObjectByName('rain-puddles'));
  assert.ok(lw.group.getObjectByName('sky-birds'));
  assert.ok(lw.group.getObjectByName('powerline-crows'));
  assert.ok(lw.group.getObjectByName('interior-sunbeams'));
  assert.ok(lw.group.getObjectByName('tv-wall-glow'));

  // Clear morning: chimney smoke, birds, and sunbeams visible; puddles hidden; TV off.
  lw.update(0.05, { minutes: 8 * 60 + 30, rain: 0, driving: false, tvOn: false });
  assert.equal(lw.group.getObjectByName('chimney-smoke').visible, true);
  assert.equal(lw.group.getObjectByName('sky-birds').visible, true);
  assert.equal(lw.group.getObjectByName('interior-sunbeams').visible, true);
  assert.equal(lw.group.getObjectByName('rain-puddles').visible, false);
  assert.equal(lw.group.getObjectByName('tv-wall-glow').intensity, 0);

  // Rainy night with TV on: puddles visible, birds hidden, TV bounce light active.
  lw.update(0.05, { minutes: 21 * 60, rain: 0.85, driving: false, tvOn: true });
  assert.equal(lw.group.getObjectByName('rain-puddles').visible, true);
  assert.equal(lw.group.getObjectByName('sky-birds').visible, false);
  assert.ok(lw.group.getObjectByName('tv-wall-glow').intensity > 2);

  // Driving with either a Three.js Object3D or car API wrapper never throws and activates exhaust.
  const carMesh = new THREE.Group();
  lw.update(0.05, { minutes: 12 * 60, rain: 0, car: carMesh, driving: true, tvOn: false });
  assert.equal(lw.group.getObjectByName('pickup-exhaust').visible, true);
  lw.update(0.05, { minutes: 12 * 60, rain: 0, car: { object: carMesh }, driving: true, tvOn: false });
  assert.equal(lw.group.getObjectByName('pickup-exhaust').visible, true);
});

test('valley graphics upgrades: normal relief, 3D mountains, night porch spills, waving flags, tree sway, and storm effects', async () => {
  const { buildValleyGraphics } = await import('../src/world/valleyGraphics.js');

  // Verify analytical normal relief in surfaces.js (with zero dFdx calls).
  const mat = createVertexMaterial();
  const sh = fakeShader();
  mat.onBeforeCompile(sh);
  assert.match(sh.fragmentShader, /reliefDist/);
  assert.doesNotMatch(sh.fragmentShader, /dFdx\(/);

  const scene = new THREE.Scene();
  const tree = new THREE.Group();
  tree.name = 'tree';
  scene.add(tree);

  const vg = buildValleyGraphics(scene, { shadows: true });
  assert.ok(vg.group.getObjectByName('valley-mountains-3d'));
  assert.ok(vg.group.getObjectByName('valley-pine-ridge'));
  assert.ok(vg.group.getObjectByName('night-porch-spills'));
  assert.ok(vg.group.getObjectByName('valley-flags'));
  assert.ok(vg.group.getObjectByName('rain-splashes'));
  assert.ok(vg.group.getObjectByName('storm-lightning'));

  // Midday dry: porch spills & rain splashes hidden, tree gently sways.
  vg.update(0.1, { playerPos: { x: 0, z: 0 }, minutes: 12 * 60, rain: 0 });
  assert.equal(vg.group.getObjectByName('night-porch-spills').visible, false);
  assert.equal(vg.group.getObjectByName('rain-splashes').visible, false);
  assert.notEqual(tree.rotation.z, 0);

  // Night storm: porch spills & rain splashes visible.
  vg.update(0.1, { playerPos: { x: 0, z: 0 }, minutes: 21 * 60, rain: 0.85 });
  assert.equal(vg.group.getObjectByName('night-porch-spills').visible, true);
  assert.equal(vg.group.getObjectByName('rain-splashes').visible, true);
});

test('Part 1 living town: AI traffic drives & yields for player, NPCs open umbrellas in rain, and park squirrels scurry', async () => {
  const { buildTownTraffic } = await import('../src/world/traffic.js');
  const { createNpc } = await import('../src/world/npc.js');
  const { buildLivingWorld } = await import('../src/world/livingWorld.js');

  const scene = new THREE.Scene();
  const traffic = buildTownTraffic(scene, { shadows: true });
  assert.equal(traffic.cars.length, 3);
  const car0 = traffic.cars[0];
  const startX = car0.x;

  // Hidden during opening drive.
  traffic.update(0.1, { minutes: 12 * 60, rain: 0, opening: true });
  assert.equal(traffic.root.visible, false);

  // Drives forward when road is clear.
  traffic.update(0.1, { minutes: 12 * 60, rain: 0, opening: false });
  assert.equal(traffic.root.visible, true);
  assert.ok(car0.x > startX);

  // Brakes & yields when player stands directly ahead in the same lane.
  const aheadX = car0.x + car0.dir * 4.5;
  traffic.update(0.1, { minutes: 21 * 60, rain: 0, playerPos: { x: aheadX, z: car0.z }, opening: false });
  assert.equal(car0.braking, true);
  assert.equal(car0.cones.visible, true);

  // Outdoor NPC pops open umbrella when raining and closes it when dry.
  const prevDoc = globalThis.document;
  globalThis.document = {
    createElement: () => ({
      width: 64, height: 64,
      getContext: () => ({
        createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
        putImageData() {},
        createRadialGradient: () => ({ addColorStop() {} }),
        fillRect() {}, clearRect() {}
      })
    })
  };
  try {
    const npc = createNpc({
      id: 'test-sam',
      name: 'Sam',
      patrol: { x0: -5, x1: 5, startX: 0, z: -2.5 },
      colors: { shirt: 0x446688, pants: 0x333333, shoes: 0x222222 }
    }, scene, { shadows: false });
    const umbrella = npc.group.getObjectByName('npc-umbrella');
    assert.ok(umbrella);
    npc.update(0.05, { minutes: 12 * 60, raining: false });
    assert.equal(umbrella.visible, false);
    npc.update(0.05, { minutes: 12 * 60, raining: true });
    assert.equal(umbrella.visible, true);
  } finally {
    if (prevDoc === undefined) delete globalThis.document;
    else globalThis.document = prevDoc;
  }

  // Park squirrels scurry during dry daytime and hide in heavy rain.
  const lw = buildLivingWorld(scene, { shadows: true });
  const squirrels = lw.group.getObjectByName('park-squirrels');
  assert.ok(squirrels);
  lw.update(0.1, { minutes: 12 * 60, rain: 0 });
  assert.equal(squirrels.visible, true);
  lw.update(0.1, { minutes: 12 * 60, rain: 0.85 });
  assert.equal(squirrels.visible, false);
});

test('Part 2 audio & camera: Maple FM Radio cycles stations/volume cleanly and Camera supports zoom & film filters', async () => {
  const { createRadio, RADIO_STATIONS } = await import('../src/systems/radio.js');
  const { CAMERA_FILTERS } = await import('../src/ui/phone/photos.js');

  assert.ok(RADIO_STATIONS.length >= 4);
  const radio = createRadio({ isMuted: () => false });
  assert.equal(radio.getState().stationId, 'off');
  assert.equal(radio.getState().playing, false);

  const s1 = radio.cycleStation();
  assert.equal(s1.stationId, 'acoustic');
  assert.equal(s1.playing, true);

  radio.setVolume(0.75);
  assert.equal(radio.getState().volume, 0.75);

  radio.setStation('off');
  assert.equal(radio.getState().playing, false);
  radio.dispose();

  assert.ok(CAMERA_FILTERS.length >= 4);
  assert.equal(CAMERA_FILTERS[0].id, 'none');
});
