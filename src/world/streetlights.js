import * as THREE from 'three';
import { Parts } from './parts.js';
import { STREET, SURFACE_Y } from './street.js';

const LOCATIONS = [
  { x: -15, side: 1 }, // northwest house
  { x: -3.7, side: -1 }, // vending machine and main-house approach
  { x: 11, side: -1 }, // southeast frontage
  { x: 18.9, side: 1 } // market approach
];

export function buildStreetlights(scene, quality) {
  const metal = 0x3e4540;
  const fixtures = new Parts(true);
  const lenses = new Parts(false);
  const lights = [];
  const poleHeight = 3.6;
  const arm = 0.76;

  const pool = scene.userData && scene.userData.lightPool;
  for (const { x, side } of LOCATIONS) {
    const z = STREET.roadCenterZ + side * (STREET.roadWidth / 2 + STREET.sidewalkWidth - 0.15);
    const headZ = z - side * arm;
    const ground = SURFACE_Y.walk;
    fixtures.box(metal, 0.29, 0.18, 0.29, x, ground + 0.09, z);
    fixtures.cylinder(metal, 0.049, 0.073, poleHeight, x, ground + poleHeight / 2, z);
    fixtures.box(metal, 0.095, 0.085, arm, x, ground + poleHeight, z - side * arm / 2);
    fixtures.box(metal, 0.29, 0.15, 0.45, x, ground + poleHeight, headZ);
    lenses.box(0xffffff, 0.23, 0.025, 0.35, x, ground + poleHeight - 0.074, headZ);

    if (pool) {
      lights.push(pool.addSpot({
        x, y: ground + poleHeight - 0.14, z: headZ,
        tx: x, ty: ground, tz: headZ - side * 0.45,
        color: 0xffdbab, intensity: 0, distance: 7.2, angle: Math.PI / 3.4, penumbra: 0.55, decay: 2
      }));
    } else {
      const light = new THREE.SpotLight(0xffdbab, 0, 7.2, Math.PI / 3.4, 0.55, 2);
      light.position.set(x, ground + poleHeight - 0.14, headZ);
      light.target.position.set(x, ground, headZ - side * 0.45);
      lights.push(light);
      scene.add(light, light.target);
    }
    scene.userData.colliders.addTree({ id: 'streetlight-' + x, x, z, radius: 0.145 });
  }

  const poles = new THREE.Mesh(
    fixtures.merge(),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72 })
  );
  poles.receiveShadow = !!quality.shadows;
  const glass = new THREE.MeshStandardMaterial({
    color: 0x75695a, roughness: 0.8, emissive: 0xffdaaa, emissiveIntensity: 0
  });
  scene.add(poles, new THREE.Mesh(lenses.merge(), glass));

  return {
    update(minutes) {
      const evening = THREE.MathUtils.smoothstep(minutes, 18 * 60 + 20, 19 * 60 + 20);
      const morning = 1 - THREE.MathUtils.smoothstep(minutes, 5 * 60 + 35, 6 * 60 + 35);
      const strength = evening + morning;
      for (const light of lights) light.intensity = 29 * strength;
      glass.emissiveIntensity = 0.92 * strength;
    }
  };
}
