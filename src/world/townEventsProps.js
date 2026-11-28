import * as THREE from 'three';
import { FLOOR_Y, KENNEY_INNER } from './interior.js';
import { SURFACE_Y } from './street.js';

/**
 * 3D World Props for Weekly Town Events:
 *  - Saturday Farmers' Market pop-up stalls in Maple Lane Park Plaza
 *  - Sunday Fishing Derby leaderboard stand beside Maple Lane Pond
 *  - Permanent 3D Golden Trout Trophy displayed inside the player's house once won
 */

function makeMarketStall(name, stripeHex, accentHex, shadows) {
  const g = new THREE.Group();
  g.name = name;

  const woodMat = new THREE.MeshStandardMaterial({ color: 0x875f3c, roughness: 0.88 });
  const clothMat = new THREE.MeshStandardMaterial({ color: 0xf4efe4, roughness: 0.9 });
  const stripeMat = new THREE.MeshStandardMaterial({ color: stripeHex, roughness: 0.85 });
  const accentMat = new THREE.MeshStandardMaterial({ color: accentHex, roughness: 0.72 });

  // 4 corner canopy posts
  const postGeo = new THREE.BoxGeometry(0.08, 2.25, 0.08);
  for (const sx of [-1.25, 1.25]) {
    for (const sz of [-0.85, 0.85]) {
      const post = new THREE.Mesh(postGeo, woodMat);
      post.position.set(sx, 1.125, sz);
      post.castShadow = shadows;
      g.add(post);
    }
  }

  // Striped pitched canopy roof
  for (let i = 0; i < 5; i++) {
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(0.54, 0.06, 2.05),
      i % 2 === 0 ? stripeMat : clothMat
    );
    strip.position.set(-1.08 + i * 0.54, 2.30, 0);
    strip.rotation.x = 0.08;
    strip.castShadow = shadows;
    g.add(strip);
  }

  // Display counter table + cloth
  const table = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.82, 0.82), woodMat);
  table.position.set(0, 0.41, 0.15);
  table.castShadow = table.receiveShadow = shadows;
  g.add(table);

  const runner = new THREE.Mesh(new THREE.BoxGeometry(2.40, 0.04, 0.86), stripeMat);
  runner.position.set(0, 0.83, 0.15);
  g.add(runner);

  // Goods crates on counter
  for (let c = 0; c < 3; c++) {
    const crate = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.22, 0.44), woodMat);
    crate.position.set(-0.72 + c * 0.72, 0.96, 0.15);
    g.add(crate);
    const goods = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16, 0), accentMat);
    goods.position.set(-0.72 + c * 0.72, 1.10, 0.15);
    goods.scale.set(1.3, 0.75, 1.1);
    g.add(goods);
  }

  return g;
}

function makeDerbyStand(shadows) {
  const g = new THREE.Group();
  g.name = 'park-derby-stand';

  const woodMat = new THREE.MeshStandardMaterial({ color: 0x6b4b30, roughness: 0.88 });
  const boardMat = new THREE.MeshStandardMaterial({ color: 0x223648, roughness: 0.75 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xe3b84c, roughness: 0.32, metalness: 0.78 });

  for (const sx of [-0.72, 0.72]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.10, 2.05, 0.10), woodMat);
    post.position.set(sx, 1.025, 0);
    post.castShadow = shadows;
    g.add(post);
  }
  const board = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.92, 0.08), boardMat);
  board.position.set(0, 1.48, 0);
  board.castShadow = shadows;
  g.add(board);

  // Golden trout emblem atop the derby board
  const emblem = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), goldMat);
  emblem.position.set(0, 2.12, 0);
  emblem.scale.set(1.85, 0.72, 0.45);
  g.add(emblem);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.22, 4), goldMat);
  tail.position.set(-0.32, 2.12, 0);
  tail.rotation.z = -Math.PI / 2;
  g.add(tail);

  return g;
}

function makeHouseTrophy(shadows) {
  const g = new THREE.Group();
  g.name = 'home-derby-trophy';

  const walnut = new THREE.MeshStandardMaterial({ color: 0x4b311e, roughness: 0.74 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xe8bc4c, roughness: 0.28, metalness: 0.84 });

  // Small pedestal stand against the front living-room wall
  const pedestal = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.78, 0.36), walnut);
  pedestal.position.y = 0.39;
  pedestal.castShadow = pedestal.receiveShadow = shadows;
  g.add(pedestal);

  // Trophy plinth
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.07, 0.16), walnut);
  plinth.position.y = 0.815;
  g.add(plinth);

  // Brass plaque
  const plaque = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.035, 0.01), gold);
  plinth.add(plaque);
  plaque.position.set(0, 0, -0.082);

  // Golden leaping trout
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.022, 0.14, 8), gold);
  stem.position.y = 0.91;
  g.add(stem);

  const fish = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), gold);
  fish.position.set(0, 1.01, 0);
  fish.scale.set(1.9, 0.78, 0.48);
  fish.rotation.z = 0.22;
  fish.castShadow = shadows;
  g.add(fish);

  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.11, 4), gold);
  tail.position.set(-0.14, 0.98, 0);
  tail.rotation.z = -Math.PI / 2 + 0.22;
  g.add(tail);

  g.position.set(-3.12, FLOOR_Y, KENNEY_INNER.front - 0.34);
  return g;
}

export function buildTownEventsProps(scene, quality, townEvents) {
  const shadows = !!(quality && quality.shadows);
  const root = new THREE.Group();
  root.name = 'town-events-props';

  if (!scene.userData.interactables) scene.userData.interactables = [];

  // 1) Saturday Farmers' Market pop-up stalls in Maple Lane Park Plaza
  const marketGroup = new THREE.Group();
  marketGroup.name = 'park-farmers-market';

  const produceStall = makeMarketStall('market-stall-produce', 0x3f7d46, 0xd45b3b, shadows);
  produceStall.position.set(69.2, SURFACE_Y.walk, 16.5);
  produceStall.userData.kind = 'town-event';
  produceStall.userData.id = 'event-market-produce';
  produceStall.userData.interactLocal = new THREE.Vector3(0, 1.1, 0.55);
  produceStall.userData.getPrompt = (isMobile) => {
    const offer = townEvents.currentMarketOffers().produce;
    return `${isMobile ? 'Tap' : 'Press E'} to buy ${offer.name} ($${offer.price})`;
  };
  produceStall.userData.interact = () => townEvents.buyMarketOffer('produce');

  const treatStall = makeMarketStall('market-stall-treats', 0xb85239, 0xe0a246, shadows);
  treatStall.position.set(76.2, SURFACE_Y.walk, 16.5);
  treatStall.userData.kind = 'town-event';
  treatStall.userData.id = 'event-market-treats';
  treatStall.userData.interactLocal = new THREE.Vector3(0, 1.1, 0.55);
  treatStall.userData.getPrompt = (isMobile) => {
    const offer = townEvents.currentMarketOffers().treat;
    return `${isMobile ? 'Tap' : 'Press E'} to buy ${offer.name} ($${offer.price})`;
  };
  treatStall.userData.interact = () => townEvents.buyMarketOffer('treat');

  const sellStall = makeMarketStall('market-stall-sell', 0x3b6796, 0x6ba854, shadows);
  sellStall.position.set(80.6, SURFACE_Y.walk, 16.5);
  sellStall.userData.kind = 'town-event';
  sellStall.userData.id = 'event-market-sell';
  sellStall.userData.interactLocal = new THREE.Vector3(0, 1.1, 0.55);
  sellStall.userData.getPrompt = (isMobile) =>
    `${isMobile ? 'Tap' : 'Press E'} to sell produce/fish (+20% Market bonus)`;
  sellStall.userData.interact = () => townEvents.sellAtMarket().sold > 0;

  marketGroup.add(produceStall, treatStall, sellStall);
  root.add(marketGroup);

  // 2) Sunday Pond Fishing Derby Stand beside the pond footbridge
  const derbyStand = makeDerbyStand(shadows);
  derbyStand.position.set(71.8, SURFACE_Y.walk, 30.8);
  derbyStand.rotation.y = Math.PI * 0.25;
  derbyStand.userData.kind = 'town-event';
  derbyStand.userData.id = 'event-derby-stand';
  derbyStand.userData.interactLocal = new THREE.Vector3(0, 1.3, 0.25);
  derbyStand.userData.getPrompt = (isMobile) =>
    `${isMobile ? 'Tap' : 'Press E'} for Fishing Derby leaderboard & prize`;
  derbyStand.userData.interact = () => townEvents.interactDerbyStand();
  root.add(derbyStand);

  // 3) Golden Trout Trophy inside the player's house (visible once won!)
  const trophy = makeHouseTrophy(shadows);
  root.add(trophy);

  const register = (id, object, enabled) => {
    scene.userData.interactables = scene.userData.interactables.filter((e) => e.id !== id);
    scene.userData.interactables.push({ id, kind: 'town-event', object, range: 2.6, enabled });
  };
  register('event-market-produce', produceStall, () => townEvents.isMarketOpen());
  register('event-market-treats', treatStall, () => townEvents.isMarketOpen());
  register('event-market-sell', sellStall, () => townEvents.isMarketOpen());
  register('event-derby-stand', derbyStand, () => townEvents.isDerbyOpen());

  function sync() {
    marketGroup.visible = townEvents.isMarketOpen();
    derbyStand.visible = townEvents.isDerbyOpen();
    trophy.visible = townEvents.hasTrophy();
  }

  sync();
  townEvents.onChange(sync);
  scene.add(root);
  scene.userData.townEventsProps = { group: root, sync, marketGroup, derbyStand, trophy };
  return { group: root, sync, marketGroup, derbyStand, trophy };
}
