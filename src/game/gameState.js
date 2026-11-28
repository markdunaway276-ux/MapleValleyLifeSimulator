import { saveGame } from '../systems/save.js';

/**
 * Everything that goes into the merged save. `g` is the game object from
 * main.js; systems are read when a save happens, not when this is created.
 * A new saved system adds one line here (and a SAVE_VERSION step in
 * systems/save.js if it changes the shape of something already saved).
 */
export function gameState(g) {
  const { mode, car, sitter, player } = g;
  // While driving or sitting, the saved player spot is a safe stand / exit, not inside the prop.
  const spot = mode.driving() ? car.exitSpot()
    : (mode.sitting() ? sitter.exitSpot() : null);
  return {
    position: spot
      ? { x: spot.x, y: 1.6, z: spot.z }
      : { x: player.position.x, y: player.position.y, z: player.position.z },
    car: car ? car.serialize() : undefined,
    inventory: g.inventory.serialize(),
    pickups: g.scene.userData.world ? g.scene.userData.world.serialize() : undefined,
    time: g.clock.serialize(),
    needs: g.needs.serialize(),
    laundry: g.laundry ? g.laundry.serialize() : undefined,
    money: g.money.serialize(),
    appearance: g.appearance.serialize(),
    weather: g.weather.serialize(),
    skills: g.skills.serialize(),
    inbox: g.inbox.serialize(),
    interiorLights: g.lights.serialize(),
    tv: g.tvSet.serialize(),
    stats: g.stats ? g.stats.serialize() : undefined,
    neighbourFavour: g.neighbourFavour.serialize(),
    snackFavour: g.snackFavour.serialize(),
    storyQuest: g.storyQuest ? g.storyQuest.serialize() : undefined,
    homeDecor: g.homeDecor ? g.homeDecor.serialize() : undefined,
    parcelDelivery: g.parcelDelivery ? g.parcelDelivery.serialize() : undefined,
    pinnedTaskId: g.getPinnedTask()?.id ?? null,
    dayOne: g.dayOne?.serialize(),
    savedAt: Date.now()
  };
}

/** save() for systems to call after a change: writes the whole game state. */
export function createSaver(g) {
  return () => saveGame(gameState(g));
}
