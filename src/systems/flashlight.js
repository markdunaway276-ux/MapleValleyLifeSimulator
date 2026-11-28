import * as THREE from 'three';

/**
 * Handheld Field Flashlight attached to the first-person camera.
 * Toggle with the F key (or from the Bag) once the player owns `flashlight`.
 */

export function createFlashlight({
  camera = null,
  inventory = null,
  sfx = null,
  toast = () => {},
  isAllowed = () => true
} = {}) {
  let on = false;
  let light = null;
  let target = null;

  if (camera) {
    light = new THREE.SpotLight(0xfff1d2, 0, 26, Math.PI * 0.24, 0.45, 1.4);
    light.position.set(0.18, -0.14, -0.15);
    target = new THREE.Object3D();
    target.position.set(0, -0.05, -8);
    camera.add(light);
    camera.add(target);
    light.target = target;
  }

  function hasFlashlight() {
    if (!inventory) return true;
    const items = typeof inventory.getItems === 'function' ? inventory.getItems() : [];
    return items.some((it) => it && it.id === 'flashlight');
  }

  function setOn(next, { silent = false } = {}) {
    if (next && !hasFlashlight()) {
      if (!silent) toast('You need a flashlight first — ask Walt once Chapter 3 starts!');
      return false;
    }
    on = !!next;
    if (light) light.intensity = on ? 6.5 : 0;
    if (!silent) {
      sfx?.play?.('click');
      toast(on ? 'Flashlight ON [F]' : 'Flashlight OFF');
    }
    return on;
  }

  function toggle() {
    return setOn(!on);
  }

  function onKeyDown(e) {
    if (e.code !== 'KeyF' || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target?.closest?.('input, textarea, select, [contenteditable]')) return;
    if (!isAllowed() || !hasFlashlight()) return;
    e.preventDefault();
    toggle();
  }

  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('keydown', onKeyDown);
  }

  return {
    isOn: () => on,
    hasFlashlight,
    setOn,
    toggle,
    dispose() {
      if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
        window.removeEventListener('keydown', onKeyDown);
      }
      if (light && light.parent) light.parent.remove(light);
      if (target && target.parent) target.parent.remove(target);
    }
  };
}
