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
import { createPlayer } from './core/player.js';
import { setupInput } from './core/input.js';
import { isMobileDevice } from './core/device.js';
import { createPlayerMode } from './core/mode.js';
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
import { createPlayerBody } from './world/playerBody.js';
import { createWeather } from './systems/weather.js';
import { createRain, isInsideMainHouse } from './world/rain.js';
import { createNpcs } from './world/npc.js';
import { createDialogue } from './ui/dialogue.js';
import { createHudSave } from './ui/hudSave.js';
import { createCar } from './systems/car.js';
import { createSkills, registerCookInteractable } from './systems/skills.js';
import { createSit, registerSitInteractables } from './systems/sit.js';
import { createInteriorLights, registerLightSwitchInteractable } from './systems/lights.js';
import { createTvSet, registerTvInteractable } from './systems/tv.js';
import { createRenderer, createView } from './game/rendering.js';
import { createDisplay } from './systems/display.js';
import { createSaver } from './game/gameState.js';
import { createHud } from './game/hud.js';
import { setupDailyMail } from './game/dailyMail.js';
import { setupInteract } from './game/interact.js';
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
Object.assign(g, { needs, skills, lights, tvSet });

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
const money = createMoney();
if (saveData.money != null) money.apply(saveData);
else if (fromSaveBag && bagCash.cash) money.set(bagCash.cash);
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
Object.assign(g, { money, inbox, appearance, playerBody, npcs });

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
  onDrivingChange: syncPlayerBody
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
  items: fromSaveBag ? bagCash.items : STARTER_ITEMS,
  onUse: ({ use }) => {
    if (use && use.action === 'open') {
      inventory.close();
      if (g.phone) g.phone.open();
      return;
    }
    if (use && use.need) needs.add(use.need, use.amount || 0);
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

// --- phone and dialogue ---------------------------------------------------
const phone = createPhone({
  canvas: renderer.domElement,
  isMobile,
  isStarted: () => mode.started(),
  isBlocked: () => mode.busy() || mode.menuOpen({ except: 'phone' }),
  canOpen: () => mode.canAct() && !mode.menu('dialogue'),
  getTime: () => clock.getTime(),
  getMoney: () => money.get(),
  onMoneyChange: (fn) => money.onChange(fn),
  clock,
  apps: INSTALLED_APPS,
  bindKey: !isMobile,
  onBeforeOpen: () => { if (inventory.isOpen()) inventory.close(); },
  attachMap: (el) => minimap.attachPhone(el),
  getAppearance: () => appearance.get(),
  setAppearance: (slot, id) => appearance.set(slot, id),
  onAppearanceChange: (fn) => appearance.onChange(fn),
  getWeather: () => weather.get(),
  onWeatherChange: (fn) => weather.onChange(fn),
  getSkills: () => skills.get(),
  onSkillsChange: (fn) => skills.onChange(fn),
  getInbox: () => inbox.get(),
  onInboxChange: (fn) => inbox.onChange(fn)
});
const dialogue = createDialogue({
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
mode.attach({ phone, dialogue });
Object.assign(g, { phone, dialogue });
setupInput(player, isMobile, { isInventoryOpen: () => mode.uiBlocked() });

// --- HUD, mail, interact, start, loop -------------------------------------
g.hud = createHud(g);
setupDailyMail(g);
const { prompt } = setupInteract(g);
g.prompt = prompt;

document.getElementById('start').onclick = () => {
  instructions.classList.add('hidden');
  if (!isMobile && !inventory.isOpen()) renderer.domElement.requestPointerLock();
  sfx.unlock();
  prompt.update();
  debug.refresh();
  g.hud.sync();
};

startLoop(g);

console.log(`Maple Valley Life Simulator started — Mobile: ${isMobile}, Shadows: ${quality.shadows}, Post: ${!!view.post}`);
