export function setupInput(player, isMobile) {
  const keys = player.keys;

  document.addEventListener('keydown', (e) => {
    switch (e.code) {
      case 'KeyW': case 'ArrowUp': keys.forward = true; break;
      case 'KeyS': case 'ArrowDown': keys.back = true; break;
      case 'KeyA': case 'ArrowLeft': keys.left = true; break;
      case 'KeyD': case 'ArrowRight': keys.right = true; break;
    }
  });

  document.addEventListener('keyup', (e) => {
    switch (e.code) {
      case 'KeyW': case 'ArrowUp': keys.forward = false; break;
      case 'KeyS': case 'ArrowDown': keys.back = false; break;
      case 'KeyA': case 'ArrowLeft': keys.left = false; break;
      case 'KeyD': case 'ArrowRight': keys.right = false; break;
    }
  });

  document.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement) {
      player.mouseX = e.movementX;
      player.mouseY = e.movementY;
    }
  });

  // Basic touch support (drag to look, on-screen buttons can be added later)
  if (isMobile) {
    let lastX = 0, lastY = 0, touching = false;
    document.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;
        touching = true;
      }
    });
    document.addEventListener('touchmove', (e) => {
      if (touching && e.touches.length === 1) {
        const dx = e.touches[0].clientX - lastX;
        const dy = e.touches[0].clientY - lastY;
        player.mouseX = dx * 2;
        player.mouseY = dy * 2;
        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;
        e.preventDefault();
      }
    }, { passive: false });
    document.addEventListener('touchend', () => { touching = false; });
  }
}
