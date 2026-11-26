import * as THREE from 'three';
import { createScene } from './world/scene.js';
import { createPlayer } from './core/player.js';
import { setupInput } from './core/input.js';
import { createInventory } from './ui/inventory.js';
import { STARTER_ITEMS } from './data/items.js';
import { loadSave, saveGame, clearSave } from './systems/save.js';
import { createInteractPrompt, INTERACT_RANGE } from './ui/interactPrompt.js';
import { updateDoors } from './systems/doors.js';
import { nearestActionTarget, activateTarget } from './systems/interactables.js';
import { updatePickups } from './world/pickups.js';
import { createDebug } from './systems/debug.js';
import { createClock } from './systems/time.js';
import { createDayNight } from './world/daynight.js';
import { createHudClock } from './ui/hudClock.js';
import { createSfx, cueInteract } from './systems/sfx.js';
import { createHudMute } from './ui/hudMute.js';
import { createSleep } from './systems/sleep.js';
import { createNeeds } from './systems/needs.js';
import { createHudNeeds } from './ui/hudNeeds.js';
import { createMoney, extractCashFromItems, attachMailboxMoney, queueDailyMail } from './systems/money.js';
import { createHudMoney } from './ui/hudMoney.js';
import { createWork } from './systems/work.js';
import { createPhone } from './ui/phone/phone.js';
import { createHudMinimap } from './ui/minimap.js';
import { createAppearance } from './systems/appearance.js';
import { createPlayerBody } from './world/playerBody.js';
import { createWeather } from './systems/weather.js';
import { createRain, isInsideMainHouse } from './world/rain.js';
import { createNpcs } from './world/npc.js';
import { createDialogue } from './ui/dialogue.js';

const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 800;

const quality = {
  shadows: !isMobile,
  pixelRatio: isMobile ? Math.min(window.devicePixelRatio, 1.5) : Math.min(window.devicePixelRatio, 2),
  far: isMobile ? 60 : 120
};

const renderer = new THREE.WebGLRenderer({ antialias: !isMobile });
renderer.setPixelRatio(quality.pixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
// Slightly lower exposure supports the darker, richer lighting palette.
renderer.toneMappingExposure = 0.95;
renderer.shadowMap.enabled = quality.shadows;
if (quality.shadows) renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = createScene(quality);
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, quality.far);
const player = createPlayer(camera, scene);

const spawn = scene.userData.spawn || { x: 0, y: 1.6, z: -1.15 };
const saveData = loadSave();
if (saveData.position) {
  player.position.set(saveData.position.x, saveData.position.y, saveData.position.z);
}
// A saved position may be inside a house (older spawns). Push out, or reset to spawn.
if (scene.userData.colliders) {
  const out = scene.userData.colliders.unstick(
    player.position.x,
    player.position.z,
    player.radius,
    spawn
  );
  player.position.x = out.x;
  player.position.z = out.z;
  if (out.reset) player.position.y = spawn.y;
}
camera.position.copy(player.position);

const clock = createClock();
if (saveData.time) clock.apply(saveData);
const weather = createWeather({ clock });
if (saveData.weather) weather.apply(saveData);
else weather.roll({ immediate: true, time: clock.getTime() });
const dayNight = createDayNight({
  scene,
  quality,
  modulate: (sample) => weather.modulate(sample)
});
dayNight.apply(clock.getTime());
weather.applyFog(scene, quality);
const rain = createRain({ scene, isMobile });
clock.on('newDay', (e) => window.dispatchEvent(new CustomEvent('maple-new-day', { detail: e })));

const sfx = createSfx({ getTime: () => clock.getTime(), getScene: () => scene });

const needs = createNeeds();
if (saveData.needs) needs.apply(saveData);

const fromSaveBag = Array.isArray(saveData.inventory);
const bagCash = extractCashFromItems(fromSaveBag ? saveData.inventory : []);
const money = createMoney();
if (saveData.money != null) money.apply(saveData);
else if (fromSaveBag && bagCash.cash) money.set(bagCash.cash);

const appearance = createAppearance();
if (saveData.appearance) appearance.apply(saveData);
const playerBody = createPlayerBody({ scene, camera, shadows: quality.shadows });
playerBody.apply(appearance.get());
appearance.onChange((state) => {
  playerBody.apply(state);
  saveGame(gameState());
});

const npcs = createNpcs({ scene, shadows: quality.shadows });

const instructions = document.getElementById('instructions');
let phone;
let dialogue;
const inventory = createInventory({
  canvas: renderer.domElement,
  isStarted: () => instructions.classList.contains('hidden'),
  items: fromSaveBag ? bagCash.items : STARTER_ITEMS,
  onUse: ({ use }) => {
    if (use && use.action === 'open') {
      inventory.close();
      if (phone) phone.open();
      return;
    }
    if (use && use.need) needs.add(use.need, use.amount || 0);
    if (use && use.sfx) sfx.play(use.sfx);
    saveGame(gameState());
  }
});
if (scene.userData.world) scene.userData.world.apply(saveData);

const minimap = createHudMinimap({
  scene,
  player,
  isMobile,
  isStarted: () => instructions.classList.contains('hidden'),
  storage: typeof localStorage !== 'undefined' ? localStorage : null,
  bindKey: !isMobile
});

// Optional debug tools (all off by default; see src/systems/debug.js for keys)
const debug = createDebug({
  renderer,
  scene,
  camera,
  player,
  quality: { tier: isMobile ? 'mobile' : 'desktop', ...quality },
  isMobile,
  isStarted: () => instructions.classList.contains('hidden'),
  isInventoryOpen: () => inventory.isOpen(),
  saveApi: { saveGame, clearSave },
  clock,
  sfx,
  needs,
  money,
  getMinimap: () => minimap,
  getWeather: () => weather
});
const sleeper = createSleep({
  clock,
  dayNight,
  sfx,
  save: () => saveGame(gameState()),
  onSlept: (detail) => {
    /* later Hunger/Energy can also listen for maple-slept */
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
  toast: (msg) => hudMoney.toast(msg),
  save: () => saveGame(gameState())
});
scene.userData.work = worker;

phone = createPhone({
  canvas: renderer.domElement,
  isMobile,
  isStarted: () => instructions.classList.contains('hidden'),
  isBlocked: () => inventory.isOpen() || debug.isModalOpen() || sleeper.isSleeping() || worker.isWorking() || (dialogue && dialogue.isOpen()),
  canOpen: () => instructions.classList.contains('hidden') && !sleeper.isSleeping() && !worker.isWorking() && !(dialogue && dialogue.isOpen()),
  getTime: () => clock.getTime(),
  getMoney: () => money.get(),
  onMoneyChange: (fn) => money.onChange(fn),
  clock,
  bindKey: !isMobile,
  onBeforeOpen: () => { if (inventory.isOpen()) inventory.close(); },
  attachMap: (el) => minimap.attachPhone(el),
  getAppearance: () => appearance.get(),
  setAppearance: (slot, id) => appearance.set(slot, id),
  onAppearanceChange: (fn) => appearance.onChange(fn),
  getWeather: () => weather.get(),
  onWeatherChange: (fn) => weather.onChange(fn)
});

dialogue = createDialogue({
  canvas: renderer.domElement,
  isMobile,
  isStarted: () => instructions.classList.contains('hidden'),
  isBlocked: () => inventory.isOpen() || debug.isModalOpen() || sleeper.isSleeping() || worker.isWorking() || phone.isOpen(),
  canOpen: () => instructions.classList.contains('hidden') && !sleeper.isSleeping() && !worker.isWorking(),
  onBeforeOpen: () => {
    if (inventory.isOpen()) inventory.close();
    if (phone.isOpen()) phone.close();
  },
  getTime: () => clock.getTime(),
  getWeather: () => weather.get()
});

const uiBlocked = () => inventory.isOpen() || debug.isModalOpen() || sleeper.isSleeping() || worker.isWorking() || phone.isOpen() || dialogue.isOpen();
setupInput(player, isMobile, { isInventoryOpen: uiBlocked });

const hudClock = createHudClock();
const hudMute = createHudMute({
  isMuted: () => sfx.isMuted(),
  onToggle: () => sfx.toggleMuted()
});
const hudNeeds = createHudNeeds({ getNeeds: () => needs.get() });
const hudMoney = createHudMoney({ getMoney: () => money.get() });
function syncClockHud() {
  const show = instructions.classList.contains('hidden') && !uiBlocked();
  hudClock.setVisible(show);
  if (show) hudClock.update(clock.getTime(), weather.get());
  hudMute.setVisible(show);
  hudMute.refresh();
  hudNeeds.setVisible(show);
  if (show) hudNeeds.update();
  hudMoney.setVisible(show);
  if (show) hudMoney.update();
  phone.setVisible(show);
  minimap.setHudVisible(show);
}
clock.on('change', (t) => hudClock.update(t, weather.get()));
weather.onChange((w) => {
  hudClock.update(clock.getTime(), w);
  saveGame(gameState());
});
sfx.on('mute', () => hudMute.refresh());
needs.onChange(() => hudNeeds.update());
money.onChange(() => hudMoney.update());
window.addEventListener('inventory-open', syncClockHud);
window.addEventListener('inventory-close', syncClockHud);
window.addEventListener('debug-modal-open', syncClockHud);
window.addEventListener('debug-modal-close', syncClockHud);
window.addEventListener('phone-open', syncClockHud);
window.addEventListener('phone-close', syncClockHud);
window.addEventListener('dialogue-open', syncClockHud);
window.addEventListener('dialogue-close', syncClockHud);
window.addEventListener('sleep-start', () => {
  if (inventory.isOpen()) inventory.close();
  if (phone.isOpen()) phone.close();
  if (dialogue.isOpen()) dialogue.close();
  syncClockHud();
});
window.addEventListener('sleep-end', syncClockHud);
window.addEventListener('maple-slept', (e) => {
  needs.applySleep(e.detail || {});
});
window.addEventListener('work-start', () => {
  if (inventory.isOpen()) inventory.close();
  if (phone.isOpen()) phone.close();
  if (dialogue.isOpen()) dialogue.close();
  syncClockHud();
});
window.addEventListener('work-end', syncClockHud);

const mailbox = scene.userData.mailbox || (scene.getObjectByName && scene.getObjectByName('mailbox'));
attachMailboxMoney({
  mailbox,
  money,
  sfx,
  toast: (msg) => hudMoney.toast(msg)
});
window.addEventListener('maple-new-day', (e) => {
  const mail = mailbox && mailbox.userData && mailbox.userData.mail;
  const day = e && e.detail && e.detail.day;
  queueDailyMail(mail, day);
});

const prompt = createInteractPrompt({
  isMobile,
  isStarted: () => instructions.classList.contains('hidden'),
  isInventoryOpen: uiBlocked,
  getTarget: () => nearestActionTarget(scene, player.position, INTERACT_RANGE),
  player,
  range: INTERACT_RANGE
});

document.getElementById('start').onclick = () => {
  instructions.classList.add('hidden');
  if (!isMobile && !inventory.isOpen()) renderer.domElement.requestPointerLock();
  sfx.unlock();
  prompt.update();
  debug.refresh();
  syncClockHud();
};

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function gameState() {
  return {
    position: { x: player.position.x, y: player.position.y, z: player.position.z },
    inventory: inventory.serialize(),
    pickups: scene.userData.world ? scene.userData.world.serialize() : undefined,
    time: clock.serialize(),
    needs: needs.serialize(),
    money: money.serialize(),
    appearance: appearance.serialize(),
    weather: weather.serialize()
  };
}

// Interact with the nearest door or pickup within range
window.addEventListener('interact', () => {
  if (sleeper.isSleeping() || worker.isWorking()) return;
  const target = nearestActionTarget(scene, player.position, INTERACT_RANGE);
  if (target) {
    const ud = target.userData || {};
    const before = {
      picked: !!ud.picked,
      letterTaken: !!(ud.mail && ud.mail.letterTaken)
    };
    activateTarget(target, { inventory, scene, player, sfx, money, toast: (msg) => hudMoney.toast(msg), sleep: () => sleeper.start(), work: () => worker.start(), dialogue, talk: (def) => dialogue.open(def.id) });
    cueInteract(sfx, target, before);
    prompt.update();
    if (!sleeper.isSleeping() && !worker.isWorking()) saveGame(gameState());
  }
});

let lastTime = performance.now();
function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  const delta = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  const started = instructions.classList.contains('hidden');
  const sleeping = sleeper.isSleeping();
  const working = worker.isWorking();
  const busy = sleeping || working;
  const timeBefore = started && !busy ? clock.getTime().totalMinutes : null;
  if (started && !busy) clock.tick(delta);
  const prevX = player.position.x;
  const prevZ = player.position.z;
  player.update(delta);
  playerBody.update(player);
  npcs.update(delta, { player, talkingId: dialogue.isOpen() ? dialogue.currentNpc() : null });
  weather.update(delta, clock.getTime());
  weather.applyFog(scene, quality);
  const indoor = isInsideMainHouse(scene, player.position);
  rain.update(delta, { position: player.position, intensity: weather.rainAmount(), indoor });
  if (typeof sfx.setRain === 'function') sfx.setRain(weather.rainAmount(), { indoor });
  sleeper.update(delta);
  worker.update(delta);
  if (started && !busy) {
    const moved = Math.hypot(player.position.x - prevX, player.position.z - prevZ);
    const gameMinutes = clock.getTime().totalMinutes - timeBefore;
    if (gameMinutes > 0) needs.update(gameMinutes, { moving: moved > 0.02 });
    sfx.update(delta, {
      x: player.position.x,
      z: player.position.z,
      moved,
      onGround: player.onGround,
      time: clock.getTime(),
      scene
    });
  }
  updateDoors(scene.userData.doors, delta);
  updatePickups(scene.userData.interactables, delta);
  dayNight.update(delta, clock.getTime());
  prompt.update();
  minimap.update(delta);
  renderer.render(scene, camera);
  debug.update();
}
animate();

// Auto-save every 10 seconds
setInterval(() => {
  saveGame(gameState());
}, 10000);

console.log(`Maple Valley Life Simulator started — Mobile: ${isMobile}, Shadows: ${quality.shadows}`);
