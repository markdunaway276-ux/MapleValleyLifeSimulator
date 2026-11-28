import { createRoadTrip } from './roadTrip.js';
import * as THREE from 'three';
import { STREET } from '../world/street.js';
import { createNpc } from '../world/npc.js';
import { STORY_NPCS } from '../data/npcs.js';
import { toggleDoor } from '../systems/doors.js';
import { DESK_CENTER } from '../world/interior.js';

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
/** Box pile in the living room: along the front wall, west of the door, clear of the sofa & coffee table. */
const PILE = { x: -2.45, z: -6.50 };
const RITA_TEXT = 'Hope the unpacking went OK! Sam and June down the street are friendly, and Vince at the Market ' +
  'has everything for a first dinner. Dottie at the Laundromat is looking for help too. Welcome to Maple Lane! - Rita';
const TENANT_NOTE = "If you're reading this, you got the place cheap. Don't trust how quiet Maple Lane looks — " +
  'talk to Walt down by the Trailer Park if you want to know why I cleared out in a hurry. — Kyle';

function readSaved(saved) {
  if (saved && typeof saved === 'object') return saved;
  if (typeof saved === 'string') return { stage: saved === 'walk' ? 'phone' : saved };
  return null;
}

function makeBoxMesh(seed = 0) {
  const g = new THREE.Group();
  const cardColor = [0xb98d5b, 0xa8804f, 0xc29a68][seed % 3];
  const card = new THREE.MeshStandardMaterial({ color: cardColor, roughness: 0.9 });
  const flapMat = new THREE.MeshStandardMaterial({ color: cardColor, roughness: 0.92 });
  const tape = new THREE.MeshStandardMaterial({ color: 0xd9c9a3, roughness: 0.6 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.36, 0.42), card);
  body.position.y = 0.18;
  body.castShadow = body.receiveShadow = true;

  // Two hinged top flaps so unpacking visibly opens the box in 3D.
  const leftFlap = new THREE.Group();
  leftFlap.position.set(-0.25, 0.365, 0);
  const leftLeaf = new THREE.Mesh(new THREE.BoxGeometry(0.248, 0.014, 0.416), flapMat);
  leftLeaf.position.set(0.124, 0, 0);
  leftLeaf.castShadow = leftLeaf.receiveShadow = true;
  leftFlap.add(leftLeaf);

  const rightFlap = new THREE.Group();
  rightFlap.position.set(0.25, 0.365, 0);
  const rightLeaf = new THREE.Mesh(new THREE.BoxGeometry(0.248, 0.014, 0.416), flapMat);
  rightLeaf.position.set(-0.124, 0, 0);
  rightLeaf.castShadow = rightLeaf.receiveShadow = true;
  rightFlap.add(rightLeaf);

  const strip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.005, 0.425), tape);
  strip.position.y = 0.376;
  g.add(body, leftFlap, rightFlap, strip);
  g.userData.flaps = { left: leftFlap, right: rightFlap, strip };
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
  const seenIntros = new Set(Array.isArray(saved?.seenIntros) ? saved.seenIntros : []);
  let doorUnlocked = saved?.doorUnlocked ?? (stage !== 'realtor' && stage !== 'unload');
  let arriving = false;
  let marketWaypointSet = false;
  let unpacking = null; // performance.now() when the current box was opened
  let rita = null;

  const north = STREET.roadCenterZ + STREET.roadWidth / 2 + STREET.sidewalkWidth / 2;
  const marketX = scene.userData.cornerShop.position.x;
  const market = { id: 'day-one-market', name: 'Maple Lane Market', position: () => ({ x: marketX, z: north }) };
  const carObject = () => g.car?.object ?? scene.userData.prop ?? scene.getObjectByName('parked-car');
  const rearEdge = carObject().userData.size.width / 2;
  const trunkLocal = new THREE.Vector3(-rearEdge - 0.08, 0.95, 0);
  const trunkPoint = () => carObject().localToWorld(trunkLocal.clone());
  // The car's own "enter car" point is the nearest point of its box to you, so
  // behind the car the trunk point sits just in front of that (closer wins).
  const _local = new THREE.Vector3();
  function behindCar() {
    const car = carObject();
    if (!car) return false;
    car.worldToLocal(_local.set(player.position.x, 0, player.position.z));
    return _local.x < -rearEdge + 0.25 && Math.abs(_local.z) < 1.3;
  }
  function trunkTarget() {
    const car = carObject();
    car.worldToLocal(_local.set(player.position.x, 0, player.position.z));
    _local.set(-rearEdge - 0.08, 0, THREE.MathUtils.clamp(_local.z, -0.9, 0.9) * 0.9);
    car.localToWorld(_local);
    return { x: _local.x, y: 1.6, z: _local.z };
  }

  // --- the front door: locked until Rita hands you the keys, then unlocks with a key animation ---
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
    const needsCustomInteract = stage === 'realtor' || !doorUnlocked;
    if (needsCustomInteract && door && lockedDoor !== door) {
      lockedDoor = door;
      if (stage === 'realtor' && door.userData.open) toggleDoor(door, true);
      door.userData.interact = (ctx) => {
        if (stage === 'realtor') {
          ctx?.toast?.("It's locked. Rita has your keys.");
          g.sfx?.play?.('click');
          return false;
        }
        if (!doorUnlocked) {
          doorUnlocked = true;
          ctx?.toast?.('Unlocked the front door.');
          g.sfx?.play?.('pickup');
          toggleDoor(door);
          delete door.userData.interact;
          lockedDoor = null;
          g.save();
          return 'unlockDoor';
        }
        return toggleDoor(door);
      };
    } else if (!needsCustomInteract && lockedDoor) {
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
  // --- unpacked personal items that bring the house to life ------------------
  const keepsakes = new THREE.Group();
  keepsakes.name = 'day-one-keepsakes';
  scene.add(keepsakes);

  // Box 1: crate of books + compact radio by the living room wall.
  const box1Props = new THREE.Group();
  box1Props.position.set(PILE.x + 0.12, 0.02, PILE.z);
  const crate = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.24, 0.34), new THREE.MeshStandardMaterial({ color: 0x6f5136, roughness: 0.88 }));
  crate.position.y = 0.12;
  const book1 = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 0.24), new THREE.MeshStandardMaterial({ color: 0x3b5848, roughness: 0.85 }));
  book1.position.set(-0.08, 0.26, 0.01);
  book1.rotation.y = 0.12;
  const book2 = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.035, 0.22), new THREE.MeshStandardMaterial({ color: 0x8a3a2f, roughness: 0.85 }));
  book2.position.set(-0.07, 0.298, 0);
  book2.rotation.y = -0.08;
  const radio = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.13, 0.11), new THREE.MeshStandardMaterial({ color: 0x2c3035, roughness: 0.55, metalness: 0.2 }));
  radio.position.set(0.11, 0.305, -0.02);
  box1Props.add(crate, book1, book2, radio);

  // Box 2: framed photo, mug, and notebook on top of the home desk.
  const box2Props = new THREE.Group();
  box2Props.position.set(DESK_CENTER.x, 0.74, DESK_CENTER.z);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.17, 0.14), new THREE.MeshStandardMaterial({ color: 0x4b3523, roughness: 0.75 }));
  frame.position.set(0.08, 0.085, -0.18);
  frame.rotation.y = -0.25;
  const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.036, 0.095, 10), new THREE.MeshStandardMaterial({ color: 0xd9cbb2, roughness: 0.55 }));
  mug.position.set(-0.06, 0.048, 0.18);
  const notebook = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.018, 0.24), new THREE.MeshStandardMaterial({ color: 0x384d62, roughness: 0.85 }));
  notebook.position.set(-0.04, 0.009, -0.02);
  notebook.rotation.y = 0.18;
  box2Props.add(frame, mug, notebook);

  // Box 3: Kyle's folded yellowed note left on the living room floor.
  const box3Props = new THREE.Group();
  box3Props.position.set(PILE.x + 0.52, 0.026, PILE.z + 0.10);
  const notePaper = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.005, 0.12), new THREE.MeshStandardMaterial({ color: 0xe6d6a8, roughness: 0.9 }));
  notePaper.rotation.y = 0.42;
  box3Props.add(notePaper);

  keepsakes.add(box1Props, box2Props, box3Props);
  function syncKeepsakes() {
    box1Props.visible = unpacked >= 1;
    box2Props.visible = unpacked >= 2;
    box3Props.visible = unpacked >= 3;
  }

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
    syncKeepsakes();
    const world = scene.userData.colliders;
    if (world?.addHouse && pile > 0) {
      world.addHouse({ id: 'day-one-boxes', minX: PILE.x - 0.3, maxX: PILE.x + 0.85, minZ: PILE.z - 0.25, maxZ: PILE.z + 0.25 });
    } else world?.remove?.('day-one-boxes');
  }
  syncPile();

  // --- Day 1 arrival chapter banner ("DAY 1 / MAPLE LANE") -------------------
  const chapterEl = document.createElement('div');
  chapterEl.className = 'day-one-chapter';
  chapterEl.innerHTML = '<strong>DAY 1</strong><span>MAPLE LANE</span>';
  document.body.appendChild(chapterEl);
  let chapterShown = false;
  function showChapterBanner() {
    if (chapterShown) return;
    chapterShown = true;
    chapterEl.classList.add('is-visible');
    window.setTimeout(() => chapterEl.classList.remove('is-visible'), 2600);
  }

  const cargo = carObject().userData.pickupCargo;
  if (cargo) {
    const slots = [[-1.42, 0.93, -0.27, 0.05], [-1.43, 0.93, 0.29, -0.08], [-1.99, 0.94, 0, 0.12]];
    for (const [i, [x, y, z, angle]] of slots.entries()) {
      const box = makeBoxMesh(i);
      box.position.set(x, y, z);
      box.rotation.y = angle;
      box.visible = (stage === 'realtor' || stage === 'unload') && i < trunk;
      cargo.add(box);
    }
  }

  const prompt = (verb) => (isMobile ? 'Tap to ' : 'Press E to ') + verb;
  const carrying = () => g.actions?.carrying;

  let bedOpen = false;
  let bedAnim = null;       // { from, to, start, duration }
  let pendingHideBox = null; // { box, at }
  function animateBed(to, delayMs = 0, duration = 480) {
    const cur = carObject()?.userData?.bedCover ? -carObject().userData.bedCover.rotation.z / 0.92 : (bedOpen ? 1 : 0);
    bedOpen = to > 0.5;
    bedAnim = { from: cur, to, start: performance.now() + delayMs, duration };
  }

  const trunkSpot = new THREE.Object3D();
  trunkSpot.name = 'day-one-trunk';
  scene.add(trunkSpot);
  trunkSpot.getPoint = () => trunkTarget(); // the interact path reads the object's getPoint
  trunkSpot.userData.getPrompt = () => prompt(
    bedOpen ? `reach in for a box (${trunk} left)` : `open truck bed & take box (${trunk} left)`
  );
  trunkSpot.userData.interact = (ctx) => {
    if (carrying()) { ctx?.toast?.('Your hands are full.'); return false; }
    if (trunk <= 0) return false;
    const grabbedIndex = trunk - 1;
    trunk -= 1;
    const boxMesh = cargo ? cargo.children[grabbedIndex] : null;
    const needsOpen = !bedOpen;
    if (needsOpen) {
      g.sfx?.play?.('click');
      animateBed(1, 250, 480);
    }
    if (boxMesh) {
      pendingHideBox = { box: boxMesh, at: performance.now() + (needsOpen ? 1020 : 480) };
    }
    if (trunk === 0) {
      window.setTimeout(() => {
        if (bedOpen && trunk === 0) animateBed(0, 0, 520);
      }, needsOpen ? 1850 : 1350);
    }
    g.actions.setCarry('box');
    renderTask();
    return needsOpen ? 'openTruckBed' : 'reachTruckBox';
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
    { id: 'day-one-pile', kind: 'boxes', object: pileSpot, range: 2.0,
      enabled: () => (stage === 'unload' && carrying() === 'box') || (stage === 'unpack' && pile > 0) }
  );

  function triggerSamDoorKnock() {
    // Rhythmic knock-knock-knock at the front door, and position Sam on your front walk.
    const sam = g.npcs?.list?.find?.((n) => n && n.id === 'sam');
    if (sam && sam.position) {
      sam.position.x = 0.0;
      sam.position.z = -3.7;
    }
    g.sfx?.play?.('click');
    window.setTimeout(() => g.sfx?.play?.('click'), 220);
    window.setTimeout(() => g.sfx?.play?.('click'), 440);
    window.setTimeout(() => {
      g.hud?.toast?.("Knock, knock… Sam is waiting out by your front path!");
    }, 520);
  }

  function finishUnpacking() {
    unpacking = null;
    pile -= 1;
    unpacked += 1;
    syncPile();
    g.sfx?.play?.('pickup');
    if (unpacked === 1) {
      g.hud?.toast?.('Unpacked your books & radio.');
    } else if (unpacked === 2) {
      g.hud?.toast?.('Set up your desk.');
    }
    if (pile === 0) {
      stage = 'phone';
      g.inbox?.add({ id: 'rita-welcome', from: 'Rita (Maple Lane Realty)', body: RITA_TEXT });
      g.inbox?.add({ id: 'last-tenant-note', from: 'Folded Note (Under Floorboard)', body: TENANT_NOTE });
      g.storyQuest?.onNoteFound?.();
      g.hud?.toast?.('Found a folded note under the floorboards — check your Phone!');
      window.setTimeout(triggerSamDoorKnock, 2400);
    }
    renderTask();
    g.prompt?.update();
    g.save();
  }

  // --- conversations -----------------------------------------------------------
  const WELCOME = {
    sam: ["Hang on, you're the one who just moved in? Welcome to Maple Lane!",
      "Brought you a snack for the first day — heard Kyle left in a rush. Ask Walt by the Trailer Park if you want the full story."],
    june: ['Oh, you must be our new neighbour! I saw your pickup roll in off Route 9.',
      "Stop by the Market and say hi to Vince. And try the coffee at Fuel & Go — Danny keeps it strong."],
    vince: ["New face on Maple Lane, huh? I'm Vince — I run the Market.",
      "Grab groceries whenever you need, and if you're looking for work later, ask around at the Laundromat or Fuel & Go."],
    walt: ["Saw you hauling boxes into Kyle's old place. Name's Walt.",
      "If you found his note, don't let it spook you — just keep your head on straight in this town."],
    maya: ["You must be the newcomer down the block. I'm Dr. Maya at the Clinic.",
      "Moving's rough on anyone — remember to eat and get some sleep before you burn out."],
    marcus: ["Hey — saw that pickup parked across from the house. I'm Marcus.",
      "Good truck. Keep it fueled up at Fuel & Go and you'll be set."]
  };
  function pagesFor(id) {
    if (id === 'rita') {
      if (stage === 'realtor') {
        return [
          { lines: ["You made it! I'm Rita, from Maple Lane Realty.", "Previous tenant cleared out in a hurry, so you got the place cheap."] },
          { lines: ["Bills come due fast out here, so meet Vince at the Market and Dottie at the Laundromat if you need cash.", "All the paperwork's signed — just one thing left."],
            action: { label: 'Take the keys', run: giveKeys },
            response: ["There you go. Front door, and the little one's for the mailbox.",
              'Get those boxes out of the truck bed and make yourself at home.'] }
        ];
      }
      return [{ lines: ["I'd help with the boxes, but my back's retired even if I'm not.",
        'Vince at the Market and Dottie at the Laundromat are good folks to know first.'] }];
    }
    if (WELCOME[id] && !greeted.has(id) && stage !== 'realtor') {
      greeted.add(id);
      if (id === 'sam') {
        g.inventory?.add?.({ id: 'snack', count: 1 });
        g.hud?.toast?.('Sam gave you a housewarming snack!');
      }
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
    const dismiss = isMobile ? '×' : 'Skip [X]';
    action.setAttribute('aria-label', stage === 'day' ? 'Finish tutorial' : 'Skip tutorial');
    switch (stage) {
      case 'realtor':
        if (arriving) {
          show('You made it', isMobile ? 'Tap to exit the pickup.' : 'Press E to get out of the pickup.', dismiss);
          break;
        }
        show('Meet Rita', (isMobile
          ? 'Cross to your house and tap to talk to Rita.'
          : 'Walk with WASD, look with mouse. Cross to your house and press E to talk to Rita.'), dismiss);
        break;
      case 'unload':
        show('Unload truck', carrying() === 'box'
          ? `Set box by living-room wall (${trunk} left).`
          : `Take a box from the truck bed (${trunk} left).`, dismiss);
        break;
      case 'unpack':
        show('Unpack', `Open each box inside (${pile} left).`, dismiss);
        break;
      case 'phone':
        show('Check Phone', 'New message from Rita & a folded note from Kyle.', dismiss);
        break;
      case 'market':
        show('Meet Maple Lane', 'Follow the map to the Market or talk to Sam, June & Walt.', dismiss);
        break;
      case 'day':
        show('Day 1', 'Explore town, take a shift, or sleep at home to end the day.',
          isMobile ? '×' : 'Done [X]');
        break;
    }
  }

  // --- minimap guidance ------------------------------------------------------------
  const guides = {
    rita: { id: 'day-one-rita', name: 'Rita', position: () => (rita ? { x: rita.position.x, z: rita.position.z } : { x: -1.35, z: -4.45 }) },
    trunk: { id: 'day-one-trunk', name: 'Your pickup', position: () => { const p = trunkPoint(); return { x: p.x, z: p.z }; } },
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
    doorUnlocked = true;
    // Leave boxes already delivered to the living room in place.
    if (cargo) for (const box of cargo.children) box.visible = false;
    pendingHideBox = null;
    if (bedOpen) animateBed(0, 0, 420);
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
      const now = performance.now();
      if (bedAnim) {
        const raw = (now - bedAnim.start) / bedAnim.duration;
        if (raw >= 0) {
          const t = Math.min(1, raw);
          const ease = t * t * (3 - 2 * t);
          carObject()?.userData?.setBedOpen?.(THREE.MathUtils.lerp(bedAnim.from, bedAnim.to, ease));
          if (t >= 1) bedAnim = null;
        }
      }
      if (pendingHideBox && now >= pendingHideBox.at) {
        pendingHideBox.box.visible = false;
        g.sfx?.play?.('pickup');
        pendingHideBox = null;
      }
      if (bedOpen && g.mode.driving() && !bedAnim) {
        animateBed(0, 0, 420);
      }
      if (unpacking) {
        const progress = Math.min(1, (now - unpacking) / (UNPACK_SECONDS * 1000));
        // Fold the top moving box's cardboard flaps open as you unpack it.
        const topBox = pileGroup.children[pileGroup.children.length - 1];
        if (topBox && topBox.userData.flaps) {
          const open = Math.min(1, progress * 1.45);
          const ease = open * open * (3 - 2 * open);
          const angle = ease * (Math.PI * 0.68);
          topBox.userData.flaps.left.rotation.z = angle;
          topBox.userData.flaps.right.rotation.z = -angle;
          topBox.userData.flaps.strip.visible = progress < 0.14;
        }
        if (progress >= 1) finishUnpacking();
      }
      if (!g.mode.started() || stage === 'done') return;
      if (arriving && !g.mode.driving()) {
        arriving = false;
        showChapterBanner();
        // Gently face across the street toward Rita and your new house.
        if (player?.rotation) {
          const dx = -1.35 - player.position.x;
          const dz = -4.45 - player.position.z;
          player.rotation.y = Math.atan2(-dx, -dz);
        }
        renderTask();
      }
      const phoneOpen = g.phone.isOpen();
      panel.hidden = (g.mode.menuOpen() && !phoneOpen) || !!g.cutscene?.isActive?.();
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
    /** Track which neighbour intro cutscenes have already played. */
    hasSeenIntro: (id) => seenIntros.has(id),
    markIntroSeen(id) {
      if (!id || seenIntros.has(id)) return;
      seenIntros.add(id);
      g.save();
    },
    /** Something in the task text depends on what you carry; refresh it. */
    refresh: renderTask,
    hide() { if (!intro.active) panel.hidden = true; },
    get stage() { return stage; },
    serialize: () => ({ stage, pile, unpacked, doorUnlocked, greeted: [...greeted], seenIntros: [...seenIntros] })
  };
}
