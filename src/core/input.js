export function setupInput(player, isMobile, { isInventoryOpen } = {}) {
  const keys = player.keys;
  const blocked = () => isInventoryOpen && isInventoryOpen();

  function clearMotion() {
    keys.forward = keys.back = keys.left = keys.right = keys.jump = false;
    player.mouseX = 0;
    player.mouseY = 0;
    player.joystickX = 0;
    player.joystickY = 0;
  }
  window.addEventListener('inventory-open', clearMotion);
  window.addEventListener('debug-modal-open', clearMotion);


  if (isMobile) document.body.classList.add('mobile');

  document.addEventListener('keydown', (e) => {
    if (blocked()) return;
    switch (e.code) {
      case 'KeyW': case 'ArrowUp': keys.forward = true; break;
      case 'KeyS': case 'ArrowDown': keys.back = true; break;
      case 'KeyA': case 'ArrowLeft': keys.left = true; break;
      case 'KeyD': case 'ArrowRight': keys.right = true; break;
      case 'Space': keys.jump = true; break;
      case 'KeyE': window.dispatchEvent(new Event('interact')); break;
    }
  });

  document.addEventListener('keyup', (e) => {
    switch (e.code) {
      case 'KeyW': case 'ArrowUp': keys.forward = false; break;
      case 'KeyS': case 'ArrowDown': keys.back = false; break;
      case 'KeyA': case 'ArrowLeft': keys.left = false; break;
      case 'KeyD': case 'ArrowRight': keys.right = false; break;
      case 'Space': keys.jump = false; break;
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
    let joystickActive = false;
    let lookTouch = null;
    let lastLookX = 0, lastLookY = 0;

    const resetTouch = () => {
      joystickActive = false;
      lookTouch = null;
      if (knob) {
        knob.style.left = '35px';
        knob.style.top = '35px';
      }
    };
    window.addEventListener('inventory-open', resetTouch);
    window.addEventListener('debug-modal-open', resetTouch);

    joystick.addEventListener('touchstart', (e) => {
      if (blocked()) return;
      e.preventDefault();
      joystickActive = true;
      updateJoystick(e.touches[0]);
    });
    joystick.addEventListener('touchmove', (e) => {
      if (blocked()) return;
      e.preventDefault();
      if (joystickActive) updateJoystick(e.touches[0]);
    });
    joystick.addEventListener('touchend', () => {
      joystickActive = false;
      player.joystickX = 0;
      player.joystickY = 0;
      knob.style.left = '35px';
      knob.style.top = '35px';
    });

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
      if (e.target.closest && e.target.closest('#inventory, #inventory-toggle, #interact-prompt, .debug-ui')) return;
      if (e.target === joystick || joystick.contains(e.target)) return;
      if (e.touches.length === 1) {
        lookTouch = e.touches[0].identifier;
        lastLookX = e.touches[0].clientX;
        lastLookY = e.touches[0].clientY;
      }
    });
    document.addEventListener('touchmove', (e) => {
      if (blocked()) return;
      for (const t of e.changedTouches) {
        if (t.identifier === lookTouch) {
          player.mouseX = t.clientX - lastLookX;
          player.mouseY = t.clientY - lastLookY;
          lastLookX = t.clientX;
          lastLookY = t.clientY;
        }
      }
    });
    document.addEventListener('touchend', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === lookTouch) lookTouch = null;
      }
    });
  }
}
