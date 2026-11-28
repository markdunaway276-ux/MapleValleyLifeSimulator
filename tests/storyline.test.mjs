// Run from the repo root with: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register(new URL('./helpers/threeHook.mjs', import.meta.url));

const THREE = await import('three');
const { NPC_DEFS, getNpc } = await import('../src/data/npcs.js');
const { getDialogue } = await import('../src/data/dialogue.js');
const { createCutscene, computeIntroShot } = await import('../src/systems/cutscene.js');
const { ACTIONS, actionForTarget } = await import('../src/systems/playerActions.js');
const { createStoryQuest, STORY_QUEST_REWARD } = await import('../src/systems/storyQuest.js');

test('new Maple Lane characters (Vince, Walt, Dr. Maya, Marcus) are registered with taglines and dialogue', () => {
  for (const id of ['vince', 'walt', 'maya', 'marcus']) {
    const def = getNpc(id);
    assert.ok(def, `expected NPC ${id}`);
    assert.ok(def.tagline && def.tagline.length > 0, `expected tagline for ${id}`);
    const dlg = getDialogue(id);
    assert.ok(dlg.pages.length >= 2, `expected multi-page dialogue for ${id}`);
  }
  assert.ok(NPC_DEFS.length >= 8);
});

test('computeIntroShot frames the NPC from the player side without clipping behind them', () => {
  const npcPos = { x: 10, y: 0, z: 20 };
  const playerPos = { x: 10, y: 1.6, z: 17.5 };
  const shot = computeIntroShot(npcPos, playerPos);
  // Player is at -Z relative to NPC, so the framed camera must stay on the -Z side.
  assert.ok(shot.pos.z < npcPos.z);
  assert.ok(shot.pos.y > 1.3 && shot.pos.y < 1.8);
  assert.equal(shot.lookAt.x, npcPos.x);
  // Camera looks down -Z; verify the resulting quaternion aims directly at the NPC, not 180° away.
  const camForward = new THREE.Vector3(0, 0, -1).applyQuaternion(shot.quat).normalize();
  const toNpc = new THREE.Vector3().subVectors(shot.lookAt, shot.pos).normalize();
  assert.ok(camForward.dot(toNpc) > 0.99, `expected camera to face NPC, got dot=${camForward.dot(toNpc)}`);
});

test('createCutscene plays intro once on first talk, holds through dialogue, then glides back to idle', () => {
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 1.6, 0);
  const player = { position: new THREE.Vector3(0, 1.6, 0) };
  const npc = { id: 'walt', position: new THREE.Vector3(0, 0, -2.5), wave() {} };
  let dialogueOpen = false;
  let openedIds = [];
  const dialogue = {
    open(id) { dialogueOpen = true; openedIds.push(id); return true; },
    isOpen: () => dialogueOpen
  };
  const seen = new Set();
  const cs = createCutscene({
    camera,
    player,
    npcs: { list: [npc] },
    dialogue,
    hasSeenIntro: (id) => seen.has(id),
    onIntroSeen: (id) => seen.add(id)
  });

  // First talk starts intro cutscene.
  assert.equal(cs.talkWithIntro('walt'), true);
  assert.equal(cs.state, 'intro');
  assert.equal(seen.has('walt'), true);

  // Advance past intro duration -> hands off to dialogue.
  cs.update(1.9);
  assert.equal(cs.state, 'dialogue');
  assert.deepEqual(openedIds, ['walt']);

  // Close dialogue -> transitions to exit glide -> returns to idle.
  dialogueOpen = false;
  cs.update(0.05);
  assert.equal(cs.state, 'exit');
  cs.update(0.6);
  assert.equal(cs.state, 'idle');
  assert.equal(cs.isActive(), false);

  // Repeat talk skips intro and opens dialogue directly.
  assert.equal(cs.talkWithIntro('walt'), true);
  assert.equal(cs.state, 'idle');
  assert.deepEqual(openedIds, ['walt', 'walt']);
});

test('action animations include unlockDoor, cook, drink, wave, and visible held props', () => {
  assert.equal(ACTIONS.unlockDoor.prop.name, 'keys');
  assert.equal(ACTIONS.eat.prop.name, 'snack');
  assert.equal(ACTIONS.drink.prop.name, 'cup');
  assert.equal(ACTIONS.cook.prop.name, 'spatula');
  assert.ok(ACTIONS.wave);
  assert.equal(actionForTarget({ userData: { kind: 'cook' } }), 'cook');
});

test('storyQuest (The Last Tenant) advances hidden -> walt -> vince -> done and pays welcome credit once', () => {
  let balance = 50;
  let saves = 0;
  const money = { add(n) { balance += n; } };
  const q = createStoryQuest({ money, save: () => { saves += 1; } });

  assert.equal(q.stage, 'hidden');
  assert.equal(q.task(), null);

  assert.equal(q.onNoteFound(), true);
  assert.equal(q.stage, 'walt');
  assert.equal(q.task().npcId, 'walt');

  const waltPage = q.pageFor('walt');
  assert.ok(waltPage && waltPage.action);
  assert.equal(waltPage.action.run(), true);
  assert.equal(q.stage, 'vince');
  assert.equal(q.task().npcId, 'vince');

  const vincePage = q.pageFor('vince');
  assert.ok(vincePage && vincePage.action);
  assert.equal(vincePage.action.run(), true);
  assert.equal(q.stage, 'done');
  assert.equal(q.task().complete, true);
  assert.equal(balance, 50 + STORY_QUEST_REWARD);
  assert.equal(q.pageFor('vince'), null);
  assert.equal(saves, 3);
});

test('exitCar action exists and Sam and Rita spawn well separated off each other', () => {
  assert.ok(ACTIONS.exitCar, 'expected exitCar action');
  assert.ok(ACTIONS.exitCar.duration > 0.5, 'expected noticeable step-out duration');
  const sam = getNpc('sam');
  const rita = getNpc('rita');
  assert.ok(sam && rita);
  const dist = Math.hypot(sam.patrol.startX - rita.patrol.startX, sam.patrol.z - rita.patrol.z);
  assert.ok(dist > 2.5, `expected Sam and Rita to start >2.5m apart, got ${dist.toFixed(2)}m`);
  assert.ok(Math.abs(sam.patrol.z - rita.patrol.z) >= 0.8, 'expected Rita off Sam sidewalk z-lane');
});

test('cutscene exit keeps player oriented toward the NPC instead of turning away', () => {
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(1.35, 1.6, -2.0);
  const player = {
    position: new THREE.Vector3(1.35, 1.6, -2.0),
    rotation: new THREE.Euler(0, Math.PI, 0, 'YXZ'), // originally facing away (+Z)
    mouseX: 12,
    mouseY: -5
  };
  const rita = { id: 'rita', position: new THREE.Vector3(1.35, 0, -4.45), wave() {} };
  let dialogueOpen = false;
  const dialogue = {
    open() { dialogueOpen = true; return true; },
    isOpen: () => dialogueOpen
  };
  const cs = createCutscene({
    camera,
    player,
    npcs: { list: [rita] },
    dialogue,
    hasSeenIntro: () => false,
    onIntroSeen: () => {}
  });

  cs.talkWithIntro('rita');
  cs.update(1.9);
  assert.equal(cs.state, 'dialogue');
  dialogueOpen = false;
  cs.update(0.05);
  assert.equal(cs.state, 'exit');
  cs.update(0.6);
  assert.equal(cs.state, 'idle');

  // Rita is due -Z from the player, so facing her means yaw ~ 0 (not PI).
  assert.ok(Math.abs(player.rotation.y) < 0.05, `expected yaw near 0 facing Rita, got ${player.rotation.y}`);
  assert.equal(player.rotation.x, 0);
  assert.equal(player.mouseX, 0);
  assert.equal(player.mouseY, 0);
});

test('truck-bed box grab actions open the bed cover and reveal the held box only when grabbed', () => {
  assert.ok(ACTIONS.openTruckBed, 'expected openTruckBed action');
  assert.ok(ACTIONS.reachTruckBox, 'expected reachTruckBox action');
  assert.ok(ACTIONS.openTruckBed.duration > ACTIONS.reachTruckBox.duration);
  assert.ok(ACTIONS.openTruckBed.boxFrom > 0.5 && ACTIONS.openTruckBed.boxFrom < 0.85);
  assert.ok(ACTIONS.reachTruckBox.boxFrom > 0.3 && ACTIONS.reachTruckBox.boxFrom < 0.7);
});

test('setOpeningDeerBeat is exported for Route 9 deer focus choreography', async () => {
  const { setOpeningDeerBeat, updateScenery } = await import('../src/world/scenery.js');
  assert.equal(typeof setOpeningDeerBeat, 'function');
  setOpeningDeerBeat(18.5);
  updateScenery(0.016, 0, { x: -175, z: 0 });
  setOpeningDeerBeat(null);
});

test('expanded main house has a roomy living room with clear open space in front of the sofa', async () => {
  const { KENNEY_INNER, SOFA_CENTER, CHAIR_DEFS, TV_CENTER, HOUSE_SCALE_XZ } = await import('../src/world/interior.js');
  assert.ok(HOUSE_SCALE_XZ >= 1.2, 'expected house scaled up horizontally');
  const livingW = KENNEY_INNER.frontRoomEast - KENNEY_INNER.west;
  const livingD = KENNEY_INNER.front - KENNEY_INNER.notchWall;
  assert.ok(livingW >= 6.8, `expected wider living room (>= 6.8m), got ${livingW.toFixed(2)}m`);
  assert.ok(livingD >= 3.5, `expected deeper living room (>= 3.5m), got ${livingD.toFixed(2)}m`);
  // Neither living-room chair sits directly between the sofa and the TV.
  for (const ch of CHAIR_DEFS.slice(0, 2)) {
    const blockingLine = Math.abs(ch.z - SOFA_CENTER.z) < 0.7 && ch.x > SOFA_CENTER.x && ch.x < TV_CENTER.x;
    assert.equal(blockingLine, false, `chair ${ch.id} should not block the sofa-to-TV sightline`);
  }
});

test('Android phone UI provides Material vector SVG icons for every installed app', async () => {
  const { INSTALLED_APPS } = await import('../src/ui/phone/apps.js');
  const { APP_ICON_META, ANDROID_STATUS_ICONS_SVG, FINGERPRINT_SVG } = await import('../src/ui/phone/icons.js');
  for (const app of INSTALLED_APPS) {
    const meta = APP_ICON_META[app.id];
    assert.ok(meta && meta.svg.includes('<svg'), `expected vector SVG icon for app ${app.id}`);
    assert.ok(meta.bg && meta.fg, `expected adaptive icon colors for app ${app.id}`);
  }
  assert.ok(ANDROID_STATUS_ICONS_SVG.includes('<svg'));
  assert.ok(FINGERPRINT_SVG.includes('<svg'));
});

test('nearestActionTarget prefers the looked-at target over closer side/behind triggers and Rita is clear of both mailbox and vending machine', async () => {
  const { nearestActionTarget } = await import('../src/systems/interactables.js');
  const { MAILBOX_SPAWN } = await import('../src/world/pickups.js');
  const { VENDING_SPAWN } = await import('../src/world/vending.js');
  const ritaDef = getNpc('rita');
  assert.equal(ritaDef.look.body, 'dottie', 'expected Rita to use a real sculpted 3D clothed body');
  const ritaToMailbox = Math.hypot(ritaDef.patrol.startX - MAILBOX_SPAWN.x, ritaDef.patrol.z - MAILBOX_SPAWN.z);
  const ritaToVending = Math.hypot(ritaDef.patrol.startX - VENDING_SPAWN.x, ritaDef.patrol.z - VENDING_SPAWN.z);
  assert.ok(ritaToMailbox >= 1.9, `expected Rita >=1.9m clear of mailbox, got ${ritaToMailbox.toFixed(2)}m`);
  assert.ok(ritaToVending >= 1.9, `expected Rita >=1.9m clear of vending machine, got ${ritaToVending.toFixed(2)}m`);

  const ritaObj = { isObject3D: true, visible: true, position: new THREE.Vector3(0, 1.5, -2.1), userData: { isNpc: true, kind: 'npc' } };
  const vendingObj = { isObject3D: true, visible: true, position: new THREE.Vector3(-0.7, 1.3, -0.8), userData: { kind: 'vending' } };
  const scene = {
    userData: {
      interactables: [
        { id: 'vending', kind: 'vending', object: vendingObj, range: 1.65 },
        { id: 'rita', kind: 'npc', object: ritaObj, range: 2.5 }
      ]
    }
  };
  const eye = new THREE.Vector3(0, 1.6, 0);
  // Looking straight along -Z (yaw = 0) at Rita: Rita wins even though vending machine is much closer (1.1m vs 2.1m).
  assert.equal(nearestActionTarget(scene, eye, 3, { yaw: 0, pitch: 0 }), ritaObj);
  // Turning to face the vending machine: vending wins.
  const yawToVending = Math.atan2(0.7, 0.8);
  assert.equal(nearestActionTarget(scene, eye, 3, { yaw: yawToVending, pitch: 0 }), vendingObj);
});

test('Maple Lane Post Office builds with walkable door, PO Box #14, curbside dropbox, and Hank clerk', async () => {
  const { buildPostOffice, POST_OFFICE } = await import('../src/world/postOffice.js');
  const scene = new THREE.Scene();
  scene.userData = { doors: [], interactables: [], colliders: { addHouse: (h) => h } };
  const root = buildPostOffice(scene, { shadows: false });
  assert.equal(root.name, 'maple-lane-post-office');
  assert.equal(scene.userData.postOffice, root);
  assert.equal(scene.userData.doors.length, 1);
  assert.ok(scene.userData.interactables.some((e) => e.id === 'post-office-dropbox'));
  assert.ok(scene.userData.interactables.some((e) => e.id === 'post-office-pobox14'));
  assert.ok(POST_OFFICE.x > 40);
  const hank = getNpc('hank');
  assert.ok(hank && hank.tagline === 'Maple Lane Post Office');
  const dlg = getDialogue('hank');
  assert.ok(dlg.pages.length >= 2);
});

test('fullscreen toggle enters and exits fullscreen cleanly across standard and webkit APIs', async () => {
  const { isFullscreenActive, toggleFullscreen } = await import('../src/ui/hudFullscreen.js');
  const mockDoc = {
    fullscreenElement: null,
    documentElement: {
      async requestFullscreen() { mockDoc.fullscreenElement = mockDoc.documentElement; }
    },
    async exitFullscreen() { mockDoc.fullscreenElement = null; }
  };
  assert.equal(isFullscreenActive(mockDoc), false);
  assert.equal(await toggleFullscreen(mockDoc), true);
  assert.equal(isFullscreenActive(mockDoc), true);
  assert.equal(await toggleFullscreen(mockDoc), false);
  assert.equal(isFullscreenActive(mockDoc), false);
});

test('phone Messages, Style, and Map apps support two-way threads, smooth HiDPI preview, and daylight nav cartography', async () => {
  const { createInbox } = await import('../src/data/mail.js');
  const inbox = createInbox();
  inbox.add({ id: 'r1', threadId: 'rita', from: 'Rita', sender: 'them', body: 'Welcome to Maple Lane!', day: 1, time: '8:30 AM' });
  inbox.add({ id: 'r2', threadId: 'rita', from: 'Rita', sender: 'me', body: 'Thanks for the keys!', day: 1, time: '8:31 AM', read: true });
  assert.equal(inbox.get().length, 2);
  assert.equal(inbox.get()[0].sender, 'me');
  assert.equal(inbox.get()[1].read, undefined);
  inbox.markRead('rita');
  assert.equal(inbox.get().every((m) => m.read === true), true);

  const { STYLE_PREVIEW_WIDTH, STYLE_PREVIEW_HEIGHT } = await import('../src/ui/phone/style.js');
  assert.ok(STYLE_PREVIEW_WIDTH >= 240 && STYLE_PREVIEW_HEIGHT >= 300);

  const { NAV_MAP_COLORS } = await import('../src/ui/minimap.js');
  const { renderMapApp } = await import('../src/ui/phone/mapApp.js');
  assert.equal(typeof renderMapApp, 'function');
  assert.equal(NAV_MAP_COLORS.road, '#ffffff');
  assert.equal(NAV_MAP_COLORS.player, '#1a73e8');
});

test('Phase 1: Hair & Shoes style slots, Grocery home cooking, and 3D Home Decor catalogue work cleanly', async () => {
  const { APPEARANCE_SLOTS, DEFAULT_APPEARANCE } = await import('../src/data/appearance.js');
  const slotIds = APPEARANCE_SLOTS.map((s) => s.id);
  assert.ok(slotIds.includes('hair') && slotIds.includes('shoes'));
  assert.equal(DEFAULT_APPEARANCE.hair, 'espresso');
  assert.equal(DEFAULT_APPEARANCE.shoes, 'charcoal');

  const { createSkills } = await import('../src/systems/skills.js');
  let hunger = 20;
  let mood = 40;
  let removedSlot = -1;
  const skills = createSkills({});
  const cooked = skills.cook({
    needs: { get: (k) => (k === 'hunger' ? hunger : mood), add: (k, d) => { if (k === 'hunger') hunger += d; if (k === 'mood') mood += d; } },
    inventory: {
      getSlots: () => [{ id: 'groceries', count: 1 }],
      removeAt: (idx) => { removedSlot = idx; }
    }
  });
  assert.equal(cooked, true);
  assert.equal(removedSlot, 0);
  assert.equal(hunger, 95);
  assert.equal(mood, 58);

  const { createHomeDecor } = await import('../src/world/homeDecor.js');
  const scene = new THREE.Scene();
  const decor = createHomeDecor({ scene, shadows: false });
  assert.equal(decor.has('living-rug'), false);
  let balance = 50;
  const res = decor.buy('living-rug', {
    money: { spend: (amt) => { if (balance < amt) return false; balance -= amt; return true; } }
  });
  assert.equal(res.ok, true);
  assert.equal(decor.has('living-rug'), true);
  assert.equal(balance, 25);
  assert.deepEqual(decor.serialize(), ['living-rug']);
});

test('Phase 2: Hank Post Office Parcel Delivery shift runs 3 stops, pays tips + route bonus, and tracks completed routes', async () => {
  const { createParcelDelivery, DELIVERY_STOPS, ROUTE_BONUS } = await import('../src/systems/parcelDelivery.js');
  const scene = new THREE.Scene();
  scene.userData = { interactables: [] };
  let earned = 0;
  let carried = null;
  const delivery = createParcelDelivery({
    scene,
    money: { add: (amt) => { earned += amt; } },
    actions: { get carrying() { return carried; }, setCarry: (v) => { carried = v; }, play() {} },
    isDayOneUnloadActive: () => false
  });
  const hankOffer = delivery.pageFor('hank');
  assert.ok(hankOffer && hankOffer.action);
  assert.equal(hankOffer.action.run(), true);
  assert.equal(delivery.active, true);
  assert.equal(delivery.task().npcId, DELIVERY_STOPS[0].id);

  // Deliver all 3 parcels by grabbing each from the pickup bed and handing to the recipient.
  const bedEntry = scene.userData.interactables.find((e) => e.id === 'pickup-bed-utility');
  assert.ok(bedEntry);
  for (let i = 0; i < DELIVERY_STOPS.length; i++) {
    const action = bedEntry.object.userData.interact({});
    assert.ok(action === 'openTruckBed' || action === 'reachTruckBox');
    const recipientPage = delivery.pageFor(DELIVERY_STOPS[i].id);
    assert.ok(recipientPage && recipientPage.action);
    assert.equal(recipientPage.action.run(), true);
  }
  const expectedPay = DELIVERY_STOPS.reduce((sum, s) => sum + s.pay + s.tip, 0) + ROUTE_BONUS;
  assert.equal(earned, expectedPay);
  assert.equal(delivery.active, false);
  assert.equal(delivery.completedRoutes, 1);
});

test('Phase 4: Chapter 2 (PO Box #14) progresses locked -> hank -> maya -> walt -> done, texts inbox, and pays $50 reward', async () => {
  const { createMysteryChapter2, CHAPTER2_REWARD } = await import('../src/systems/mysteryChapter2.js');
  let cash = 0;
  let mood = 50;
  const msgs = [];
  const bag = [];
  const ch2 = createMysteryChapter2({
    money: { add: (n) => { cash += n; } },
    needs: { add: (k, d) => { if (k === 'mood') mood += d; } },
    inventory: { add: (item) => bag.push(item) },
    inbox: { add: (m) => msgs.push(m) }
  });
  assert.equal(ch2.stage, 'locked');
  assert.equal(ch2.task(), null);

  assert.equal(ch2.unlock(), true);
  assert.equal(ch2.stage, 'hank');
  assert.equal(msgs.length, 1);

  const hankPage = ch2.pageFor('hank');
  assert.ok(hankPage && hankPage.action);
  assert.equal(hankPage.action.run(), true);
  assert.equal(ch2.stage, 'maya');
  assert.equal(bag[0].id, 'kyle-parcel');

  const mayaPage = ch2.pageFor('maya');
  assert.ok(mayaPage && mayaPage.action);
  assert.equal(mayaPage.action.run(), true);
  assert.equal(ch2.stage, 'walt');

  const waltPage = ch2.pageFor('walt');
  assert.ok(waltPage && waltPage.action);
  assert.equal(waltPage.action.run(), true);
  assert.equal(ch2.stage, 'done');
  assert.equal(ch2.task().complete, true);
  assert.equal(cash, CHAPTER2_REWARD);
  assert.equal(mood, 80);
  assert.equal(msgs.length, 3);
});

test('Phase 3: Friendship tiers grow & send proactive daily texts, and Maple Lane Park has sittable swings + pond ducks', async () => {
  const { createFriendship } = await import('../src/systems/friendship.js');
  const texts = [];
  const toasts = [];
  const fr = createFriendship({
    inbox: { add: (m) => texts.push(m) },
    toast: (msg) => toasts.push(msg)
  });
  assert.equal(fr.get('sam').hearts, 1);
  fr.add('sam', 22, 'Sam');
  assert.equal(fr.get('sam').hearts, 2);
  assert.equal(fr.get('sam').label, 'Friendly');
  assert.ok(toasts.some((t) => /Sam/.test(t) && /Friendly/.test(t)));

  assert.equal(fr.onNewDay(2), true);
  assert.equal(texts.length, 1);
  assert.equal(texts[0].threadId, 'sam');

  const { buildPark } = await import('../src/world/park.js');
  const scene = new THREE.Scene();
  scene.userData = { colliders: { addHouse() {}, addTree() {} } };
  const mat = new THREE.MeshBasicMaterial();
  const parkApi = buildPark(scene, { shadows: false }, { road: mat, walk: mat, curb: mat });
  assert.ok(Array.isArray(scene.userData.seats) && scene.userData.seats.length >= 2);
  let duckCount = 0;
  scene.traverse((o) => { if (o.name === 'park-pond-duck') duckCount++; });
  assert.equal(duckCount, 2);
  assert.equal(typeof parkApi.update, 'function');
  parkApi.update(720);
});





