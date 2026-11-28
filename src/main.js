import { createCarInterior } from './world/carInterior.js';
/**
 * Maple Valley Life Simulator: builds every system in order and connects them.
 *
 * `g` is the game object: each system is added to it as soon as it exists, and
 * the helpers in src/game/ (save state, HUD, daily mail, interact, frame loop)
 * read what they need from it when they run. Creation order matters where one
 * system needs another at construction time; those spots are commented.
 *
 * Where things live:
 *   src/game/rendering.js  renderer, quality tier, camera, post-processing, resize
 *   src/game/gameState.js  what goes into the save (add new saved systems there)
 *   src/game/hud.js        clock / mute / needs / cash HUD and when the HUD shows
 *   src/game/dailyMail.js  the mailbox's daily delivery
 *   src/game/interact.js   E / the interact prompt
 *   src/game/loop.js       the per-frame update and the 10 s autosave
 *   src/core/mode.js       what the player is doing and which menus are open
 */
import { createScene } from './world/scene.js';
import { createHomeDecor } from './world/homeDecor.js';
import { createParcelDelivery } from './systems/parcelDelivery.js';
import { createMysteryChapter2 } from './systems/mysteryChapter2.js';
import { createPlayer } from './core/player.js';
import { setupInput } from './core/input.js';
import { isMobileDevice } from './core/device.js';
import { createPlayerMode } from './core/mode.js';
import { requestPointerLock, exitPointerLock } from './core/pointerLock.js';
import { createInventory } from './ui/inventory.js';
import { STARTER_ITEMS } from './data/items.js';
import { loadSave, saveGame, clearSave } from './systems/save.js';
import { createDebug } from './systems/debug.js';
import { createClock } from './systems/time.js';
import { createDayNight } from './world/daynight.js';
import { createSfx } from './systems/sfx.js';
import { createSleep } from './systems/sleep.js';
import { createNeeds } from './systems/needs.js';
import { createMoney, extractCashFromItems } from './systems/money.js';
import { createInbox } from './data/mail.js';
import { createWork } from './systems/work.js';
import { createPhone } from './ui/phone/phone.js';
import { INSTALLED_APPS } from './ui/phone/apps.js';
import { createHudMinimap } from './ui/minimap.js';
import { createAppearance } from './systems/appearance.js';
import { createPresentation } from './game/presentation.js';
import { createPlayerBody } from './world/playerBody.js';
import { createWeather } from './systems/weather.js';
import { createRain, isInsideMainHouse } from './world/rain.js';
import { createNpcs } from './world/npc.js';
import { createCutscene } from './systems/cutscene.js';
import { createDialogue } from './ui/dialogue.js';
import { createNeighbourFavour } from './systems/neighbourFavour.js';
import { createSnackFavour } from './systems/snackFavour.js';
import { createStoryQuest } from './systems/storyQuest.js';
import { createHudSave } from './ui/hudSave.js';
import { createCar } from './systems/car.js';
import { createSkills, registerCookInteractable } from './systems/skills.js';
import { createSit, registerSitInteractables } from './systems/sit.js';
import { createInteriorLights, registerLightSwitchInteractable } from './systems/lights.js';
import { createTvSet, registerTvInteractable } from './systems/tv.js';
import { createRenderer, createView } from './game/rendering.js';
import { createDisplay } from './systems/display.js';
import { createPauseMenu } from './ui/pauseMenu.js';
import { createTitleScreen } from './ui/titleScreen.js';
import { createHudFullscreen } from './ui/hudFullscreen.js';
import { createSettings } from './systems/settings.js';
import { createStats } from './systems/stats.js';
import { getNpc } from './data/npcs.js';
import { createSaver } from './game/gameState.js';
import { createHud } from './game/hud.js';
import { createPlayerActions } from './systems/playerActions.js';
import { createLaundry, FOLD_JOB } from './systems/laundry.js';
import { LOW_THRESHOLD } from './systems/needs.js';
import { setupDailyMail } from './game/dailyMail.js';
import { setupInteract } from './game/interact.js';
import { createDayOne } from './game/dayOne.js';
import { startLoop } from './game/loop.js';

const g = {};

// --- rendering, world, player -------------------------------------------
// Phone / tablet by device, not window width (see src/core/device.js; ?mobile=1 or ?mobile=0 overrides).
const isMobile = isMobileDevice();
const { quality, renderer } = createRenderer({ isMobile });
const scene = createScene(quality);
// What the player is doing (title / walking / driving / sitting / sleeping / working) and which
// menus are open. Systems are attached as they are created; see src/core/mode.js.
const instructions = document.getElementById('instructions');
const mode = createPlayerMode({ isStarted: () => instructions.classList.contains('hidden') });
const view = createView({ renderer, scene, quality });
const { camera } = view;
// Brightness / film look / grain (Debug -> Display), stored per device like mute.
const display = createDisplay({ renderer, post: view.post });
const player = createPlayer(camera, scene);
const save = createSaver(g);
Object.assign(g, { isMobile, quality, renderer, scene, mode, view, camera, player, save, display });

const spawn = scene.userData.spawn || { x: 0, y: 1.6, z: -1.15 };
const saveData = loadSave();
if (saveData.position) {
  player.position.set(saveData.position.x, saveData.position.y, saveData.position.z);
}
// A saved position may be inside a house (older spawns). Push out, or reset to spawn.
if (scene.userData.colliders) {
  const out = scene.userData.colliders.unstick(player.position.x, player.position.z, player.radius, spawn);
  player.position.x = out.x;
  player.position.z = out.z;
  if (out.reset) player.position.y = spawn.y;
}
camera.position.copy(player.position);
// Testing aid: ?yaw=<degrees> sets the starting view direction (like ?mobile=1).
{
  const yawParam = new URLSearchParams(location.search).get('yaw');
  if (yawParam != null && Number.isFinite(Number(yawParam))) player.rotation.y = Number(yawParam) * Math.PI / 180;
}

// --- time, weather, light, sound -----------------------------------------
const clock = createClock();
if (saveData.time) clock.apply(saveData);
const weather = createWeather({ clock });
if (saveData.weather) weather.apply(saveData);
else weather.roll({ immediate: true, time: clock.getTime() });
const dayNight = createDayNight({ scene, quality, modulate: (sample) => weather.modulate(sample) });
dayNight.apply(clock.getTime());
weather.applyFog(scene, quality);
const rain = createRain({ scene, isMobile });
clock.on('newDay', (e) => window.dispatchEvent(new CustomEvent('maple-new-day', { detail: e })));
const sfx = createSfx({ getTime: () => clock.getTime(), getScene: () => scene });
Object.assign(g, { clock, weather, dayNight, rain, sfx });

// --- needs, skills, the house interior -----------------------------------
const needs = createNeeds();
if (saveData.needs) needs.apply(saveData);
const skills = createSkills({ clock, needs, save });
if (saveData.skills) skills.apply(saveData);
scene.userData.skills = skills;
const lights = createInteriorLights({ scene, dayNight, getTime: () => clock.getTime(), save });
if (saveData.interiorLights != null) lights.apply(saveData);
const tvSet = createTvSet({ scene, sfx, save, getPosition: () => player.position });
if (saveData.tv != null) tvSet.apply(saveData);
const homeDecor = createHomeDecor({ scene, shadows: quality.shadows, saved: saveData.homeDecor });
Object.assign(g, { needs, skills, lights, tvSet, homeDecor });

// The interior is built when the house model has loaded; this may run again then.
function installInteriorInteractables(s) {
  registerCookInteractable(s);
  registerSitInteractables(s);
  registerLightSwitchInteractable(s);
  registerTvInteractable(s);
  lights.refresh();
  tvSet.refresh({ position: player.position, indoor: isInsideMainHouse(s, player.position) });
}
scene.userData.onInteriorReady = installInteriorInteractables;
installInteriorInteractables(scene);

// --- money, mail inbox, look ---------------------------------------------
const fromSaveBag = Array.isArray(saveData.inventory);
const bagCash = extractCashFromItems(fromSaveBag ? saveData.inventory : []);
const money = createMoney({ getTime: clock.getTime });
if (saveData.money != null) money.apply(saveData);
else if (fromSaveBag && bagCash.cash) money.apply(bagCash.cash);
const inbox = createInbox();
if (saveData.inbox) inbox.apply(saveData.inbox);
const appearance = createAppearance();
if (saveData.appearance) appearance.apply(saveData);
const playerBody = createPlayerBody({ scene, camera, shadows: quality.shadows });
playerBody.apply(appearance.get());
appearance.onChange((state) => {
  playerBody.apply(state);
  save();
});
const npcs = createNpcs({ scene, shadows: quality.shadows });
// First-person hands for door / sit / laundry / work animations (see playerActions.js).
const actions = createPlayerActions({ camera, appearance });
Object.assign(g, { money, inbox, appearance, playerBody, npcs, actions });
window.addEventListener('maple-sat', () => actions.play('sit'));
window.addEventListener('maple-stood', () => actions.play('stand'));
window.addEventListener('car-enter', () => {
  actions.play('openDoor');
  car?.object?.userData?.animateDriverDoor?.(1, 0, 280);
  window.setTimeout(() => {
    car?.object?.userData?.animateDriverDoor?.(0, 0, 320);
  }, 380);
});
window.addEventListener('car-exit', () => {
  actions.play('exitCar');
  sfx.play('click');
  car?.object?.userData?.animateDriverDoor?.(1, 60, 560);
  window.setTimeout(() => {
    car?.object?.userData?.animateDriverDoor?.(0, 0, 340);
  }, 1260);
  window.setTimeout(() => sfx.play('click'), 1580);
});
window.addEventListener('work-start', (e) => {
  const job = e.detail && e.detail.job;
  actions.play((job && job.action) || 'typing', { duration: job && job.duration ? job.duration : undefined });
});
window.addEventListener('work-end', () => actions.stop());

// --- car and seats --------------------------------------------------------
/** Your stand-in body is hidden while you drive or sit. */
function syncPlayerBody() {
  playerBody.group.visible = !(mode.driving() || mode.sitting());
}
// The parked car becomes drivable. Created before the minimap so its marker is live.
const car = createCar({
  scene,
  player,
  camera,
  isMobile,
  isStarted: () => mode.canAct(),
  sfx,
  onDrivingChange: syncPlayerBody,
  toast: (msg) => g.hud?.toast(msg),
  isFuelFree: () => needs.isDevelopmentMode(),
  getInventory: () => g.inventory
});
if (car && saveData.car) car.apply(saveData);
const sitter = createSit({
  scene,
  player,
  camera,
  needs,
  isStarted: () => mode.canAct(),
  onSeatedChange: syncPlayerBody
});
if (scene.userData.seats) {
  for (let i = 0; i < scene.userData.seats.length; i++) scene.userData.seats[i].userData.sit = sitter;
}
mode.attach({ car, sitter });
Object.assign(g, { car, sitter });

// --- bag, minimap, save indicator, debug ---------------------------------
const inventory = createInventory({
  canvas: renderer.domElement,
  isStarted: () => mode.started(),
  isBlocked: () => mode.busy() || mode.menuOpen({ except: 'inventory' }),
  items: fromSaveBag ? bagCash.items : STARTER_ITEMS,
  onUse: ({ use }) => {
    if (use && use.action === 'open') {
      inventory.close();
      if (g.phone) g.phone.open();
      return;
    }
    if (use && use.need) needs.add(use.need, use.amount || 0);
    if (use && use.action === 'eat') actions.play('eat');
    if (use && use.sfx) sfx.play(use.sfx);
    save();
  }
});
if (scene.userData.world) scene.userData.world.apply(saveData);
const minimap = createHudMinimap({
  scene,
  player,
  isMobile,
  isStarted: () => mode.started(),
  storage: typeof localStorage !== 'undefined' ? localStorage : null,
  bindKey: !isMobile
});
// Created before debug: the Debug menu reads it when it is built.
const hudSave = createHudSave();
// Optional debug tools (all off by default; see src/systems/debug.js for keys)
const debug = createDebug({
  renderer,
  scene,
  camera,
  player,
  quality: { tier: isMobile ? 'mobile' : 'desktop', ...quality },
  isMobile,
  isStarted: () => mode.started(),
  isInventoryOpen: () => inventory.isOpen(),
  saveApi: { saveGame, clearSave },
  clock,
  sfx,
  needs,
  money,
  getMinimap: () => minimap,
  getWeather: () => weather,
  getSaveHud: () => hudSave,
  getSkills: () => skills,
  getDisplay: () => display,
  getDev: () => g.devTools || null,
  getActivity: (opts) => mode.describe(opts)
});
mode.attach({ inventory, debug });
Object.assign(g, { inventory, minimap, hudSave, debug });

// --- sleep and work -------------------------------------------------------
const sleeper = createSleep({
  clock,
  dayNight,
  sfx,
  save,
  onSlept: (detail) => {
    if (scene.userData && typeof scene.userData.onSlept === 'function') scene.userData.onSlept(detail);
  }
});
scene.userData.sleep = sleeper;
const worker = createWork({
  clock,
  dayNight,
  money,
  needs,
  sfx,
  toast: (msg) => g.hud.toast(msg),
  save
});
scene.userData.work = worker;
mode.attach({ sleeper, worker });
Object.assign(g, { sleeper, worker });

// --- laundromat -----------------------------------------------------------
const laundry = createLaundry({
  getMinutes: () => clock.getTime().totalMinutes,
  money,
  needs,
  inventory,
  sfx,
  toast: (msg) => g.hud.toast(msg),
  save: () => save(),
  startWork: (job) => worker.start({ job }),
  saved: saveData.laundry
});
scene.userData.laundry = laundry;
g.laundry = laundry;
actions.setCarry(laundry.carry ? laundry.carry.stage : null);
laundry.onChange(() => {
  const stage = laundry.carry ? laundry.carry.stage : null;
  // Let the load / hand-over animation finish before the basket leaves your hands.
  const putting = ['load', 'handOver'].includes(actions.current);
  if (!stage && putting) setTimeout(() => { if (!laundry.carry) actions.setCarry(null); }, 550);
  else actions.setCarry(stage);
});
window.addEventListener('maple-worked', (e) => {
  if (e.detail && e.detail.job && e.detail.job.id === FOLD_JOB.id) laundry.finishFold();
});
// Development tools (Debug menu → Player → Development, and the quick bar).
g.devTools = {
  isOn: () => needs.isDevelopmentMode(),
  setOn(on) {
    needs.setDevelopmentMode(!!on);
    if (!on) { player.fly = false; document.body.classList.remove('flying'); laundry.setFast(false); }
  },
  isFly: () => !!player.fly,
  setFly(on) {
    if (on && !needs.isDevelopmentMode()) needs.setDevelopmentMode(true);
    player.fly = !!on;
    document.body.classList.toggle('flying', player.fly);
    g.hud?.toast(on ? 'Fly on: Space up, C down, move where you look.' : 'Fly off.');
  },
  fillTank() {
    if (!car) return;
    if (car.fuel.space() > 0.05) car.fuel.add(car.fuel.space()); else car.fuel.set(0);
    g.hud?.toast(car.fuel.isEmpty() ? 'Car tank emptied (to test running out).' : 'Car tank filled.');
    save();
  },
  isFast: () => laundry.fast,
  setFast(on) {
    if (on && !needs.isDevelopmentMode()) needs.setDevelopmentMode(true);
    laundry.setFast(!!on);
  }
};
let warnedDirty = false;
needs.onChange((snap) => {
  const clean = snap.values.clean;
  if (clean <= LOW_THRESHOLD && !warnedDirty) {
    warnedDirty = true;
    g.hud?.toast('Your clothes need a wash. The laundromat is at the east end of Maple Lane.');
  } else if (clean > LOW_THRESHOLD * 2) warnedDirty = false;
});

// --- phone and dialogue ---------------------------------------------------
const neighbourFavour = createNeighbourFavour({ savedStage: saveData.neighbourFavour, money, save });
const snackFavour = createSnackFavour({ savedStage: saveData.snackFavour, inventory, money, save });
const storyQuest = createStoryQuest({ savedStage: saveData.storyQuest, money, save, toast: (msg) => g.hud?.toast?.(msg) });
const mysteryChapter2 = createMysteryChapter2({
  savedStage: saveData.mysteryChapter2,
  money,
  needs,
  inventory,
  inbox,
  sfx,
  save,
  toast: (msg) => g.hud?.toast?.(msg)
});
scene.userData.mysteryChapter2 = mysteryChapter2;
const parcelDelivery = createParcelDelivery({
  scene,
  player,
  car,
  npcs,
  actions,
  money,
  sfx,
  toast: (msg) => g.hud?.toast?.(msg),
  minimap,
  mode,
  isMobile,
  isDayOneUnloadActive: () => g.dayOne?.stage === 'unload',
  save,
  saved: saveData.parcelDelivery
});
const getTasks = () => {
  if (storyQuest.stage === 'done' && mysteryChapter2.stage === 'locked') mysteryChapter2.unlock();
  return [parcelDelivery.task(), mysteryChapter2.task(), storyQuest.task(), neighbourFavour.task(), snackFavour.task(), ...laundry.tasks()].filter(Boolean);
};
let pinnedTaskId = saveData.pinnedTaskId ?? null;
const getPinnedTask = () => pinnedTaskId
  ? getTasks().find((task) => task.id === pinnedTaskId && !task.complete)
  : undefined;
/** Dottie can clock you in or out across the counter. */
function dottiePage(id) {
  if (id !== 'dottie') return null;
  const option = laundry.clockOption();
  return laundry.onShift
    ? { lines: [laundry.nextStep() || 'You are doing fine, hon.'], action: { label: 'Clock me out', run: () => !!option.run() }, response: ['Thanks for the help. See you next time.'] }
    : { lines: ['Want to work a shift?'], action: { label: 'Clock me in', run: () => !!option.run() }, response: ['Bags are on the counter. Wash, dry, fold, hand it back.'] };
}
/** Neighbours notice when your clothes need a wash. */
function dirtyPage(id) {
  if (needs.get('clean') > LOW_THRESHOLD) return null;
  const lines = {
    sam: ['No offence, but you might want to swing by the laundromat.'],
    june: ['Is that shirt from last week? The laundromat is down at the east end.'],
    dottie: ["Hon, those clothes need a wash. Grab detergent from the machine out front."]
  };
  return lines[id] ? { lines: lines[id] } : null;
}
const phone = createPhone({
  getTasks,
  getTaskLocation: (npcId) => npcs.get(npcId)?.locationHint(),
  getPinnedTask,
  togglePinnedTask(id) {
    pinnedTaskId = pinnedTaskId === id ? null : id;
    save();
  },
  canvas: renderer.domElement,
  isMobile,
  isStarted: () => mode.started(),
  isBlocked: () => mode.busy() || mode.menuOpen({ except: 'phone' }),
  canOpen: () => mode.canAct() && !mode.menu('dialogue') && !mode.menu('pause') && !mode.menu('debug'),
  getTime: () => clock.getTime(),
  getMoney: () => money.get(),
  getFinances: money.statement,
  onMoneyChange: (fn) => money.onChange(fn),
  clock,
  apps: INSTALLED_APPS,
  bindKey: !isMobile,
  onBeforeOpen: () => { if (inventory.isOpen()) inventory.close(); },
  attachMap: (el, onRoute, onPickPin) => minimap.attachPhone(el, undefined, onRoute, onPickPin),
  getDestinations: () => [
    ...minimap.destinations(),
    ...getTasks().filter(task => !task.complete && npcs.get(task.npcId)).map(task => ({
      id: 'task:' + task.id,
      name: task.title,
      position: () => getTasks().some(active => active.id === task.id && !active.complete)
        ? npcs.get(task.npcId)?.position
        : null
    }))
  ],
  getWaypointId: minimap.getWaypointId,
  setWaypoint: minimap.setWaypoint,
  capturePhoto: (aim) => g.presentation.capture(view.draw, renderer.domElement, aim),
  getAppearance: () => appearance.get(),
  setAppearance: (slot, id) => appearance.set(slot, id),
  onAppearanceChange: (fn) => appearance.onChange(fn),
  getWeather: () => weather.get(),
  onWeatherChange: (fn) => weather.onChange(fn),
  getSkills: () => skills.get(),
  onSkillsChange: (fn) => skills.onChange(fn),
  getInbox: () => inbox.get(),
  addInboxMessage: (msg) => { const added = inbox.add(msg); save(); return added; },
  markInboxRead: (key) => { inbox.markRead(key); save(); },
  onInboxChange: (fn) => inbox.onChange(fn),
  getHomeDecor: () => homeDecor.getOwned(),
  buyHomeDecor: (id) => homeDecor.buy(id, { money, sfx, toast: (msg) => g.hud?.toast?.(msg), save }),
  onHomeDecorChange: (fn) => homeDecor.onChange(fn),
  playNotification: () => sfx.play('phone-notification')
});
const dialogue = createDialogue({
  getExtraPages: (id) => {
    if (storyQuest.stage === 'done' && mysteryChapter2.stage === 'locked') mysteryChapter2.unlock();
    return [...(g.dayOne?.pagesFor(id) ?? []), mysteryChapter2.pageFor(id), parcelDelivery.pageFor(id), storyQuest.pageFor(id), neighbourFavour.pageFor(id), snackFavour.pageFor(id), dottiePage(id), dirtyPage(id)].filter(Boolean);
  },
  canvas: renderer.domElement,
  isMobile,
  isStarted: () => mode.started(),
  isBlocked: () => mode.busy() || mode.menuOpen({ except: 'dialogue' }),
  canOpen: () => mode.canAct(),
  onBeforeOpen: () => {
    if (inventory.isOpen()) inventory.close();
    if (phone.isOpen()) phone.close();
  },
  getTime: () => clock.getTime(),
  getWeather: () => weather.get()
});
const cutscene = createCutscene({
  camera,
  player,
  npcs,
  dialogue,
  sfx,
  isMobile,
  hasSeenIntro: (id) => !!g.dayOne?.hasSeenIntro?.(id),
  onIntroSeen: (id) => g.dayOne?.markIntroSeen?.(id)
});
mode.attach({ phone, dialogue });
Object.assign(g, { phone, dialogue, cutscene, parcelDelivery, storyQuest, mysteryChapter2, neighbourFavour, snackFavour, getPinnedTask });
setupInput(player, isMobile, { isInventoryOpen: () => mode.uiBlocked() || cutscene.isActive() });

// --- HUD, mail, interact, start, loop -------------------------------------
g.hud = createHud(g);
setupDailyMail(g);
const { prompt } = setupInteract(g);
g.prompt = prompt;

function beginPlay() {
  instructions.classList.add('hidden');
  if (!isMobile && !inventory.isOpen() && navigator.userActivation?.isActive !== false) {
    requestPointerLock(renderer.domElement);
  }
  prompt.update();
  debug.refresh();
  g.hud.sync();
  window.dispatchEvent(new Event('game-start'));
}
g.cabin = createCarInterior(g.car.object);
g.dayOne = createDayOne(g, saveData, beginPlay);
document.getElementById('start').onclick = () => {
  sfx.unlock();
  g.dayOne.start();
};

// Desktop mouse look needs pointer lock. Esc, switching windows or a refused request
// drops it, so a click on the game takes it back, and a hint says so while it is lost.
// Tab frees the mouse on purpose (to click HUD buttons) without pausing; Tab again or
// a click on the game brings mouse look back.
let cursorFree = false;
if (!isMobile) {
  const canvas = renderer.domElement;
  const hint = document.createElement('div');
  hint.id = 'look-hint';
  Object.assign(hint.style, {
    position: 'fixed', left: '50%', top: '58%', transform: 'translateX(-50%)', zIndex: '6',
    padding: '8px 14px', borderRadius: '8px', background: 'rgba(0,0,0,0.6)', color: '#fff',
    font: '600 14px system-ui, sans-serif', pointerEvents: 'none', display: 'none', textAlign: 'center'
  });
  document.body.appendChild(hint);
  const canLook = () => mode.started() && !mode.uiBlocked() && !inventory.isOpen();
  const syncHint = () => {
    const show = canLook() && document.pointerLockElement !== canvas;
    hint.textContent = cursorFree ? 'Mouse free — press Tab or click the game to look around' : 'Click to look around';
    hint.style.display = show ? 'block' : 'none';
    hint.style.top = cursorFree ? 'auto' : '58%';
    hint.style.bottom = cursorFree ? '90px' : 'auto';
  };
  const relock = () => {
    if (document.pointerLockElement === canvas || !canLook()) return;
    requestPointerLock(canvas);
  };
  canvas.addEventListener('click', () => { cursorFree = false; relock(); syncHint(); });
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'Tab' || !canLook()) return;
    e.preventDefault();
    if (document.pointerLockElement === canvas) {
      cursorFree = true;
      exitPointerLock();
    } else {
      cursorFree = false;
      relock();
    }
    syncHint();
  }, true);
  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement === canvas) cursorFree = false;
    syncHint();
  });
  document.addEventListener('pointerlockerror', syncHint);
  for (const ev of [
    'game-start', 'blur', 'focus',
    'inventory-open', 'inventory-close',
    'debug-modal-open', 'debug-modal-close',
    'phone-open', 'phone-close',
    'dialogue-open', 'dialogue-close',
    'pause-open', 'pause-close',
    'sleep-start', 'sleep-end',
    'work-start', 'work-end'
  ]) {
    window.addEventListener(ev, syncHint);
  }
}

// Device settings (look speed, invert, field of view, volumes, graphics quality).
const settings = createSettings();
const applyLive = {
  volume: (v) => sfx.setVolumes(v),
  look: (s) => {
    player.lookSensitivity = s.sensitivity;
    player.touchLookSpeed = s.touchLookSpeed;
    player.invertY = s.invertY;
  },
  fov: (v) => { camera.fov = v; camera.updateProjectionMatrix(); }
};
applyLive.volume(settings.get().volume);
applyLive.look(settings.get());

// Lifetime stats for the pause menu (money earned, distance walked, neighbours met).
const stats = createStats({ money, dialogue });
if (saveData.stats) stats.apply(saveData);
g.stats = stats;
g.settings = settings;

// Pause menu: Esc on a desktop (or losing mouse look while playing), the II button anywhere.
const pause = createPauseMenu({
  mode,
  isMobile,
  canvas: renderer.domElement,
  scene,
  player,
  getDisplay: () => display,
  getSettings: () => settings,
  getSfx: () => sfx,
  getStats: () => stats,
  getClock: () => clock,
  getMoney: () => money,
  getSkills: () => skills,
  getNpcName: (id) => (getNpc(id) || {}).name || id,
  applyLive,
  save: () => g.save(),
  onQuitToTitle: () => location.reload(),
  isCursorFree: () => cursorFree
});
mode.attach({ pause });
g.pause = pause;

// Title screen (Continue / New game / Load game / Settings) in place of the Start box.
g.title = createTitleScreen({
  onStart: () => document.getElementById('start').click(),
  isMobile,
  getDisplay: () => display,
  getSettings: () => settings,
  getSfx: () => sfx,
  applyLive
});

g.fullscreen = createHudFullscreen({
  onUnsupported: () => g.hud?.toast?.('Fullscreen is not supported by this browser.')
});

g.presentation = createPresentation({ camera, scene, mode, playerBody, actionRig: actions.rig });
g.hud.sync();
startLoop(g);

console.log(`Maple Valley Life Simulator started — Mobile: ${isMobile}, Shadows: ${quality.shadows}, Post: ${!!view.post}`);
