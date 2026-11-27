import { createRoadTrip } from './roadTrip.js';
import * as THREE from 'three';
import { STREET } from '../world/street.js';
import { createNpc } from '../world/npc.js';
import { STORY_NPCS } from '../data/npcs.js';
import { toggleDoor } from '../systems/doors.js';

/**
 * Day One: the move-in story for a new game, then a short tutorial.
 *
 * The Route 9 cinematic ends in the driver seat, across from Rita and your new house.
 *
 * Stages (saved): realtor (front door locked until Rita hands you the keys)
 * -> unload (carry BOXES boxes from the trunk into the living room)
 * -> unpack (open each box) -> phone (Rita's welcome text) -> market -> day -> done.
 * Sam and June greet you as the new neighbour the first time you talk to them.
 * Saves from before the story (no dayOne, or the old 'walk' stage) skip it.
 */

const STAGES = ['realtor', 'unload', 'unpack', 'phone', 'market', 'day', 'done'];
const BOXES = 3;
const UNPACK_SECONDS = 2.4;
/** Box pile in the living room: along the front wall, west of the door, clear of the sofa. */
const PILE = { x: -2.85, z: -6.47 };
const RITA_TEXT = 'Hope the unpacking went OK! Sam and June down the street are lovely, so say hi. ' +
  'The Market up the road has everything for a first dinner. Welcome to Maple Lane! - Rita';

function readSaved(saved) {
  if (saved && typeof saved === 'object') return saved;
  if (typeof saved === 'string') return { stage: saved === 'walk' ? 'phone' : saved };
  return null;
}

function makeBoxMesh(seed = 0) {
  const g = new THREE.Group();
  const card = new THREE.MeshStandardMaterial({ color: [0xb98d5b, 0xa8804f, 0xc29a68][seed % 3], roughness: 0.9 });
  const tape = new THREE.MeshStandardMaterial({ color: 0xd9c9a3, roughness: 0.6 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.38, 0.42), card);
  body.position.y = 0.19;
  body.castShadow = body.receiveShadow = true;
  const strip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.005, 0.425), tape);
  strip.position.y = 0.383;
  g.add(body, strip);
  return g;
}

export function createDayOne(g, saveData, beginPlay) {
  const { camera, isMobile, player, scene } = g;
  const fresh = Object.keys(saveData).length === 0;
  const saved = readSaved(saveData.dayOne);
  let stage = fresh ? 'realtor' : (saved && STAGES.includes(saved.stage) ? saved.stage : 'done');
  let pile = Math.max(0, Math.min(BOXES, saved?.pile | 0));
  let unpacked = Math.max(0, Math.min(BOXES - pile, saved?.unpacked | 0));
  if (stage === 'realtor') { pile = 0; unpacked = 0; }
  // A box in your hands when the game was saved goes back in the trunk.
  let trunk = BOXES - pile - unpacked;
  const greeted = new Set(Array.isArray(saved?.greeted) ? saved.greeted : []);
  let arriving = false;
  let marketWaypointSet = false;
  let unpacking = null; // performance.now() when the current box was opened
  let rita = null;

  const north = STREET.roadCenterZ + STREET.roadWidth / 2 + STREET.sidewalkWidth / 2;
  const marketX = scene.userData.cornerShop.position.x;
  const market = { id: 'day-one-market', name: 'Maple Lane Market', position: () => ({ x: marketX, z: north }) };
  const carObject = () => g.car?.object ?? scene.userData.prop ?? scene.getObjectByName('parked-car');
  const trunkLocal = new THREE.Vector3(-2.3, 0.9, 0);
  const trunkPoint = () => carObject().localToWorld(trunkLocal.clone());
  // The car's own "enter car" point is the nearest point of its box to you, so
  // behind the car the trunk point sits just in front of that (closer wins).
  const _local = new THREE.Vector3();
  function behindCar() {
    const car = carObject();
    if (!car) return false;
    car.worldToLocal(_local.set(player.position.x, 0, player.position.z));
    return _local.x < -1.75 && Math.abs(_local.z) < 1.3;
  }
  function trunkTarget() {
    const car = carObject();
    car.worldToLocal(_local.set(player.position.x, 0, player.position.z));
    const rearX = Math.max(-2.0, Math.min(_local.x, -2.0));
    _local.set(rearX - 0.08, 0, THREE.MathUtils.clamp(_local.z, -0.9, 0.9) * 0.9);
    car.localToWorld(_local);
    return { x: _local.x, y: 1.6, z: _local.z };
  }

  // --- the front door, locked until you have the keys ------------------------
  function frontDoor() {
    let best = null;
    let bestD = Infinity;
    for (const d of scene.userData.doors ?? []) {
      const dist = Math.hypot(d.position.x, d.position.z + 5.5);
      if (dist < bestD) { bestD = dist; best = d; }
    }
    return bestD < 2 ? best : null;
  }
  let lockedDoor = null;
  function syncLock() {
    const door = frontDoor();
    const locked = stage === 'realtor';
    if (locked && door && lockedDoor !== door) {
      lockedDoor = door;
      if (door.userData.open) toggleDoor(door, true);
      door.userData.interact = (ctx) => {
        if (stage !== 'realtor') return toggleDoor(door);
        ctx?.toast?.("It's locked. Rita has your keys.");
        g.sfx?.play?.('click');
        return false;
      };
    } else if (!locked && lockedDoor) {
      delete lockedDoor.userData.interact;
      lockedDoor = null;
    }
  }

  // --- Rita ------------------------------------------------------------------
  function spawnRita() {
    if (rita) return;
    rita = createNpc(STORY_NPCS.find(n => n.id === 'rita'), { scene, shadows: !!g.quality?.shadows });
    g.npcs.list.push(rita);
  }
  function ritaLeaves() {
    if (!rita) return;
    const i = g.npcs.list.indexOf(rita);
    if (i >= 0) g.npcs.list.splice(i, 1);
    rita.dispose();
    rita = null;
  }
  if (stage === 'realtor' || stage === 'unload') spawnRita();

  function giveKeys() {
    if (stage !== 'realtor') return false;
    g.actions?.play('takeKeys');
    g.sfx?.play?.('pickup');
    stage = 'unload';
    syncLock();
    renderTask();
    g.save();
    return true;
  }

  // --- boxes: trunk, living-room pile ----------------------------------------
  const pileGroup = new THREE.Group();
  pileGroup.name = 'day-one-boxes';
  pileGroup.position.set(PILE.x, 0.02, PILE.z);
  scene.add(pileGroup);
  const PILE_SLOTS = [[0, 0, 0, 0.05], [0.55, 0, 0.02, -0.08], [0.26, 0.38, 0.01, 0.12]];
  function syncPile() {
    while (pileGroup.children.length > pile) pileGroup.remove(pileGroup.children[pileGroup.children.length - 1]);
    while (pileGroup.children.length < pile) {
      const i = pileGroup.children.length;
      const box = makeBoxMesh(i);
      const [x, y, z, r] = PILE_SLOTS[i] ?? [0, i * 0.38, 0, 0];
      box.position.set(x, y, z);
      box.rotation.y = r;
      pileGroup.add(box);
    }
    const world = scene.userData.colliders;
    if (world?.addHouse && pile > 0) {
      world.addHouse({ id: 'day-one-boxes', minX: PILE.x - 0.3, maxX: PILE.x + 0.85, minZ: PILE.z - 0.25, maxZ: PILE.z + 0.25 });
    } else world?.remove?.('day-one-boxes');
  }
  syncPile();

  const prompt = (verb) => (isMobile ? 'Tap to ' : 'Press E to ') + verb;
  const carrying = () => g.actions?.carrying;

  const trunkSpot = new THREE.Object3D();
  trunkSpot.name = 'day-one-trunk';
  scene.add(trunkSpot);
  trunkSpot.getPoint = () => trunkTarget(); // the interact path reads the object's getPoint
  trunkSpot.userData.getPrompt = () => prompt(`take a box (${trunk} left)`);
  trunkSpot.userData.interact = (ctx) => {
    if (carrying()) { ctx?.toast?.('Your hands are full.'); return false; }
    if (trunk <= 0) return false;
    trunk -= 1;
    g.actions.setCarry('box');
    renderTask();
    return 'liftBox';
  };

  const pileSpot = new THREE.Object3D();
  pileSpot.name = 'day-one-pile';
  pileSpot.position.set(PILE.x + 0.28, 1.2, PILE.z);
  scene.add(pileSpot);
  pileSpot.userData.getPrompt = () => stage === 'unload'
    ? prompt('set the box down')
    : (unpacking ? 'Unpacking…' : prompt(`unpack a box (${pile} left)`));
  pileSpot.userData.interact = () => {
    if (stage === 'unload' && carrying() === 'box') {
      g.actions.setCarry(null);
      pile += 1;
      syncPile();
      if (pile + unpacked >= BOXES) {
        stage = 'unpack';
        ritaLeaves();
        g.hud?.toast?.('Rita waves from the street and heads off.');
      }
      renderTask();
      return 'setBoxDown';
    }
    if (stage === 'unpack' && pile > 0 && !unpacking) {
      unpacking = performance.now();
      g.actions.play('unpack', { duration: UNPACK_SECONDS });
      return true;
    }
    return false;
  };

  const interactables = (scene.userData.interactables ??= []);
  interactables.push(
    { id: 'day-one-trunk', kind: 'trunk', object: trunkSpot, range: 2.4,
      getPoint: () => trunkTarget(),
      enabled: () => stage === 'unload' && trunk > 0 && carrying() !== 'box' && !g.mode.driving() && behindCar() },
    { id: 'day-one-pile', kind: 'boxes', object: pileSpot, range: 2.6,
      enabled: () => (stage === 'unload' && carrying() === 'box') || (stage === 'unpack' && pile > 0) }
  );

  function finishUnpacking() {
    unpacking = null;
    pile -= 1;
    unpacked += 1;
    syncPile();
    g.sfx?.play?.('pickup');
    if (pile === 0) {
      stage = 'phone';
      g.inbox?.add({ id: 'rita-welcome', from: 'Rita (Maple Lane Realty)', body: RITA_TEXT });
    }
    renderTask();
    g.prompt?.update();
    g.save();
  }

  // --- conversations -----------------------------------------------------------
  const WELCOME = {
    sam: ["Hang on, you're the one who just moved in? Welcome to the street!",
      "I'm out walking most mornings and evenings, so you'll see plenty of me."],
    june: ['Oh, you must be our new neighbour! I saw the boxes going in.',
      'Come by any time. And try the coffee at Fuel & Go. It\'s better than it looks.']
  };
  function pagesFor(id) {
    if (id === 'rita') {
      if (stage === 'realtor') {
        return [
          { lines: ["You made it! I'm Rita, from Maple Lane Realty.", 'Welcome home. How was the drive in?'] },
          { lines: ["All the paperwork's signed, so there's just one thing left."],
            action: { label: 'Take the keys', run: giveKeys },
            response: ["There you go. Front door, and the little one's for the mailbox.",
              'Get those boxes out of your trunk and make yourself at home.'] }
        ];
      }
      return [{ lines: ["I'd help with the boxes, but my back's retired even if I'm not.",
        'The Market is up the street, and Dottie at the laundromat is always looking for help.'] }];
    }
    if (WELCOME[id] && !greeted.has(id) && stage !== 'realtor') {
      greeted.add(id);
      return [{ lines: WELCOME[id] }];
    }
    return [];
  }

  // --- task panel ----------------------------------------------------------------
  const panel = document.createElement('section');
  panel.className = 'day-one hud-ui';
  panel.hidden = true;
  const copy = document.createElement('div');
  copy.setAttribute('aria-live', 'polite');
  const title = document.createElement('h2');
  const text = document.createElement('p');
  copy.append(title, text);
  const action = document.createElement('button');
  action.type = 'button';
  panel.append(copy, action);
  document.body.append(panel);
  for (const type of ['pointerdown', 'touchstart']) {
    panel.addEventListener(type, event => event.stopPropagation());
  }

  function show(heading, line, label) {
    if (title.textContent !== heading) title.textContent = heading;
    if (text.textContent !== line) text.textContent = line;
    if (action.textContent !== label) action.textContent = label;
  }

  const press = isMobile ? 'tap the prompt' : 'press E';
  function renderTask() {
    const dismiss = isMobile ? 'Skip tutorial' : 'Skip tutorial [X]';
    switch (stage) {
      case 'realtor':
        if (arriving) {
          show('You made it', isMobile ? 'Tap to get out of the car.' : 'Press E to get out of the car.', dismiss);
          break;
        }
        show('Meet your realtor', (isMobile
          ? 'Use the left stick to walk and drag the right side of the screen to look. '
          : 'Walk with WASD and look with the mouse. ') +
          `Rita is waiting in front of your house across the street. Cross at the crosswalk and ${press} to talk.`, dismiss);
        break;
      case 'unload':
        show('Unload the car', carrying() === 'box'
          ? `Carry the box inside and ${press} by the living-room wall to set it down. ${trunk} left in the trunk.`
          : `Go to the back of your car and ${press} to take a box. ${trunk} left in the trunk.`, dismiss);
        break;
      case 'unpack':
        show('Unpack', `Open each box in the living room (${press}) and put your things away. ${pile} to go.`, dismiss);
        break;
      case 'phone':
        show('Check your phone', 'Rita sent you a message. Open the phone from the HUD. The map shows where things are, and Tasks keeps track of favours and work.', dismiss);
        break;
      case 'market':
        show('Walk to Maple Lane Market', `Follow the minimap route and use a marked crossing. At the market, ${press} to browse or talk.`, dismiss);
        break;
      case 'day':
        show('Make the day your own', 'Browse the market, ask a neighbour about a favour, or explore the park. Check your needs as you go and use the bed at home when you’re ready to end the day.',
          isMobile ? 'Finish tutorial' : 'Finish tutorial [X]');
        break;
    }
  }

  // --- minimap guidance ------------------------------------------------------------
  const guides = {
    rita: { id: 'day-one-rita', name: 'Rita', position: () => (rita ? { x: rita.position.x, z: rita.position.z } : { x: 0.95, z: -3.25 }) },
    trunk: { id: 'day-one-trunk', name: 'Your car', position: () => { const p = trunkPoint(); return { x: p.x, z: p.z }; } },
    home: { id: 'day-one-home', name: 'Your front door', position: () => ({ x: 0, z: -5.2 }) }
  };
  let guideKey = null;
  function guide(key) {
    if (guideKey === key) return;
    const current = g.minimap.getWaypointId();
    if (current && !current.startsWith('day-one-')) { guideKey = key; return; } // the player picked their own
    guideKey = key;
    g.minimap.setWaypoint(key ? guides[key] : null);
  }

  function clearWaypoint() {
    if (g.minimap.getWaypointId().startsWith('day-one-')) g.minimap.setWaypoint(null);
  }

  function finishTutorial() {
    if (stage === 'realtor') giveKeys();
    // Skipping the story: leave the boxes as they are (they can still be unpacked).
    stage = 'done';
    panel.hidden = true;
    ritaLeaves();
    syncLock();
    clearWaypoint();
    g.save();
  }

  function beginTutorial(seated = false) {
    syncLock();
    arriving = seated;
    panel.hidden = stage === 'done';
    renderTask();
    beginPlay();
    if (seated) g.car.enter({ engine: false });
    if (fresh) g.save();
  }

  const intro = createRoadTrip(g, () => beginTutorial(true), (weight, time) => rita?.wave(weight, time));

  action.addEventListener('click', () => {
    finishTutorial();
  });
  window.addEventListener('keydown', event => {
    if (event.code === 'KeyX' && !intro.active && !panel.hidden && !event.repeat && !event.ctrlKey && !event.metaKey && !event.altKey &&
        !event.target?.closest?.('input, textarea, [contenteditable]')) {
      action.click();
    }
  });

  return {
    start() {
      if (fresh) intro.start();
      else beginTutorial();
    },
    draw: intro.draw,
    get opening() { return intro.active; },
    update() {
      if (unpacking && performance.now() - unpacking >= UNPACK_SECONDS * 1000) finishUnpacking();
      if (!g.mode.started() || stage === 'done') return;
      if (arriving && !g.mode.driving()) {
        arriving = false;
        renderTask();
      }
      const phoneOpen = g.phone.isOpen();
      panel.hidden = g.mode.menuOpen() && !phoneOpen;
      const prior = stage;
      if (stage === 'phone' && phoneOpen) stage = 'market';
      if (stage === 'realtor') guide('rita');
      else if (stage === 'unload') guide(carrying() === 'box' ? 'home' : 'trunk');
      else if (stage === 'unpack') guide(null);
      if (stage === 'market' && !phoneOpen) {
        if (!marketWaypointSet) {
          marketWaypointSet = true;
          guideKey = null;
          const current = g.minimap.getWaypointId();
          if (!current || current.startsWith('day-one-')) g.minimap.setWaypoint(market);
        }
        if (Math.hypot(player.position.x - marketX, player.position.z - north) <= 4) {
          stage = 'day';
          clearWaypoint();
        }
      }
      if (prior !== stage) {
        renderTask();
        g.save();
      }
    },
    /** Extra dialogue pages for Rita and the neighbours' welcome. */
    pagesFor,
    /** Something in the task text depends on what you carry; refresh it. */
    refresh: renderTask,
    hide() { if (!intro.active) panel.hidden = true; },
    get stage() { return stage; },
    serialize: () => ({ stage, pile, unpacked, greeted: [...greeted] })
  };
}
