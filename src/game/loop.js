import { updateScenery } from '../world/scenery.js';
import { updateHouseWindows } from '../world/buildings.js';
import { updateWetSurfaces } from '../world/atmosphere.js';
import { FUEL } from '../systems/fuel.js';
import { updateDoors } from '../systems/doors.js';
import { updatePickups } from '../world/pickups.js';
import { isIndoors, isInsideMainHouse } from '../world/rain.js';

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
      g.dayOne.hide();
      g.presentation.draw(g.view.draw);
      return;
    }

    const started = mode.started();
    const busy = mode.busy();
    const timeBefore = started && !busy ? clock.getTime().totalMinutes : null;
    if (started && !busy) clock.tick(delta);
    const prevX = player.position.x;
    const prevZ = player.position.z;
    const inCutscene = !!g.cutscene?.isActive?.();
    if (started && !inCutscene) {
      if (mode.driving()) g.car.update(delta, { blocked: mode.uiBlocked() });
      else if (mode.sitting()) g.sitter.update(delta, { blocked: mode.uiBlocked() });
      else player.update(delta);
    }
    g.playerBody.update(player);
    if (g.actions) g.actions.update(delta);
    const currentTime = clock.getTime();
    g.presentation.update(delta, Math.hypot(player.position.x - prevX, player.position.z - prevZ), currentTime.minutes);
    g.weather.update(delta, currentTime);
    const rain = g.weather.rainAmount();
    updateScenery(delta,rain);
    g.npcs.update(delta, {
      player,
      talkingId: g.dialogue.currentNpc() || g.cutscene?.currentNpc?.() || null,
      minutes: currentTime.minutes,
      raining: rain >= 0.25
    });
    g.weather.applyFog(scene, quality);
    const indoor = isIndoors(scene, player.position);
    g.rain.update(delta, { position: player.position, intensity: rain, indoor });
    if (typeof g.sfx.setRain === 'function') g.sfx.setRain(rain, { indoor });
    const shop = scene.userData.laundromat;
    if (g.laundry) {
      g.laundry.update();
      if (shop && typeof g.sfx.setHum === 'function') {
        const n = g.laundry.runningCount();
        const d = Math.hypot(player.position.x - (shop.position.x + 2), player.position.z - (shop.position.z - 5));
        g.sfx.setHum(n ? Math.min(1, 0.4 + 0.15 * n) * Math.max(0, 1 - d / 18) : 0);
      }
    }
    if (shop && shop.userData.update) shop.userData.update(delta, currentTime);
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
    if (g.tvSet) g.tvSet.update(delta, { position: player.position, indoor: isInsideMainHouse(scene, player.position) });
    updateDoors(scene.userData.doors, delta);
    updatePickups(scene.userData.interactables, delta);
    const time = clock.getTime();
    g.dayNight.update(delta, time);
    const sky = scene.getObjectByName('sky');
    if (sky) {
      if (g.camera) sky.position.copy(g.camera.position);
      if (sky.material?.uniforms) {
        if (sky.material.uniforms.time) sky.material.uniforms.time.value += delta;
        if (sky.material.uniforms.cloudCover) {
          const w = g.weather.get?.();
          const cover = w && w.id === 'rain' ? 0.85 : (w && w.id === 'cloudy' ? 0.68 : 0.36);
          sky.material.uniforms.cloudCover.value += (cover - sky.material.uniforms.cloudCover.value) * Math.min(1, delta * 0.8);
        }
      }
    }
    updateWetSurfaces(scene, rain);
    updateHouseWindows(time.minutes);
    scene.userData.ambientParticles?.update(delta, { playerPos: player.position, minutes: time.minutes, rain });
    scene.userData.frontYard?.update(time.totalMinutes);
    scene.userData.streetlights.update(time.minutes, rain);
    scene.userData.park.update(time.minutes);
    scene.userData.cornerShop?.userData.updateFrontage?.(time.minutes);
    scene.userData.clinic?.userData.updateLighting?.(time.minutes);
    scene.userData.gasStation?.userData.updateLighting?.(time.minutes);
    scene.userData.lightPool?.update(player.position);
    g.prompt.update();
    g.minimap.update(delta);
    g.dayOne.update();
    if (!g.dayOne.draw(delta, g.view.draw)) {
      const driving = mode.driving();
      g.cabin.update({ visible: driving, speed: g.car.getSpeed(), steer: g.car.getSteer(),
        fuel: g.car.fuel.get() / FUEL.TANK, boxes: g.dayOne.stage === 'realtor',
        clock: `${String(Math.floor(time.minutes / 60)).padStart(2, '0')}:${String(Math.floor(time.minutes % 60)).padStart(2, '0')}` });
      if (driving && !g.phone.isOpen()) g.actions.drive(g.cabin.grips);
      g.cutscene?.update?.(delta);
      g.presentation.draw(g.view.draw);
    }
    g.debug.update();
  }
  frame();

  // Auto-save every 10 seconds
  setInterval(() => {
    if (mode.started()) g.save();
  }, 10000);
}
