import { worldAssets } from './assetLoading.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * Shared GLTFLoader instance for world models and characters.
 * Avoids spinning up a separate GLTFLoader per building or character file.
 */
let sharedLoader = null;

export function getGltfLoader() {
  if (!sharedLoader) sharedLoader = new GLTFLoader(worldAssets);
  return sharedLoader;
}

/**
 * Load a GLB/glTF asset through the shared loader.
 * Supports callback style `loadGltf(url, onLoad, onError)` or Promise style `loadGltf(url)`.
 */
export function loadGltf(url, onLoad, onError) {
  const loader = getGltfLoader();
  if (typeof onLoad === 'function') {
    loader.load(url, onLoad, undefined, onError);
    return null;
  }
  return new Promise((resolve, reject) => {
    loader.load(url, resolve, undefined, reject);
  });
}
