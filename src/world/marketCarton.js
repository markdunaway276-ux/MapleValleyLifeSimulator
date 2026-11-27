import * as THREE from 'three';

// Long Life Food by Mia Pecina Zorko / Poly Haven (CC0).
// https://polyhaven.com/a/long_life_food
// Carton mesh extracted for Career Simulator, resized for Corner Market and re-labeled.
const CARTON_DATA = ["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IvfvPlMkYj8AAAAAEGBlu57cNT7D7Xu/v7pPP0idFT8AAAAAEGBlu57cNT7D7Xu/","AAAIABwABQABAB0ABQAdACYABgACABUABgAVABgAAAAEABoAAAAaABEADQALACEADQAhACQADgAEACUACgACAB8AAwAHACMAAwAjACAACQAPACcACQAnAB4ABgAMACIARwAqAC0ARwAtAEMANwA7AD8ANwA/ADMATgBEAEEATgBBAFAAUQA0ADEAUQAxAFIACAAAABEACAARACkADwAJACgADwAoAEUAUQBIABMAUQATADQAAgAKADYAAgA2ABUACwANADkACwA5ADUATgBLABkATgAZAEQADAAGABgADAAYADoABAAOAEYABABGABoAOAAXAEsAOABLAE4AKwASAEgAKwBIAFEAKwBRAFIAKwBSAC4AOABOAFAAOABQAD0AdQBeAGEAdQBhAHMAXwBwAG0AXwBtAGMAeQBlAGkAeQBpAHcAZgBZAFcAZgBXAGoAXAB1AHMAXABzAFgAbwB5AHcAbwB3AGwAVgByAHYAVgB2AGgAZwBCACwAZwAsAFoALwBTAHQALwB0AFsAXQB0AFMAXQBTADAAcgBiAGsAcgBrAHYAYAAyAD4AYAA+AHEAZAB4AE8AZABPAEAAbgA8AE8AbgBPAHgAkgB9AIEAkgCBAJYAlgCBAH8AlgB/AJgAmAB/AHsAmAB7AJQAiwCFAIkAiwCJAI8AjwCJAIcAjwCHAJEAkQCHAIMAkQCDAI0ATQBJABAAEAB6AH4AfgCAAHwAfABNABAAEAB+AHwAEQAaAJQAEQCUAHsATAB9AJIATACSAFUAgwBMAFUAgwBVAI0AGAAVAIUAGACFAIsAlQAbAEoASgBUAJMAkwCXAJkAmQCVAEoASgCTAJkAFABJAE0ATQCCAIYAhgCIAIQAhAAUAE0ATQCGAIQASgAWAIoAigCOAJAAkACMAFQAVABKAIoAigCQAFQA"];

export function importedCartonGeometry(width, height, depth) {
  const decode = (type, data) => new type(Uint8Array.from(atob(data), c => c.charCodeAt(0)).buffer);
  const source = decode(Float32Array, CARTON_DATA[0]);
  const normals = decode(Float32Array, CARTON_DATA[1]);
  const indices = decode(Uint16Array, CARTON_DATA[2]);
  const bounds = new THREE.Box3().setFromArray(source);
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const points = new Float32Array(indices.length * 3);
  const shading = new Float32Array(indices.length * 3);
  const uv = new Float32Array(indices.length * 2);
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i] * 3;
    const b = indices[i + 1] * 3;
    const c = indices[i + 2] * 3;
    const nx = normals[a] + normals[b] + normals[c];
    const ny = normals[a + 1] + normals[b + 1] + normals[c + 1];
    const nz = normals[a + 2] + normals[b + 2] + normals[c + 2];
    const cap = Math.abs(ny) > 0.55;
    for (let j = i; j < i + 3; j++) {
      const k = indices[j] * 3;
      const x = (source[k] - center.x) / size.x;
      const y = (source[k + 1] - center.y) / size.y;
      const z = (source[k + 2] - center.z) / size.z;
      points.set([x * width, y * height, z * depth], j * 3);
      const sx = normals[k] * size.x / width;
      const sy = normals[k + 1] * size.y / height;
      const sz = normals[k + 2] * size.z / depth;
      const length = Math.hypot(sx, sy, sz) || 1;
      shading.set([sx / length, sy / length, sz / length], j * 3);
      const u = Math.abs(nx) >= Math.abs(nz) ? (nx > 0 ? -z : z) : (nz > 0 ? x : -x);
      uv.set(cap ? [0.025, 0.025] : [0.5 + u * 0.97, 0.5 + y * 0.98], j * 2);
    }
  }
  const mesh = new THREE.BufferGeometry();
  mesh.setAttribute('position', new THREE.BufferAttribute(points, 3));
  mesh.setAttribute('normal', new THREE.BufferAttribute(shading, 3));
  mesh.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return mesh;
}
