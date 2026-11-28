import * as THREE from 'three';
import { STREET, SURFACE_Y, NORTH_FRONTAGE_OFFSET } from './street.js';

/**
 * Valley Graphics & Atmosphere Polish:
 * 1. 3D parallax valley mountain ridge + distant pine silhouette ring (keeps Route 9 west pass open)
 * 2. Warm dusk/night porch sconces + soft storefront & house window light spills
 * 3. Wind-waving cloth flags at the Post Office and Fuel & Go
 * 4. Gentle wind sway on town tree canopies (stronger during rainstorms)
 * 5. Storm polish: flickering raindrop splash rings + occasional distant sheet lightning
 */

function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Builds a soft radial glow texture for warm window/porch light spills. */
function makeGlowTexture() {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, 'rgba(255, 224, 158, 0.95)');
  g.addColorStop(0.45, 'rgba(255, 198, 118, 0.42)');
  g.addColorStop(1, 'rgba(255, 180, 96, 0.0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Builds a crisp woven flag texture on a small canvas. */
function makeFlagTexture(bgHex, stripeHex, accentHex) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = 96;
  c.height = 60;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = bgHex;
  ctx.fillRect(0, 0, 96, 60);
  ctx.fillStyle = stripeHex;
  ctx.fillRect(0, 22, 96, 16);
  ctx.fillStyle = accentHex;
  ctx.beginPath();
  ctx.arc(30, 30, 11, 0, Math.PI * 2);
  ctx.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Low-poly 3D mountain ring with true parallax around Maple Lane.
 * Leaves a wide open valley corridor to the west (Route 9 approach) so nothing
 * ever blocks the road or clips the opening drive.
 */
function buildMountains(parent, quality) {
  const segs = quality.shadows ? 72 : 48;
  const innerR = 98;
  const peakR = 122;
  const outerR = 148;
  const positions = [];
  const colors = [];
  const cBase = new THREE.Color(0x2a3b30);
  const cMid = new THREE.Color(0x3a4d46);
  const cPeak = new THREE.Color(0x5d6e74);
  const tmp = new THREE.Color();

  function ridgeHeight(angle) {
    // Keep the west Route 9 approach (around angle = PI) low and wide open.
    const westDist = Math.abs(Math.atan2(Math.sin(angle - Math.PI), Math.cos(angle - Math.PI)));
    const passMask = THREE.MathUtils.smoothstep(westDist, 0.24, 0.72);
    const h = 11.5
      + 6.2 * Math.sin(angle * 3.0 + 0.8)
      + 4.1 * Math.cos(angle * 5.0 - 1.3)
      + 2.6 * Math.sin(angle * 9.0 + 2.1);
    return Math.max(1.2, h * passMask);
  }

  for (let i = 0; i < segs; i++) {
    const a0 = (i / segs) * Math.PI * 2;
    const a1 = ((i + 1) / segs) * Math.PI * 2;
    const h0 = ridgeHeight(a0);
    const h1 = ridgeHeight(a1);

    const cx = 12; // Center around Maple Lane + Park
    const cz = 4;
    const ix0 = cx + Math.cos(a0) * innerR, iz0 = cz + Math.sin(a0) * innerR;
    const ix1 = cx + Math.cos(a1) * innerR, iz1 = cz + Math.sin(a1) * innerR;
    const px0 = cx + Math.cos(a0) * peakR, pz0 = cz + Math.sin(a0) * peakR;
    const px1 = cx + Math.cos(a1) * peakR, pz1 = cz + Math.sin(a1) * peakR;
    const ox0 = cx + Math.cos(a0) * outerR, oz0 = cz + Math.sin(a0) * outerR;
    const ox1 = cx + Math.cos(a1) * outerR, oz1 = cz + Math.sin(a1) * outerR;

    const pCol0 = tmp.copy(cMid).lerp(cPeak, THREE.MathUtils.clamp((h0 - 8) / 14, 0, 1)).clone();
    const pCol1 = tmp.copy(cMid).lerp(cPeak, THREE.MathUtils.clamp((h1 - 8) / 14, 0, 1)).clone();

    // Inner slope (facing town)
    positions.push(
      ix0, -0.4, iz0, px0, h0, pz0, ix1, -0.4, iz1,
      ix1, -0.4, iz1, px0, h0, pz0, px1, h1, pz1
    );
    colors.push(
      cBase.r, cBase.g, cBase.b, pCol0.r, pCol0.g, pCol0.b, cBase.r, cBase.g, cBase.b,
      cBase.r, cBase.g, cBase.b, pCol0.r, pCol0.g, pCol0.b, pCol1.r, pCol1.g, pCol1.b
    );

    // Outer back slope
    positions.push(
      px0, h0, pz0, ox0, -1.0, oz0, px1, h1, pz1,
      px1, h1, pz1, ox0, -1.0, oz0, ox1, -1.0, oz1
    );
    colors.push(
      pCol0.r, pCol0.g, pCol0.b, cBase.r, cBase.g, cBase.b, pCol1.r, pCol1.g, pCol1.b,
      pCol1.r, pCol1.g, pCol1.b, cBase.r, cBase.g, cBase.b, cBase.r, cBase.g, cBase.b
    );
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.96,
    metalness: 0,
    flatShading: true
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'valley-mountains-3d';
  parent.add(mesh);

  // Distant pine silhouette ring lining the foot of the hills.
  const pineCount = quality.shadows ? 130 : 56;
  const pineGeo = new THREE.ConeGeometry(1.5, 6.2, 6);
  pineGeo.translate(0, 3.1, 0);
  const pineMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.94,
    metalness: 0,
    flatShading: true
  });
  const pines = new THREE.InstancedMesh(pineGeo, pineMat, pineCount);
  pines.name = 'valley-pine-ridge';
  const rand = makeRng(90210);
  const dummy = new THREE.Object3D();
  const pinePalette = [0x263b2c, 0x2f4632, 0x3a4d34, 0x233428, 0x4b4229];
  const col = new THREE.Color();
  let placed = 0;
  for (let i = 0; i < pineCount; i++) {
    const a = (i / pineCount) * Math.PI * 2 + (rand() - 0.5) * 0.05;
    const westDist = Math.abs(Math.atan2(Math.sin(a - Math.PI), Math.cos(a - Math.PI)));
    if (westDist < 0.28) continue; // Keep Route 9 corridor clear
    const r = 88 + rand() * 18;
    const s = 0.8 + rand() * 1.15;
    dummy.position.set(12 + Math.cos(a) * r, -0.2, 4 + Math.sin(a) * r);
    dummy.rotation.set(0, rand() * Math.PI * 2, 0);
    dummy.scale.set(s * 0.85, s * (0.9 + rand() * 0.5), s * 0.85);
    dummy.updateMatrix();
    pines.setMatrixAt(placed, dummy.matrix);
    col.setHex(pinePalette[Math.floor(rand() * pinePalette.length)]);
    pines.setColorAt(placed, col);
    placed++;
  }
  pines.count = placed;
  pines.instanceMatrix.needsUpdate = true;
  if (pines.instanceColor) pines.instanceColor.needsUpdate = true;
  parent.add(pines);
}

/**
 * Warm dusk/night porch sconces and soft window light spills cast onto lawns
 * and storefront sidewalks.
 */
function buildNightSpills(parent) {
  const group = new THREE.Group();
  group.name = 'night-porch-spills';

  const glowTex = makeGlowTexture();
  const spillMat = new THREE.MeshBasicMaterial({
    map: glowTex,
    color: 0xffc878,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const sconceMat = new THREE.MeshBasicMaterial({
    color: 0xffe4aa,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  const spillGeo = new THREE.PlaneGeometry(1, 1);
  const sconceGeo = new THREE.SphereGeometry(0.14, 8, 6);

  // Storefront & house window/porch spills along Maple Lane.
  const spills = [
    { x: 0.0, z: -5.2, w: 4.8, d: 3.4, sconceY: 2.35, sconceZ: -5.45 },                     // Main house front porch
    { x: -16.0, z: -5.4, w: 4.2, d: 3.0, sconceY: 2.30, sconceZ: -5.75 },                   // West neighbour
    { x: 16.0, z: -5.4, w: 4.2, d: 3.0, sconceY: 2.30, sconceZ: -5.75 },                    // East neighbour
    { x: 14.2, z: 2.8 + NORTH_FRONTAGE_OFFSET - 0.8, w: 6.4, d: 3.6, sconceY: 2.75 },       // Maple Lane Market storefront
    { x: 24.4, z: -6.8, w: 5.4, d: 3.4, sconceY: 2.65 },                                    // Laundromat storefront
    { x: -24.5, z: 3.1 + NORTH_FRONTAGE_OFFSET - 0.8, w: 5.2, d: 3.4, sconceY: 2.65 },      // Clinic storefront
    { x: 35.5, z: 3.0 + NORTH_FRONTAGE_OFFSET - 0.8, w: 4.8, d: 3.2, sconceY: 2.65 }        // Post Office entrance
  ];

  for (const s of spills) {
    const pool = new THREE.Mesh(spillGeo, spillMat);
    pool.rotation.x = -Math.PI / 2;
    pool.scale.set(s.w, s.d, 1);
    pool.position.set(s.x, SURFACE_Y.walk + 0.014, s.z);
    group.add(pool);

    const bulb = new THREE.Mesh(sconceGeo, sconceMat);
    bulb.position.set(s.x, s.sconceY, s.sconceZ ?? s.z);
    group.add(bulb);
  }
  group.visible = false;
  parent.add(group);
  return { group, spillMat, sconceMat };
}

/**
 * Wind-waving cloth flags (Post Office Maple Valley banner + Gas Station flag).
 */
function buildFlags(parent) {
  const group = new THREE.Group();
  group.name = 'valley-flags';
  const poleMat = new THREE.MeshStandardMaterial({ color: 0xbac2c8, roughness: 0.35, metalness: 0.72 });
  const flags = [];

  const defs = [
    { x: 32.8, z: 1.8 + NORTH_FRONTAGE_OFFSET, h: 4.4, bg: '#214568', stripe: '#d4a348', accent: '#f6efe0' }, // Post Office banner
    { x: -37.5, z: -5.2, h: 4.2, bg: '#a83328', stripe: '#f2ead8', accent: '#e09a2b' }                        // Fuel & Go flag
  ];

  for (const d of defs) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.048, d.h, 8), poleMat);
    pole.position.set(d.x, d.h / 2, d.z);
    const finial = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), poleMat);
    finial.position.set(d.x, d.h + 0.04, d.z);
    group.add(pole, finial);

    const clothGeo = new THREE.PlaneGeometry(1.15, 0.72, 10, 4);
    clothGeo.translate(0.575, 0, 0); // Attach left edge to pole
    const basePos = new Float32Array(clothGeo.attributes.position.array);
    const tex = makeFlagTexture(d.bg, d.stripe, d.accent);
    const clothMat = new THREE.MeshStandardMaterial({
      map: tex,
      color: tex ? 0xffffff : d.bg,
      roughness: 0.78,
      metalness: 0,
      side: THREE.DoubleSide
    });
    const cloth = new THREE.Mesh(clothGeo, clothMat);
    cloth.position.set(d.x, d.h - 0.42, d.z);
    group.add(cloth);
    flags.push({ mesh: cloth, basePos });
  }

  parent.add(group);
  return { group, flags };
}

export function buildValleyGraphics(scene, quality = {}) {
  const hi = !!quality.shadows;
  const group = new THREE.Group();
  group.name = 'valley-graphics';
  scene.add(group);

  buildMountains(group, quality);
  const nightSpills = buildNightSpills(group);
  const flagSystem = buildFlags(group);

  // --- Storm Polish: Raindrop Splash Rings + Distant Sheet Lightning ---
  const splashCount = hi ? 54 : 24;
  const splashGeo = new THREE.RingGeometry(0.04, 0.09, 10);
  splashGeo.rotateX(-Math.PI / 2);
  const splashMat = new THREE.MeshBasicMaterial({
    color: 0xd8ecff,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  const splashMesh = new THREE.InstancedMesh(splashGeo, splashMat, splashCount);
  splashMesh.name = 'rain-splashes';
  splashMesh.frustumCulled = false;
  splashMesh.visible = false;
  group.add(splashMesh);

  const rand = makeRng(55123);
  const splashes = Array.from({ length: splashCount }, () => ({
    ox: (rand() - 0.5) * 24,
    oz: (rand() - 0.5) * 24,
    phase: rand(),
    speed: 2.2 + rand() * 1.8
  }));

  const lightningLight = new THREE.DirectionalLight(0xcce0ff, 0);
  lightningLight.name = 'storm-lightning';
  lightningLight.position.set(-28, 42, -18);
  group.add(lightningLight);

  // Cache references to town trees for gentle canopy wind sway.
  const swayTrees = [];
  let scannedTrees = false;
  const dummy = new THREE.Object3D();
  let clock = 0;
  let nextLightningAt = 6.5;
  let lightningTimer = 0;

  return {
    group,
    update(delta, { playerPos, minutes = 600, rain = 0 } = {}) {
      const dt = Math.max(0, Math.min(0.1, Number(delta) || 0));
      clock += dt;
      const wet = Math.max(0, Math.min(1, Number(rain) || 0));

      // 1) Night porch sconces & storefront window spills.
      const dusk = THREE.MathUtils.smoothstep(minutes, 18 * 60 + 5, 19 * 60 + 25);
      const dawn = 1 - THREE.MathUtils.smoothstep(minutes, 5 * 60 + 25, 6 * 60 + 40);
      const nightGlow = Math.min(1, dusk + dawn);
      nightSpills.group.visible = nightGlow > 0.02;
      if (nightSpills.group.visible) {
        nightSpills.spillMat.opacity = nightGlow * 0.28;
        nightSpills.sconceMat.opacity = nightGlow * 0.58;
      }

      // 2) Wind-waving cloth flags (ripple faster during storms).
      const windSpeed = 4.2 + wet * 4.5;
      const windAmp = 0.09 + wet * 0.08;
      for (let f = 0; f < flagSystem.flags.length; f++) {
        const { mesh, basePos } = flagSystem.flags[f];
        const pos = mesh.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          const bx = basePos[i * 3];
          const by = basePos[i * 3 + 1];
          const wave = Math.sin(bx * 5.2 - clock * windSpeed + f * 1.9 + by * 1.4) * windAmp * bx;
          pos.setZ(i, wave);
        }
        pos.needsUpdate = true;
      }

      // 3) Gentle breeze sway on town tree canopies.
      if (!scannedTrees && scene?.children) {
        scannedTrees = true;
        for (const obj of scene.children) {
          if (obj.name === 'tree') {
            swayTrees.push({ obj, baseRx: obj.rotation.x, baseRz: obj.rotation.z, phase: (obj.position.x * 0.37 + obj.position.z * 0.53) });
          }
        }
      }
      const treeAmp = 0.011 + wet * 0.018;
      const treeFreq = 1.15 + wet * 0.85;
      for (let i = 0; i < swayTrees.length; i++) {
        const t = swayTrees[i];
        t.obj.rotation.z = t.baseRz + Math.sin(clock * treeFreq + t.phase) * treeAmp;
        t.obj.rotation.x = t.baseRx + Math.cos(clock * (treeFreq * 0.8) + t.phase * 1.3) * (treeAmp * 0.6);
      }

      // 4) Raindrop splash rings across wet surfaces near the player.
      splashMesh.visible = wet > 0.14;
      if (splashMesh.visible) {
        splashMat.opacity = Math.min(0.55, wet * 0.55);
        const px = playerPos ? playerPos.x : 0;
        const pz = playerPos ? playerPos.z : 0;
        for (let i = 0; i < splashCount; i++) {
          const sp = splashes[i];
          sp.phase += dt * sp.speed;
          if (sp.phase >= 1) {
            sp.phase %= 1;
            sp.ox = (rand() - 0.5) * 22;
            sp.oz = (rand() - 0.5) * 22;
          }
          const scale = 0.4 + sp.phase * 1.85;
          dummy.position.set(px + sp.ox, SURFACE_Y.road + 0.022, pz + sp.oz);
          dummy.rotation.set(0, 0, 0);
          dummy.scale.setScalar(scale);
          dummy.updateMatrix();
          splashMesh.setMatrixAt(i, dummy.matrix);
        }
        splashMesh.instanceMatrix.needsUpdate = true;
      }

      // 5) Occasional soft double-flicker sheet lightning during heavy rain.
      if (wet > 0.55) {
        if (clock >= nextLightningAt) {
          lightningTimer = 0.32;
          nextLightningAt = clock + 9 + rand() * 14;
        }
      }
      if (lightningTimer > 0) {
        lightningTimer = Math.max(0, lightningTimer - dt);
        const p = lightningTimer / 0.32;
        // Double-pulse sheet lightning envelope.
        const flash = (p > 0.65 ? Math.sin((p - 0.65) / 0.35 * Math.PI) : 0) +
          (p < 0.42 ? Math.sin((p / 0.42) * Math.PI) * 0.65 : 0);
        lightningLight.intensity = flash * 3.8 * wet;
      } else {
        lightningLight.intensity = 0;
      }
    }
  };
}
