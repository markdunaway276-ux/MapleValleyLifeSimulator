import * as THREE from 'three';
import { Parts } from './parts.js';
import { STREET, SURFACE_Y } from './street.js';
import { hash2, tileNoise } from './textures.js';

function surfaceTexture(type, quality) {
  const size = quality.shadows ? 256 : 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d');
  const pixels = context.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const grain = (hash2(x, y, 14) - 0.5) * 19;
      let tone;
      if (type === 'siding') {
        const board = (v * 8) % 1;
        tone = 224 + 13 * board - (board < 0.1 ? 43 : 0)
          + 24 * (tileNoise(u * 4, v * 28, 4, 28, 11) - 0.5);
      } else if (type === 'roof') {
        const row = Math.floor(v * 8);
        const column = u * 5 + (row % 2) * 0.5;
        const joint = column % 1;
        tone = 213 + 37 * hash2(Math.floor(column) % 5, row, 22)
          - ((v * 8) % 1 < 0.13 ? 43 : 0) - (joint < 0.06 ? 34 : 0);
      } else if (type === 'trim') {
        tone = 242 + 19 * (tileNoise(u * 3, v * 18, 3, 18, 17) - 0.5);
      } else {
        tone = 217 + 20 * (tileNoise(u * 8, v * 8, 8, 8, 31) - 0.5)
          - (u < 0.025 || v < 0.07 ? 44 : 0);
      }
      const offset = (y * size + x) * 4;
      pixels.data.fill(tone + grain, offset, offset + 3);
      pixels.data[offset + 3] = 255;
    }
  }
  context.putImageData(pixels, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = quality.shadows ? 4 : 2;
  return texture;
}

export function textureHouseExterior(model, quality) {
  const surfaces = {
    _defaultMat: { type: 'siding', width: 3.2, height: 1.45 },
    roof: { type: 'roof', width: 1.65, height: 1.65 },
    border: { type: 'trim', width: 1.4, height: 0.7 }
  };
  model.traverse((mesh) => {
    const surface = surfaces[mesh.material?.name];
    if (!mesh.isMesh || !surface) return;
    const { position, normal } = mesh.geometry.attributes;
    const uv = new Float32Array(position.count * 2);
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i) * model.scale.x;
      const y = position.getY(i) * model.scale.y;
      const z = position.getZ(i) * model.scale.z;
      const sideways = Math.abs(normal.getX(i)) > Math.abs(normal.getZ(i));
      const horizontal = Math.abs(normal.getY(i)) > 0.25;
      uv[2 * i] = (sideways ? z : x) / surface.width;
      uv[2 * i + 1] = (horizontal ? (sideways ? x : z) : y) / surface.height;
    }
    mesh.geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    mesh.material.map = surfaceTexture(surface.type, quality);
    mesh.material.needsUpdate = true;
  });
}

export function buildFrontYard(door, quality, lightPool = null) {
  const group = new THREE.Group();
  group.name = 'main-house-front-yard';
  const sidewalk = STREET.roadCenterZ - STREET.roadWidth / 2 - STREET.sidewalkWidth;
  const length = sidewalk - door.z;
  const stone = surfaceTexture('stone', quality);
  const paving = new THREE.Mesh(
    new THREE.PlaneGeometry(1.34, length),
    new THREE.MeshStandardMaterial({ map: stone, color: 0xa79d8a, roughness: 0.94 })
  );
  stone.repeat.set(1, Math.max(1, Math.round(length / 0.48)));
  paving.rotation.x = -Math.PI / 2;
  paving.position.set(door.x, SURFACE_Y.walk - 0.004, sidewalk - length / 2);
  paving.receiveShadow = quality.shadows;
  group.add(paving);

  const parts = new Parts(true);
  parts.bevelMax = 0;
  parts.surface('stone');
  parts.box(0x9e9380, 1.36, 0.047, 0.32, door.x, 0.024, door.z + 0.31);
  for (const side of [-1, 1]) {
    const bedX = door.x + side * 2.55;
    const bedZ = door.z + 0.15;
    parts.surface('woodRaw');
    parts.box(0x544032, 2.18, 0.055, 0.46, bedX, 0.025, bedZ);
    parts.box(0x847568, 2.22, 0.085, 0.06, bedX, 0.042, bedZ + 0.22);
    parts.surface('paint');
    for (let i = 0; i < 25; i++) {
      const x = door.x + side * (0.79 + hash2(i, side, 48) * 3.5);
      const z = sidewalk - 0.035 - hash2(i, side, 51) * 0.26;
      const h = 0.037 + hash2(i, side, 64) * 0.07;
      parts.box(i % 4 ? 0x586943 : 0x7c8050, 0.028, h, 0.02, x, h / 2, z, 0.32, i, -0.22);
    }
    for (let i = 0; i < 19; i++) {
      const x = bedX - 1 + hash2(i, side, 34) * 2;
      const z = bedZ - 0.13 + hash2(i, side, 91) * 0.27;
      const h = 0.1 + hash2(i, side, 7) * 0.21;
      parts.box(i % 3 ? 0x607448 : 0x899657, 0.032, h, 0.026, x, h / 2 + 0.05, z, 0.25, i, 0.24);
      if (i % 3 === 0) {
        parts.box(side < 0 ? 0xcc9b74 : 0xba8790, 0.075, 0.055, 0.066, x + 0.025, h + 0.04, z - 0.03, 0, i);
      }
    }
  }

  const lampX = door.x - 0.92;
  const lampY = 1.77;
  const lampZ = door.z + 0.12;
  parts.surface('metal');
  parts.box(0x3d3834, 0.15, 0.29, 0.07, lampX, lampY, lampZ);
  for (const cap of [-1, 1]) {
    parts.box(0x38322b, 0.21, 0.06, 0.18, lampX, lampY + cap * 0.12, lampZ + 0.08);
  }
  const details = new THREE.Mesh(parts.merge(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88 }));
  details.receiveShadow = quality.shadows;
  group.add(details);

  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(0.15, 0.19, 0.13),
    new THREE.MeshStandardMaterial({ color: 0xb09b76, emissive: 0xffb066, emissiveIntensity: 0, roughness: 0.62 })
  );
  glass.position.set(lampX, lampY, lampZ + 0.08);
  group.add(glass);

  let porchLight;
  if (lightPool) {
    porchLight = lightPool.addPoint({
      x: lampX + 0.27, y: lampY - 0.13, z: lampZ + 0.48,
      color: 0xffba78, intensity: 0, distance: 4.3, decay: 2
    });
  } else {
    porchLight = new THREE.PointLight(0xffba78, 0, 4.3);
    porchLight.position.set(lampX + 0.27, lampY - 0.13, lampZ + 0.48);
    group.add(porchLight);
  }

  return {
    group,
    update(totalMinutes) {
      const hour = ((totalMinutes / 60) % 24 + 24) % 24;
      const daylight = THREE.MathUtils.smoothstep(hour, 5.5, 7.5)
        * (1 - THREE.MathUtils.smoothstep(hour, 17.5, 20));
      const brightness = 1 - daylight;
      glass.material.emissiveIntensity = brightness * 1.45;
      porchLight.intensity = brightness * 13;
    }
  };
}
