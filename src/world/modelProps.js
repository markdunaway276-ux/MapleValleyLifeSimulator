import * as THREE from 'three';
import { loadGltf } from './gltf.js';

/**
 * Reusable loader & placement helper for CC0/CC-BY `.glb` props (interior
 * furniture, outdoor street/park props, etc.). Caches parsed GLTF scenes per
 * URL so repeated props (e.g. dining chairs, benches) only download once,
 * automatically grounds each model at y = 0, fits it cleanly into its target
 * footprint without stretching, and safely no-ops in headless Node tests.
 */

const sceneCache = new Map();

function canLoadInBrowser() {
  return typeof document !== 'undefined' && typeof Image !== 'undefined';
}

function loadCachedScene(url) {
  if (!sceneCache.has(url)) {
    const p = loadGltf(url).then((gltf) => {
      const root = gltf?.scene || gltf?.scenes?.[0];
      if (!root) throw new Error(`Empty GLTF scene: ${url}`);
      return root;
    }).catch((err) => {
      sceneCache.delete(url);
      throw err;
    });
    sceneCache.set(url, p);
  }
  return sceneCache.get(url);
}

/**
 * Loads `url`, clones it, normalizes its base to y = 0 and XZ center to (0, 0),
 * scales uniformly to fit `fitSize` (or `targetHeight`), positions it at
 * `(x, y, z)` with rotation `rotY`, and appends it to `parent`.
 *
 * If `hideOnLoad` is provided (an Object3D or array of Object3Ds), those
 * procedural fallback objects are hidden once the real GLB is attached.
 */
export function placeGltfProp(parent, url, {
  name = '',
  x = 0,
  y = 0,
  z = 0,
  rotY = 0,
  fitSize = null,
  targetHeight = null,
  scale = 1,
  shadows = false,
  hideOnLoad = null,
  onLoaded = null
} = {}) {
  if (!parent || !url || !canLoadInBrowser()) return null;

  const holder = new THREE.Group();
  if (name) holder.name = name;
  holder.position.set(x, y, z);
  holder.rotation.y = rotY;
  parent.add(holder);

  loadCachedScene(url).then((srcScene) => {
    const clone = srcScene.clone(true);
    clone.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(clone);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    let s = scale;
    if (Array.isArray(fitSize) && fitSize.length === 3) {
      const ratios = [];
      if (fitSize[0] > 0 && size.x > 1e-4) ratios.push(fitSize[0] / size.x);
      if (fitSize[1] > 0 && size.y > 1e-4) ratios.push(fitSize[1] / size.y);
      if (fitSize[2] > 0 && size.z > 1e-4) ratios.push(fitSize[2] / size.z);
      if (ratios.length) s = Math.min(...ratios) * scale;
    } else if (typeof targetHeight === 'number' && targetHeight > 0 && size.y > 1e-4) {
      s = (targetHeight / size.y) * scale;
    }

    clone.scale.setScalar(s);
    clone.position.set(-center.x * s, -box.min.y * s, -center.z * s);
    clone.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = !!shadows;
        child.receiveShadow = !!shadows;
      }
    });

    holder.add(clone);

    if (hideOnLoad) {
      const list = Array.isArray(hideOnLoad) ? hideOnLoad : [hideOnLoad];
      for (const obj of list) {
        if (obj) obj.visible = false;
      }
    }
    if (typeof onLoaded === 'function') onLoaded(holder, clone);
  }).catch(() => {
    // Keep procedural fallback visible if GLB fails to load.
  });

  return holder;
}
