import * as THREE from 'three';
import { assetLoadState } from '../world/assetLoading.js';

const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve));
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function waitForAssets(progress, active, timeout = 15000) {
  const start = performance.now();
  let quietSince = start;
  let previous = -1;
  while (active() && performance.now() - start < timeout) {
    const { started, finished } = assetLoadState();
    if (started !== previous || finished < started) quietSince = performance.now();
    previous = started;
    progress(started ? finished / started : 1);
    if (performance.now() - quietSince >= 180) break;
    await delay(50);
  }
}

export async function warmOpening({renderer, scene, camera, paint, active, progress}) {
  await waitForAssets(value => progress(value*0.70), active);
  if (!active()) return;
  const target = new THREE.WebGLRenderTarget(256,112);
  const warmDraw = () => {
    const before = renderer.getRenderTarget();
    try {
      renderer.setRenderTarget(target);
      renderer.render(scene,camera);
    } finally { renderer.setRenderTarget(before); }
  };
  try {
    await Promise.race([renderer.compileAsync?.(scene,camera),delay(3000)]);
    for (const at of [2,11,20,29,39,48]) {
      if (!active()) return;
      paint(at, warmDraw);
      await nextFrame();
    }
    if (!active()) return;
    progress(0.94);
    const start = performance.now();
    let previous = start;
    let consecutive = 0;
    while (active() && consecutive < 20 && performance.now()-start < 3000) {
      const now = await nextFrame();
      if (!active()) return;
      paint(2, warmDraw);
      consecutive = now-previous < 22 ? consecutive+1 : 0;
      previous = now;
    }
    progress(1);
  } finally { target.dispose(); }
}
