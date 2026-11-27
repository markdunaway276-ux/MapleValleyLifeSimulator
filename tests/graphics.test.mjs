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
  assert.match(m.customProgramCacheKey(), /vertex-roughness-v1\|world-grit-v2:.*\|vertex-emissive-v1/);
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
  assert.ok(horizon.getObjectByName('valley-hills'));

  const details = buildStreetDetails(scene, { shadows: true });
  assert.ok(details.getObjectByName('power-lines'));
  assert.ok(details.getObjectByName('street-clutter'));

  updateWetSurfaces(scene, 0);
  assert.ok(Math.abs(road.material.roughness - 0.90) < 1e-6);
  updateWetSurfaces(scene, 1);
  assert.ok(road.material.roughness < 0.35);
  assert.ok(walk.material.roughness < 0.45);

  const particles = createAmbientParticles(scene, { shadows: true });
  particles.update(0.05, { playerPos: { x: 0, z: 0 }, minutes: 12 * 60, rain: 0 });
  assert.equal(particles.points.visible, false);
  particles.update(0.05, { playerPos: { x: 0, z: 0 }, minutes: 21 * 60, rain: 0 });
  assert.equal(particles.points.visible, true);
  particles.update(0.05, { playerPos: { x: 0, z: 0 }, minutes: 21 * 60, rain: 0.8 });
  assert.equal(particles.points.visible, false);
});
