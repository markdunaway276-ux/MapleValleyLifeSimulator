import * as THREE from 'three';
import { getOptionColor } from '../data/appearance.js';

/**
 * Shared 3D wearable accessories (cap, beanie, glasses, backpack) and
 * MakeHuman outfit color tinting used by both the live player rig
 * (`playerRig.js`) and the Phone Style 3D character viewer (`style.js`).
 */

/** Maps Style app `outfit` option IDs to CUSTOM_BODIES keys in characterModel.js. */
export const OUTFIT_BODIES = Object.freeze({
  casual: 'surviver',
  workwear: 'clerk',
  street: 'sam',
  cozy: 'june',
  classic: 'dottie'
});

export function outfitToBody(outfitId) {
  return OUTFIT_BODIES[outfitId] || 'surviver';
}

/**
 * Applies Skin, Shirt, Pants, Hair, and Shoes colors from `look` onto any
 * loaded character model (both Quaternius shader-painted bodies and custom
 * MakeHuman/MPFB clothed meshes).
 */
export function applyAppearanceToModel(root, look) {
  if (!root || !look) return;
  const shirtHex = getOptionColor('shirt', look.shirt);
  const pantsHex = getOptionColor('pants', look.pants);
  const skinHex = getOptionColor('skin', look.skin);
  const hairHex = getOptionColor('hair', look.hair);
  const shoesHex = getOptionColor('shoes', look.shoes);

  // Compute model Y bounds once for splitting single-mesh suits into shirt vs pants.
  const box = new THREE.Box3().setFromObject(root);
  const minY = Number.isFinite(box.min.y) ? box.min.y : 0;
  const height = Math.max(0.5, (box.max.y - minY) || 1.7);
  const waistY = minY + height * 0.52;

  root.traverse((mesh) => {
    if (!mesh.isMesh || !mesh.material) return;
    if (mesh.userData?.isAccessory) return;
    const mat = mesh.material;
    const name = `${mesh.name || ''} ${mat.name || ''}`.toLowerCase();

    // 1. Quaternius shader-painted bodies
    const clothes = mat.userData?.clothes;
    if (clothes) {
      clothes.cShirt?.value.set(shirtHex);
      clothes.cPants?.value.set(pantsHex);
      clothes.cSkin?.value.set(skinHex);
      clothes.cShoes?.value.set(shoesHex);
      return;
    }

    // 2. MakeHuman hair / eyebrows
    if (/hair|braid|bob|ponytail|short|eyebrow/.test(name)) {
      if (mat.color) mat.color.set(hairHex);
      return;
    }

    // 3. MakeHuman shoes / boots
    if (/shoe|boot|sneaker|foot/.test(name)) {
      if (mat.color) mat.color.set(shoesHex);
      return;
    }

    // 4. MakeHuman pants / trousers / jeans / skirt
    if (/pant|jean|trouser|skirt|short_pant/.test(name)) {
      if (mat.color) mat.color.set(pantsHex);
      return;
    }

    // 5. MakeHuman top / shirt / jacket / sweater / coat / vest
    if (/shirt|jacket|sweater|coat|vest|hoodie|top|blouse|tshirt/.test(name)) {
      if (mat.color) mat.color.set(shirtHex);
      return;
    }

    // 6. Full-body MakeHuman suit mesh (e.g. female_casualsuit02): tint shirt vs pants
    // softly via a lightweight vertex-height shader uniform so both swatches work!
    if (/suit|outfit|clothes|dress/.test(name)) {
      if (!mat.userData.suitSplit) {
        const uShirt = { value: new THREE.Color(shirtHex) };
        const uPants = { value: new THREE.Color(pantsHex) };
        const uWaist = { value: waistY };
        const prev = mat.onBeforeCompile;
        mat.onBeforeCompile = (shader, renderer) => {
          if (prev) prev(shader, renderer);
          shader.uniforms.uSuitShirt = uShirt;
          shader.uniforms.uSuitPants = uPants;
          shader.uniforms.uSuitWaist = uWaist;
          shader.vertexShader = shader.vertexShader
            .replace('#include <common>', '#include <common>\nvarying float vSuitLocalY;')
            .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSuitLocalY = position.y;');
          shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', '#include <common>\nvarying float vSuitLocalY;\nuniform vec3 uSuitShirt;\nuniform vec3 uSuitPants;\nuniform float uSuitWaist;')
            .replace('#include <color_fragment>', `#include <color_fragment>
              float suitTop = smoothstep(uSuitWaist - 0.06, uSuitWaist + 0.06, vSuitLocalY);
              vec3 suitTint = mix(uSuitPants, uSuitShirt, suitTop);
              diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * suitTint * 1.35, 0.72);`);
        };
        mat.customProgramCacheKey = () => 'makehuman-suit-split-v1';
        mat.userData.suitSplit = { uShirt, uPants, uWaist };
        mat.needsUpdate = true;
      } else {
        mat.userData.suitSplit.uShirt.value.set(shirtHex);
        mat.userData.suitSplit.uPants.value.set(pantsHex);
      }
    }
  });
}

function buildCap(accentHex, shadows) {
  const g = new THREE.Group();
  g.name = 'acc-cap';
  const mat = new THREE.MeshStandardMaterial({ color: accentHex, roughness: 0.78 });
  const brimMat = new THREE.MeshStandardMaterial({ color: 0x1f242c, roughness: 0.82 });
  const crown = new THREE.Mesh(new THREE.SphereGeometry(0.112, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.56), mat);
  crown.scale.set(1.0, 0.92, 1.08);
  crown.position.set(0, 0.075, -0.005);
  const brim = new THREE.Mesh(new THREE.BoxGeometry(0.165, 0.014, 0.115), brimMat);
  brim.position.set(0, 0.078, 0.105);
  brim.rotation.x = 0.08;
  const button = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), brimMat);
  button.position.set(0, 0.175, -0.005);
  g.add(crown, brim, button);
  g.traverse((o) => {
    if (o.isMesh) {
      o.userData.isAccessory = true;
      o.castShadow = !!shadows;
    }
  });
  return g;
}

function buildBeanie(accentHex, shadows) {
  const g = new THREE.Group();
  g.name = 'acc-beanie';
  const knitMat = new THREE.MeshStandardMaterial({ color: accentHex, roughness: 0.94 });
  const cuffMat = new THREE.MeshStandardMaterial({ color: accentHex, roughness: 0.96 });
  cuffMat.color.multiplyScalar(0.84);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.115, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), knitMat);
  dome.scale.set(1.0, 1.06, 1.06);
  dome.position.set(0, 0.075, -0.01);
  const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.106, 0.024, 8, 20), cuffMat);
  cuff.rotation.x = Math.PI / 2;
  cuff.position.set(0, 0.076, -0.008);
  const pom = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 8), cuffMat);
  pom.position.set(0, 0.205, -0.02);
  g.add(dome, cuff, pom);
  g.traverse((o) => {
    if (o.isMesh) {
      o.userData.isAccessory = true;
      o.castShadow = !!shadows;
    }
  });
  return g;
}

function buildGlasses(shadows) {
  const g = new THREE.Group();
  g.name = 'acc-glasses';
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x222022, roughness: 0.35, metalness: 0.55 });
  const lensMat = new THREE.MeshStandardMaterial({
    color: 0xb8d4e8, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.32
  });
  for (const sx of [-0.036, 0.036]) {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.004, 8, 18), frameMat);
    rim.position.set(sx, 0.036, 0.098);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.022, 14), lensMat);
    lens.position.set(sx, 0.036, 0.097);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.005, 0.11), frameMat);
    arm.position.set(sx + (sx < 0 ? -0.022 : 0.022), 0.040, 0.044);
    g.add(rim, lens, arm);
  }
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.005, 0.005), frameMat);
  bridge.position.set(0, 0.040, 0.098);
  g.add(bridge);
  g.traverse((o) => {
    if (o.isMesh) {
      o.userData.isAccessory = true;
      o.castShadow = !!shadows;
    }
  });
  return g;
}

function buildBackpack(accentHex, shadows) {
  const g = new THREE.Group();
  g.name = 'acc-backpack';
  const bagMat = new THREE.MeshStandardMaterial({ color: accentHex, roughness: 0.86 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x2a2420, roughness: 0.78 });
  const main = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.38, 0.14), bagMat);
  main.position.set(0, 0.02, -0.15);
  const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.05), trimMat);
  pocket.position.set(0, -0.07, -0.23);
  const flap = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.06, 0.15), trimMat);
  flap.position.set(0, 0.20, -0.15);
  for (const sx of [-0.10, 0.10]) {
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.34, 0.16), trimMat);
    strap.position.set(sx, 0.03, -0.06);
    g.add(strap);
  }
  g.add(main, pocket, flap);
  g.traverse((o) => {
    if (o.isMesh) {
      o.userData.isAccessory = true;
      o.castShadow = !!shadows;
    }
  });
  return g;
}

/**
 * Attaches/updates the active wearable accessory (`cap`, `beanie`, `glasses`,
 * `backpack`, or `none`) on a rigged character's skeleton. Returns the list of
 * head-mounted accessory objects so first-person mode can hide them cleanly.
 */
export function attachAccessories(root, accessoryId, { shirtColor = '#4a90d9', shadows = false } = {}) {
  if (!root) return { headAccessories: [], cleanup: () => {} };
  const headBone = root.getObjectByName('Head') || root.getObjectByName('head') || root.getObjectByName('neck02');
  const spineBone = root.getObjectByName('spine_03') || root.getObjectByName('spine_02') || root.getObjectByName('spine_01');

  // Remove any previously mounted accessories.
  for (const bone of [headBone, spineBone]) {
    if (!bone) continue;
    const prev = bone.getObjectByName('maple-accessory-mount');
    if (prev) prev.removeFromParent();
  }

  const headAccessories = [];
  if (!accessoryId || accessoryId === 'none') {
    return { headAccessories, cleanup: () => {} };
  }

  if (headBone && (accessoryId === 'cap' || accessoryId === 'beanie' || accessoryId === 'glasses')) {
    const mount = new THREE.Group();
    mount.name = 'maple-accessory-mount';
    const item = accessoryId === 'cap'
      ? buildCap(shirtColor, shadows)
      : accessoryId === 'beanie'
        ? buildBeanie(shirtColor, shadows)
        : buildGlasses(shadows);
    mount.add(item);
    headBone.add(mount);
    headAccessories.push(mount);
  } else if (spineBone && accessoryId === 'backpack') {
    const mount = new THREE.Group();
    mount.name = 'maple-accessory-mount';
    mount.add(buildBackpack(shirtColor, shadows));
    spineBone.add(mount);
  }

  return {
    headAccessories,
    cleanup() {
      for (const bone of [headBone, spineBone]) {
        const prev = bone?.getObjectByName('maple-accessory-mount');
        if (prev) prev.removeFromParent();
      }
    }
  };
}
