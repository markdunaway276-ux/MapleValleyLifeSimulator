import { SETTINGS_DEFAULTS } from '../systems/settings.js';

export function setupInput(player, isMobile, { isInventoryOpen } = {}) {
  const keys = player.keys;
  const blocked = () => isInventoryOpen && isInventoryOpen();

  function clearMotion() {
    keys.forward = keys.back = keys.left = keys.right = keys.jump = keys.down = false;
    player.mouseX = 0;
    player.mouseY = 0;
    player.joystickX = 0;
    player.joystickY = 0;
  }
  window.addEventListener('inventory-open', clearMotion);
  window.addEventListener('debug-modal-open', clearMotion);
  window.addEventListener('sleep-start', clearMotion);
  window.addEventListener('phone-open', clearMotion);
  window.addEventListener('pause-open', clearMotion);


  if (isMobile) document.body.classList.add('mobile');

  const typing = (e) => !!(e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName));
  document.addEventListener('keydown', (e) => {
    if (blocked() || typing(e)) return;
    switch (e.code) {
      case 'KeyW': case 'ArrowUp': keys.forward = true; break;
      case 'KeyS': case 'ArrowDown': keys.back = true; break;
      case 'KeyA': case 'ArrowLeft': keys.left = true; break;
      case 'KeyD': case 'ArrowRight': keys.right = true; break;
      case 'Space': keys.jump = true; break;
      case 'KeyC': case 'ControlLeft': keys.down = true; break;
      // Ignore auto-repeat: holding E must not toggle doors / lights / TV over and over.
      case 'KeyE': if (!e.repeat) window.dispatchEvent(new Event('interact')); break;
    }
  });

  document.addEventListener('keyup', (e) => {
    switch (e.code) {
      case 'KeyW': case 'ArrowUp': keys.forward = false; break;
      case 'KeyS': case 'ArrowDown': keys.back = false; break;
      case 'KeyA': case 'ArrowLeft': keys.left = false; break;
      case 'KeyD': case 'ArrowRight': keys.right = false; break;
      case 'Space': keys.jump = false; break;
      case 'KeyC': case 'ControlLeft': keys.down = false; break;
    }
  });

  document.addEventListener('mousemove', (e) => {
    if (blocked()) return;
    if (document.pointerLockElement) {
      player.mouseX = e.movementX;
      player.mouseY = e.movementY;
    }
  });

  // Mobile: joystick + look
  if (isMobile) {
    const joystick = document.getElementById('joystick');
    const knob = document.getElementById('joystick-knob');
    let joystickTouch = null;
    let lookTouch = null;
    let lastLookX = 0, lastLookY = 0;

    const resetTouch = () => {
      joystickTouch = null;
      lookTouch = null;
      if (knob) {
        knob.style.left = '35px';
        knob.style.top = '35px';
      }
    };
    window.addEventListener('inventory-open', resetTouch);
    window.addEventListener('debug-modal-open', resetTouch);
    window.addEventListener('sleep-start', resetTouch);
    window.addEventListener('phone-open', resetTouch);
    window.addEventListener('pause-open', resetTouch);

    joystick.addEventListener('touchstart', (e) => {
      if (blocked()) return;
      e.preventDefault();
      if (joystickTouch !== null) return;
      const touch = e.changedTouches[0];
      joystickTouch = touch.identifier;
      updateJoystick(touch);
    });
    joystick.addEventListener('touchmove', (e) => {
      if (blocked()) return;
      e.preventDefault();
      for (const touch of e.changedTouches) {
        if (touch.identifier === joystickTouch) updateJoystick(touch);
      }
    });

    function releaseJoystick(e) {
      for (const touch of e.changedTouches) {
        if (touch.identifier !== joystickTouch) continue;
        joystickTouch = null;
        player.joystickX = 0;
        player.joystickY = 0;
        knob.style.left = '35px';
        knob.style.top = '35px';
      }
    }
    joystick.addEventListener('touchend', releaseJoystick);
    joystick.addEventListener('touchcancel', releaseJoystick);

    function updateJoystick(touch) {
      const rect = joystick.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let dx = touch.clientX - cx;
      let dy = touch.clientY - cy;
      const max = 40;
      const dist = Math.min(Math.hypot(dx, dy), max);
      const angle = Math.atan2(dy, dx);
      dx = Math.cos(angle) * dist;
      dy = Math.sin(angle) * dist;
      knob.style.left = (35 + dx) + 'px';
      knob.style.top = (35 + dy) + 'px';
      player.joystickX = dx / max;
      player.joystickY = -dy / max;
    }

    document.addEventListener('touchstart', (e) => {
      if (blocked()) return;
      if (e.target.closest && e.target.closest('#inventory, #inventory-toggle, #interact-prompt, #hud-screenshot, #phone, .debug-ui, .hud-ui')) return;
      if (e.target === joystick || joystick.contains(e.target)) return;
      if (lookTouch !== null) return;
      const touch = e.changedTouches[0];
      lookTouch = touch.identifier;
      lastLookX = touch.clientX;
      lastLookY = touch.clientY;
    });
    document.addEventListener('touchmove', (e) => {
      if (blocked()) return;
      for (const t of e.changedTouches) {
        if (t.identifier === lookTouch) {
          const swipeGain = player.touchLookSpeed ?? SETTINGS_DEFAULTS.touchLookSpeed;
          player.mouseX += (t.clientX - lastLookX) * swipeGain;
          player.mouseY += (t.clientY - lastLookY) * swipeGain;
          lastLookX = t.clientX;
          lastLookY = t.clientY;
        }
      }
    });
    function releaseLook(e) {
      for (const t of e.changedTouches) {
        if (t.identifier === lookTouch) lookTouch = null;
      }
    }
    document.addEventListener('touchend', releaseLook);
    document.addEventListener('touchcancel', releaseLook);
  }
}
