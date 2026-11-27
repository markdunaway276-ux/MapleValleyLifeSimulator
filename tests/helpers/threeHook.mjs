const threeUrl = new URL('../../vendor/three/build/three.module.js', import.meta.url).href;
const addonsBase = new URL('../../vendor/three/examples/jsm/', import.meta.url).href;

export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'three') {
    return { url: threeUrl, shortCircuit: true };
  }
  if (specifier.startsWith('three/addons/')) {
    return { url: addonsBase + specifier.slice('three/addons/'.length), shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
