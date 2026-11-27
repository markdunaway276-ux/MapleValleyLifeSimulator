import * as THREE from 'three';
import { PLAYER_RADIUS, resolveMoveStepped } from '../systems/collision.js';

export function createPlayer(camera, scene) {
  const player = {
    position: new THREE.Vector3(0, 1.6, -1.15),
    radius: PLAYER_RADIUS,
    velocity: new THREE.Vector3(),
    rotation: new THREE.Euler(0, 0, 0, 'YXZ'),
    speed: 4.5,
    jumpSpeed: 6,
    onGround: true,
    keys: { forward: false, back: false, left: false, right: false, jump: false, down: false },
    // Development fly mode: move where you look, Space up, C / Ctrl down, no walls or gravity.
    fly: false,
    flySpeed: 10,
    mouseX: 0,
    mouseY: 0,
    joystickX: 0,
    joystickY: 0
  };

  camera.position.copy(player.position);
  scene.add(camera);

  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const move = new THREE.Vector3();

  player.update = function(delta) {
    // Rotation
    // Look speed and invert come from the Controls settings (settings.js).
    const look = 0.002 * (this.lookSensitivity || 1);
    this.rotation.y -= this.mouseX * look;
    this.rotation.x -= this.mouseY * look * (this.invertY ? -1 : 1);
    this.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.rotation.x));
    camera.quaternion.setFromEuler(this.rotation);
    this.mouseX = 0;
    this.mouseY = 0;

    // Movement
    forward.set(0, 0, -1).applyQuaternion(camera.quaternion);
    right.set(1, 0, 0).applyQuaternion(camera.quaternion);
    move.set(0, 0, 0);
    if (this.fly) {
      if (this.keys.forward) move.add(forward);
      if (this.keys.back) move.sub(forward);
      if (this.keys.left) move.sub(right);
      if (this.keys.right) move.add(right);
      if (Math.abs(this.joystickX) > 0.1 || Math.abs(this.joystickY) > 0.1) {
        move.set(0, 0, 0).addScaledVector(right, this.joystickX).addScaledVector(forward, this.joystickY);
      }
      if (this.keys.jump) move.y += 1;
      if (this.keys.down) move.y -= 1;
      if (move.lengthSq() > 0) move.normalize().multiplyScalar(this.flySpeed * delta);
      this.position.add(move);
      this.position.y = Math.max(0.4, this.position.y);
      this.velocity.y = 0;
      this.onGround = false;
      camera.position.copy(this.position);
      return;
    }
    forward.y = 0; right.y = 0;
    forward.normalize(); right.normalize();

    if (this.keys.forward) move.add(forward);
    if (this.keys.back) move.sub(forward);
    if (this.keys.left) move.sub(right);
    if (this.keys.right) move.add(right);

    // Joystick override
    if (Math.abs(this.joystickX) > 0.1 || Math.abs(this.joystickY) > 0.1) {
      move.set(0, 0, 0)
        .addScaledVector(right, this.joystickX)
        .addScaledVector(forward, this.joystickY);
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

    const world = scene.userData && scene.userData.colliders;
    if (world && typeof world.resolveMove === 'function') {
      // Stepped so a long frame (up to 0.45 m of movement) cannot pass through a thin wall.
      const resolved = resolveMoveStepped(world, this.position.x, this.position.z, move.x, move.z, this.radius);
      this.position.x = resolved.x;
      this.position.z = resolved.z;
    } else {
      this.position.x += move.x;
      this.position.z += move.z;
    }
    camera.position.copy(this.position);
  };

  return player;
}
