import * as THREE from 'three';

export function createPlayer(camera, scene) {
  const player = {
    position: new THREE.Vector3(0, 1.6, -2.9),
    velocity: new THREE.Vector3(),
    rotation: new THREE.Euler(0, 0, 0, 'YXZ'),
    speed: 4.5,
    jumpSpeed: 6,
    onGround: true,
    keys: { forward: false, back: false, left: false, right: false, jump: false },
    mouseX: 0,
    mouseY: 0,
    joystickX: 0,
    joystickY: 0
  };

  camera.position.copy(player.position);
  scene.add(camera);

  player.update = function(delta) {
    // Rotation
    this.rotation.y -= this.mouseX * 0.002;
    this.rotation.x -= this.mouseY * 0.002;
    this.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.rotation.x));
    camera.quaternion.setFromEuler(this.rotation);
    this.mouseX = 0;
    this.mouseY = 0;

    // Movement
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    forward.y = 0; right.y = 0;
    forward.normalize(); right.normalize();

    const move = new THREE.Vector3();
    if (this.keys.forward) move.add(forward);
    if (this.keys.back) move.sub(forward);
    if (this.keys.left) move.sub(right);
    if (this.keys.right) move.add(right);

    // Joystick override
    if (Math.abs(this.joystickX) > 0.1 || Math.abs(this.joystickY) > 0.1) {
      move.set(0, 0, 0);
      move.add(right.clone().multiplyScalar(this.joystickX));
      move.add(forward.clone().multiplyScalar(this.joystickY));
    }

    if (move.length() > 0) move.normalize().multiplyScalar(this.speed * delta);

    // Simple gravity + jump
    this.velocity.y -= 20 * delta;
    if (this.keys.jump && this.onGround) {
      this.velocity.y = this.jumpSpeed;
      this.onGround = false;
    }
    this.position.y += this.velocity.y * delta;
    if (this.position.y < 1.6) {
      this.position.y = 1.6;
      this.velocity.y = 0;
      this.onGround = true;
    }

    this.position.add(move);
    camera.position.copy(this.position);
  };

  return player;
}
