import { updateDoors } from '../systems/doors.js';
import { updatePickups } from '../world/pickups.js';
import { isInsideMainHouse } from '../world/rain.js';

/**
 * The frame loop. Order matters: clock, then whoever moves the player
 * (car, seat or walking), then the world reacting (NPCs, weather, rain,
 * sleep / work bars), then needs, skills and footsteps for the time that
 * passed, then doors, lights, HUD and the draw.
 */
export function startLoop(g) {
  const { mode, clock, player, scene, quality } = g;
  let lastTime = performance.now();

  function frame() {
    requestAnimationFrame(frame);
    const now = performance.now();
    const delta = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    // Paused: draw the frozen frame behind the menu and nothing else moves.
    if (mode.menu('pause')) {
      g.view.draw();
      return;
    }

    const started = mode.started();
    const busy = mode.busy();
    const timeBefore = started && !busy ? clock.getTime().totalMinutes : null;
    if (started && !busy) clock.tick(delta);
    const prevX = player.position.x;
    const prevZ = player.position.z;
    if (mode.driving()) g.car.update(delta, { blocked: mode.uiBlocked() });
    else if (mode.sitting()) g.sitter.update(delta, { blocked: mode.uiBlocked() });
    else player.update(delta);
    g.playerBody.update(player);
    g.npcs.update(delta, { player, talkingId: g.dialogue.isOpen() ? g.dialogue.currentNpc() : null });
    g.weather.update(delta, clock.getTime());
    g.weather.applyFog(scene, quality);
    const indoor = isInsideMainHouse(scene, player.position);
    g.rain.update(delta, { position: player.position, intensity: g.weather.rainAmount(), indoor });
    if (typeof g.sfx.setRain === 'function') g.sfx.setRain(g.weather.rainAmount(), { indoor });
    g.sleeper.update(delta);
    g.worker.update(delta);
    if (started && !busy) {
      const moved = Math.hypot(player.position.x - prevX, player.position.z - prevZ);
      const gameMinutes = clock.getTime().totalMinutes - timeBefore;
      const driving = mode.driving();
      const sitting = mode.sitting();
      if (gameMinutes > 0) {
        if (sitting) {
          g.needs.update(gameMinutes, { hungerOnly: true });
          g.sitter.applyEnergy(gameMinutes);
        } else {
          g.needs.update(gameMinutes, { moving: !driving && moved > 0.02 });
        }
      }
      if (!driving && moved > 0.02) {
        g.skills.addWalk(moved);
        if (g.stats) g.stats.addWalk(moved);
      }
      g.sfx.update(delta, {
        x: player.position.x,
        z: player.position.z,
        moved: (driving || sitting) ? 0 : moved,
        onGround: player.onGround,
        time: clock.getTime(),
        scene,
        indoor
      });
    }
    if (g.tvSet) g.tvSet.update(delta, { position: player.position, indoor });
    updateDoors(scene.userData.doors, delta);
    updatePickups(scene.userData.interactables, delta);
    g.dayNight.update(delta, clock.getTime());
    g.prompt.update();
    g.minimap.update(delta);
    g.view.draw();
    g.debug.update();
  }
  frame();

  // Auto-save every 10 seconds
  setInterval(() => g.save(), 10000);
}
