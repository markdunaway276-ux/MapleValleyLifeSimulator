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

  // Soft additive volumetric light cones + lamp halos for moody dusk/night haze.
  const coneHeight = 3.1;
  const coneGeo = new THREE.ConeGeometry(1.55, coneHeight, 14, 1, true);
  coneGeo.translate(0, -coneHeight / 2, 0);
  const coneMat = new THREE.ShaderMaterial({
    uniforms: {
      color: { value: new THREE.Color(0xffd296) },
      opacity: { value: 0 }
    },
    vertexShader: /* glsl */`
      varying float vY;
      varying float vRim;
      void main() {
        vY = clamp(-position.y / ${coneHeight.toFixed(2)}, 0.0, 1.0);
        vec3 n = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vec3 v = normalize(-mv.xyz);
        vRim = pow(abs(dot(n, v)), 1.35);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */`
      uniform vec3 color;
      uniform float opacity;
      varying float vY;
      varying float vRim;
      void main() {
        float fade = pow(1.0 - vY, 1.8) * smoothstep(0.0, 0.08, vY) * vRim;
        gl_FragColor = vec4(color, fade * opacity);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide
  });

  const haloGeo = new THREE.SphereGeometry(0.32, 10, 8);
  const haloMat = new THREE.MeshBasicMaterial({
    color: 0xffe0ad,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  const glowGroup = new THREE.Group();
  glowGroup.name = 'streetlight-halos';
  for (const { x, side } of LOCATIONS) {
    const z = STREET.roadCenterZ + side * (STREET.roadWidth / 2 + STREET.sidewalkWidth - 0.15);
    const headZ = z - side * arm;
    const headY = SURFACE_Y.walk + poleHeight - 0.09;
    const cone = new THREE.Mesh(coneGeo, coneMat);
    cone.position.set(x, headY, headZ);
    const halo = new THREE.Mesh(haloGeo, haloMat);
    halo.position.set(x, headY - 0.03, headZ);
    glowGroup.add(cone, halo);
  }
  glowGroup.visible = false;
  scene.add(glowGroup);

  return {
    update(minutes, rain = 0) {
      const evening = THREE.MathUtils.smoothstep(minutes, 18 * 60 + 20, 19 * 60 + 20);
      const morning = 1 - THREE.MathUtils.smoothstep(minutes, 5 * 60 + 35, 6 * 60 + 35);
      const strength = Math.min(1, evening + morning);
      for (const light of lights) light.intensity = 29 * strength;
      glass.emissiveIntensity = 0.92 * strength;
      glowGroup.visible = strength > 0.02;
      if (glowGroup.visible) {
        const hazeBoost = 1 + Math.min(1, Number(rain) || 0) * 0.45;
        coneMat.uniforms.opacity.value = 0.16 * strength * hazeBoost;
        haloMat.opacity = 0.24 * strength * hazeBoost;
      }
    }
  };
}
