import { createInteractPrompt, INTERACT_RANGE } from '../ui/interactPrompt.js';
import { nearestActionTarget, activateTarget } from '../systems/interactables.js';
import { cueInteract } from '../systems/sfx.js';

/**
 * E / tapping the prompt: works on the car or seat you are in, else the
 * nearest door or interactable in reach (not through walls). Returns the
 * on-screen prompt so the loop and the Start button can refresh it.
 */
export function setupInteract(g) {
  const { mode, scene, player } = g;

  /** What E / the prompt acts on. */
  function currentTarget() {
    if (mode.driving()) return g.car.object;
    if (mode.sitting()) return g.sitter.object();
    return nearestActionTarget(scene, player.position, INTERACT_RANGE);
  }

  const prompt = createInteractPrompt({
    isMobile: g.isMobile,
    isStarted: () => mode.started(),
    isInventoryOpen: () => mode.uiBlocked(),
    getTarget: () => currentTarget(),
    player,
    range: INTERACT_RANGE
  });

  window.addEventListener('interact', () => {
    if (mode.busy()) return;
    const target = currentTarget();
    if (!target) return;
    const ud = target.userData || {};
    const before = {
      picked: !!ud.picked,
      letterTaken: !!(ud.mail && ud.mail.letterTaken)
    };
    const toast = (msg) => g.hud.toast(msg);
    activateTarget(target, {
      inventory: g.inventory,
      scene,
      player,
      sfx: g.sfx,
      money: g.money,
      toast,
      sleep: () => g.sleeper.start(),
      work: (jobId) => g.worker.start(typeof jobId === 'string' ? { jobId } : {}),
      cook: () => g.skills.cook({ clock: g.clock, needs: g.needs, sfx: g.sfx, toast }),
      sit: g.sitter,
      dialogue: g.dialogue,
      talk: (def) => g.dialogue.open(def.id)
    });
    cueInteract(g.sfx, target, before);
    prompt.update();
    if (!mode.busy()) g.save();
  });

  return { prompt, currentTarget };
}
