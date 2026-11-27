import { createInteractPrompt, INTERACT_RANGE } from '../ui/interactPrompt.js';
import { nearestActionTarget, activateTarget } from '../systems/interactables.js';
import { cueInteract } from '../systems/sfx.js';
import { ACTIONS, actionForTarget } from '../systems/playerActions.js';

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
    return nearestActionTarget(scene, player.position, INTERACT_RANGE)
      ?? (g.needs.isDevelopmentMode()
        ? nearestActionTarget(scene, player.position, 12, { development: true })
        : null);
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
    if (!mode.canAct() || mode.menuOpen()) return;
    const target = currentTarget();
    if (!target) return;
    const ud = target.userData || {};
    const before = {
      picked: !!ud.picked,
      letterTaken: !!(ud.mail && ud.mail.letterTaken)
    };
    const toast = (msg) => g.hud.toast(msg);
    // Hands: what this target does (door, mailbox, button…), decided before it changes state.
    const planned = mode.driving() || mode.sitting() ? null : actionForTarget(target);
    const actionBefore = g.actions ? g.actions.current : null;
    const result = activateTarget(target, {
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
    // A target can name its own animation by returning it (laundromat steps do).
    const action = typeof result === 'string' && ACTIONS[result] ? result : ((result || ud.isDoor) ? planned : null);
    // Something already started its own animation (a job, sitting down): leave it.
    const started = g.actions && g.actions.current && g.actions.current !== actionBefore;
    if (action && g.actions && !started) g.actions.play(action);
    cueInteract(g.sfx, target, before);
    prompt.update();
    if (!mode.busy()) g.save();
  });

  return { prompt, currentTarget };
}
