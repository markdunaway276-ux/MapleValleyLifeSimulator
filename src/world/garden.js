import * as THREE from 'three';

/**
 * 3D Backyard Kitchen Garden behind the player's house.
 *
 * Four cedar raised garden beds in the sunlit east-backyard (clear of the
 * house back wall at z = -16.74 and the shade tree at x = 0, z = -19.5).
 * Each bed shows dry vs. watered soil and live 3D growth stages for
 * Tomatoes, Fresh Herbs, and Autumn Pumpkins.
 */

export const GARDEN_BEDS = Object.freeze([
  { index: 0, x: 2.75, z: -18.55 },
  { index: 1, x: 5.05, z: -18.55 },
  { index: 2, x: 2.75, z: -20.55 },
  { index: 3, x: 5.05, z: -20.55 }
]);

const BED_W = 1.56;
const BED_D = 0.96;
const BED_H = 0.36;
const DRY_SOIL_COLOR = 0x6d5036;
const WET_SOIL_COLOR = 0x3b2819;

function makeSproutMesh(matLeaf) {
  const g = new THREE.Group();
  const stemGeo = new THREE.CylinderGeometry(0.012, 0.015, 0.09, 5);
  const leafGeo = new THREE.BoxGeometry(0.06, 0.018, 0.032);
  const offsets = [
    [-0.45, -0.2], [0, -0.2], [0.45, -0.2],
    [-0.45, 0.2], [0, 0.2], [0.45, 0.2]
  ];
  for (const [ox, oz] of offsets) {
    const stem = new THREE.Mesh(stemGeo, matLeaf);
    stem.position.set(ox, 0.045, oz);
    g.add(stem);
    for (const s of [-1, 1]) {
      const leaf = new THREE.Mesh(leafGeo, matLeaf);
      leaf.position.set(ox + s * 0.03, 0.09, oz);
      leaf.rotation.z = s * 0.35;
      g.add(leaf);
    }
  }
  return g;
}

function makeGrowingVinesMesh(matLeaf, matStem) {
  const g = new THREE.Group();
  const clumpGeo = new THREE.DodecahedronGeometry(0.14, 0);
  const stemGeo = new THREE.CylinderGeometry(0.018, 0.022, 0.22, 6);
  const spots = [[-0.42, -0.14], [0, 0.06], [0.42, -0.1]];
  for (const [ox, oz] of spots) {
    const stem = new THREE.Mesh(stemGeo, matStem);
    stem.position.set(ox, 0.11, oz);
    g.add(stem);
    const bush = new THREE.Mesh(clumpGeo, matLeaf);
    bush.position.set(ox, 0.2, oz);
    bush.scale.set(1.2, 0.85, 1.1);
    g.add(bush);
  }
  return g;
}

function makeMatureTomatoMesh(matLeaf, matWood, matTomato) {
  const g = new THREE.Group();
  const stakeGeo = new THREE.CylinderGeometry(0.016, 0.018, 0.78, 6);
  const bushGeo = new THREE.DodecahedronGeometry(0.19, 0);
  const fruitGeo = new THREE.SphereGeometry(0.046, 8, 6);
  const spots = [[-0.44, 0], [0, 0.04], [0.44, -0.04]];
  for (const [ox, oz] of spots) {
    const stake = new THREE.Mesh(stakeGeo, matWood);
    stake.position.set(ox, 0.39, oz);
    g.add(stake);

    const b1 = new THREE.Mesh(bushGeo, matLeaf);
    b1.position.set(ox, 0.26, oz);
    b1.scale.set(1.05, 1.15, 0.95);
    g.add(b1);

    const b2 = new THREE.Mesh(bushGeo, matLeaf);
    b2.position.set(ox + 0.03, 0.46, oz - 0.02);
    b2.scale.set(0.85, 0.95, 0.85);
    g.add(b2);

    const fruits = [
      [0.12, 0.32, 0.12],
      [-0.11, 0.42, 0.11],
      [0.08, 0.50, -0.10],
      [-0.08, 0.24, -0.12]
    ];
    for (const [fx, fy, fz] of fruits) {
      const fruit = new THREE.Mesh(fruitGeo, matTomato);
      fruit.position.set(ox + fx, fy, oz + fz);
      g.add(fruit);
    }
  }
  return g;
}

function makeMatureHerbsMesh(matLeaf, matBlossom) {
  const g = new THREE.Group();
  const tuftGeo = new THREE.DodecahedronGeometry(0.14, 0);
  const flowerGeo = new THREE.SphereGeometry(0.026, 6, 5);
  const spots = [
    [-0.48, -0.18], [-0.16, 0.16], [0.16, -0.16], [0.48, 0.16],
    [-0.48, 0.18], [0.48, -0.18]
  ];
  for (let i = 0; i < spots.length; i++) {
    const [ox, oz] = spots[i];
    const tuft = new THREE.Mesh(tuftGeo, matLeaf);
    tuft.position.set(ox, 0.13, oz);
    tuft.scale.set(1.15, 0.95 + (i % 2) * 0.2, 1.05);
    g.add(tuft);
    const fl = new THREE.Mesh(flowerGeo, matBlossom);
    fl.position.set(ox, 0.26, oz);
    g.add(fl);
  }
  return g;
}

function makeMaturePumpkinMesh(matLeaf, matPumpkin, matStem) {
  const g = new THREE.Group();
  const leafGeo = new THREE.DodecahedronGeometry(0.13, 0);
  const bodyGeo = new THREE.SphereGeometry(0.20, 10, 8);
  const stemGeo = new THREE.CylinderGeometry(0.022, 0.032, 0.10, 6);

  const leaves = [[-0.52, -0.22], [-0.15, 0.24], [0.22, -0.24], [0.54, 0.2]];
  for (const [lx, lz] of leaves) {
    const lf = new THREE.Mesh(leafGeo, matLeaf);
    lf.position.set(lx, 0.07, lz);
    lf.scale.set(1.3, 0.45, 1.2);
    g.add(lf);
  }

  const pumpkins = [[-0.32, 0.02, 1.0], [0.30, -0.04, 0.86]];
  for (const [px, pz, sc] of pumpkins) {
    const p = new THREE.Mesh(bodyGeo, matPumpkin);
    p.position.set(px, 0.16 * sc, pz);
    p.scale.set(1.18 * sc, 0.82 * sc, 1.12 * sc);
    g.add(p);
    const st = new THREE.Mesh(stemGeo, matStem);
    st.position.set(px, 0.32 * sc, pz);
    st.rotation.z = 0.22;
    g.add(st);
  }
  return g;
}

function buildWateringCan(shadows) {
  const g = new THREE.Group();
  g.name = 'garden-watering-can';
  const matMetal = new THREE.MeshStandardMaterial({ color: 0x5c8496, roughness: 0.42, metalness: 0.45 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.24, 10), matMetal);
  body.position.y = 0.12;
  body.castShadow = shadows;
  g.add(body);

  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.028, 0.22, 6), matMetal);
  spout.position.set(0.15, 0.15, 0);
  spout.rotation.z = -0.78;
  g.add(spout);

  const rose = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.022, 0.035, 8), matMetal);
  rose.position.set(0.24, 0.23, 0);
  rose.rotation.z = -0.78;
  g.add(rose);

  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.014, 6, 12, Math.PI * 1.1), matMetal);
  handle.position.set(-0.08, 0.15, 0);
  handle.rotation.z = Math.PI * 0.45;
  g.add(handle);

  return g;
}

export function buildBackyardGarden(scene, quality, gardening) {
  const shadows = !!(quality && quality.shadows);
  const root = new THREE.Group();
  root.name = 'backyard-garden';

  const matWood = new THREE.MeshStandardMaterial({ color: 0x8b623f, roughness: 0.88 });
  const matWoodDark = new THREE.MeshStandardMaterial({ color: 0x6b492c, roughness: 0.92 });
  const matStone = new THREE.MeshStandardMaterial({ color: 0xa79e8e, roughness: 0.95 });
  const matSprout = new THREE.MeshStandardMaterial({ color: 0x6dbb4e, roughness: 0.82 });
  const matLeaf = new THREE.MeshStandardMaterial({ color: 0x3f7f3a, roughness: 0.86 });
  const matStem = new THREE.MeshStandardMaterial({ color: 0x4b6e34, roughness: 0.88 });
  const matTomato = new THREE.MeshStandardMaterial({ color: 0xd63628, roughness: 0.45 });
  const matBlossom = new THREE.MeshStandardMaterial({ color: 0xc29be0, roughness: 0.72 });
  const matPumpkin = new THREE.MeshStandardMaterial({ color: 0xde7a22, roughness: 0.62 });

  // Stepping-stone walkway from the east side yard to the raised beds.
  const stoneGeo = new THREE.CylinderGeometry(0.32, 0.34, 0.04, 8);
  const stoneCoords = [
    [6.1, -16.4], [5.8, -17.3], [4.9, -17.6], [3.9, -19.55], [4.0, -17.6]
  ];
  for (const [sx, sz] of stoneCoords) {
    const st = new THREE.Mesh(stoneGeo, matStone);
    st.position.set(sx, 0.02, sz);
    st.receiveShadow = shadows;
    root.add(st);
  }

  // Watering can resting beside the garden beds.
  const can = buildWateringCan(shadows);
  can.position.set(6.25, 0, -18.25);
  can.rotation.y = -0.65;
  root.add(can);

  const bedViews = [];
  const colliders = scene?.userData?.colliders;
  if (!scene.userData.interactables) scene.userData.interactables = [];

  for (const spec of GARDEN_BEDS) {
    const bedGroup = new THREE.Group();
    bedGroup.name = `garden-bed-${spec.index}`;
    bedGroup.position.set(spec.x, 0, spec.z);

    // Cedar plank walls
    const wallT = 0.08;
    const frontBackGeo = new THREE.BoxGeometry(BED_W, BED_H, wallT);
    const sideGeo = new THREE.BoxGeometry(wallT, BED_H, BED_D - wallT * 2);
    const postGeo = new THREE.BoxGeometry(0.11, BED_H + 0.04, 0.11);

    for (const s of [-1, 1]) {
      const fb = new THREE.Mesh(frontBackGeo, matWood);
      fb.position.set(0, BED_H / 2, s * (BED_D / 2 - wallT / 2));
      fb.castShadow = shadows;
      fb.receiveShadow = shadows;
      bedGroup.add(fb);

      const sd = new THREE.Mesh(sideGeo, matWood);
      sd.position.set(s * (BED_W / 2 - wallT / 2), BED_H / 2, 0);
      sd.castShadow = shadows;
      sd.receiveShadow = shadows;
      bedGroup.add(sd);
    }
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const post = new THREE.Mesh(postGeo, matWoodDark);
        post.position.set(sx * (BED_W / 2 - 0.04), (BED_H + 0.04) / 2, sz * (BED_D / 2 - 0.04));
        post.castShadow = shadows;
        bedGroup.add(post);
      }
    }

    // Soil top
    const soilMat = new THREE.MeshStandardMaterial({ color: DRY_SOIL_COLOR, roughness: 0.96 });
    const soil = new THREE.Mesh(new THREE.BoxGeometry(BED_W - wallT * 1.8, 0.08, BED_D - wallT * 1.8), soilMat);
    soil.position.set(0, BED_H - 0.06, 0);
    soil.receiveShadow = shadows;
    bedGroup.add(soil);

    // Crop stage container resting on the soil surface
    const cropAnchor = new THREE.Group();
    cropAnchor.position.set(0, BED_H - 0.02, 0);
    bedGroup.add(cropAnchor);

    // Interaction metadata
    bedGroup.userData.kind = 'garden';
    bedGroup.userData.id = `garden-bed-${spec.index}`;
    bedGroup.userData.plotIndex = spec.index;
    bedGroup.userData.interactLocal = new THREE.Vector3(0, BED_H + 0.15, 0);
    bedGroup.userData.getPrompt = (isMobile) => gardening.promptForPlot(spec.index, isMobile);
    bedGroup.userData.interact = () => gardening.interactPlot(spec.index);

    root.add(bedGroup);

    // Register interactable & collider
    scene.userData.interactables = scene.userData.interactables.filter((e) => e.id !== bedGroup.userData.id);
    scene.userData.interactables.push({
      id: bedGroup.userData.id,
      kind: 'garden',
      object: bedGroup,
      range: 2.35
    });

    if (colliders && typeof colliders.addHouse === 'function') {
      colliders.addHouse({
        id: bedGroup.userData.id,
        x: spec.x,
        z: spec.z,
        width: BED_W,
        depth: BED_D,
        rotY: 0
      });
    }

    bedViews.push({
      index: spec.index,
      soilMat,
      cropAnchor,
      lastKey: ''
    });
  }

  function sync() {
    const plots = gardening.getPlots();
    for (let i = 0; i < bedViews.length; i++) {
      const view = bedViews[i];
      const plot = plots[i];
      if (!plot) continue;
      view.soilMat.color.setHex(plot.wateredToday ? WET_SOIL_COLOR : DRY_SOIL_COLOR);

      const stage = !plot.cropId
        ? 'empty'
        : plot.mature
          ? `mature-${plot.cropId}`
          : plot.growthDays > 0
            ? `growing-${plot.cropId}`
            : 'sprout';

      if (view.lastKey === stage) continue;
      view.lastKey = stage;
      view.cropAnchor.clear();

      if (stage === 'sprout') {
        view.cropAnchor.add(makeSproutMesh(matSprout));
      } else if (stage.startsWith('growing-')) {
        view.cropAnchor.add(makeGrowingVinesMesh(matLeaf, matStem));
      } else if (stage === 'mature-tomato') {
        view.cropAnchor.add(makeMatureTomatoMesh(matLeaf, matWoodDark, matTomato));
      } else if (stage === 'mature-herbs') {
        view.cropAnchor.add(makeMatureHerbsMesh(matLeaf, matBlossom));
      } else if (stage === 'mature-pumpkin') {
        view.cropAnchor.add(makeMaturePumpkinMesh(matLeaf, matPumpkin, matStem));
      }
    }
  }

  sync();
  gardening.onChange(sync);

  scene.add(root);
  scene.userData.backyardGarden = { group: root, sync };
  return { group: root, sync };
}
