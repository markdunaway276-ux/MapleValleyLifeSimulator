import * as THREE from 'three';
import { KENNEY_INNER, FLOOR_Y, CEILING_Y, HOUSE_SCALE_XZ, HOUSE_CENTER_Z } from './interior.js';

const sx = (x) => x * HOUSE_SCALE_XZ;
const sz = (z) => HOUSE_CENTER_Z + (z + 10) * HOUSE_SCALE_XZ;

/**
 * Interior visual & interactive upgrades for the player's main house:
 *  1. Crisp baseboards, crown moulding, doorway casings & curtained windows
 *  2. Cozy interactive living-room hearth fireplace with flickering embers
 *  3. Kitchen upper cabinets, stainless sink & faucet, hanging cookware rack & under-cabinet light
 *  4. Bedroom standing wardrobe mirror, nightstand lamp & alarm clock
 *  5. Bathroom backlit vanity mirror, chrome rain showerhead & folded towel rack
 */
export function buildHouseInteriorUpgrades(quality, lightPool = null) {
  const group = new THREE.Group();
  group.name = 'main-house-interior-upgrades';
  const K = KENNEY_INNER;
  const fy = FLOOR_Y;
  const cy = CEILING_Y;

  const trimMat = new THREE.MeshStandardMaterial({ color: 0xf4f0e8, roughness: 0.55 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x6f4e33, roughness: 0.72 });
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xc9a24b, metalness: 0.78, roughness: 0.28 });
  const steelMat = new THREE.MeshStandardMaterial({ color: 0xd4dde6, metalness: 0.85, roughness: 0.22 });
  const curtainMat = new THREE.MeshStandardMaterial({ color: 0x7e9682, roughness: 0.92, side: THREE.DoubleSide });
  const cabinetMat = new THREE.MeshStandardMaterial({ color: 0xe6dfd2, roughness: 0.5 });

  // -------------------------------------------------------------------------
  // 1. Baseboards, crown moulding, doorway casings & curtained windows
  // -------------------------------------------------------------------------
  const addTrimStrip = (w, d, x, z) => {
    const base = new THREE.Mesh(new THREE.BoxGeometry(w, 0.11, d), trimMat);
    base.position.set(x, fy + 0.055, z);
    const crown = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, d + 0.01), trimMat);
    crown.position.set(x, cy - 0.04, z);
    group.add(base, crown);
  };
  // West wall, back wall, east wall, and kitchen front wall.
  addTrimStrip(0.03, K.front - K.back, K.west + 0.015, (K.front + K.back) / 2);
  addTrimStrip(K.east - K.west, 0.03, (K.west + K.east) / 2, K.back + 0.015);
  addTrimStrip(0.03, K.notchWall - K.back, K.east - 0.015, (K.notchWall + K.back) / 2);
  addTrimStrip(K.frontRoomEast - K.west, 0.03, (K.west + K.frontRoomEast) / 2, K.front - 0.015);
  addTrimStrip(0.03, K.front - K.notchWall, K.frontRoomEast - 0.015, (K.front + K.notchWall) / 2);

  // Doorway casings around the bedroom opening (-2.35..-0.65 at K.notchWall) & bathroom opening (-1.85..-0.85 at -14.45).
  const addCasing = (x0, x1, z, topY) => {
    const h = topY - fy;
    for (const x of [x0, x1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.07, h, 0.19), trimMat);
      post.position.set(x, fy + h / 2, z);
      group.add(post);
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0 + 0.14, 0.08, 0.19), trimMat);
    lintel.position.set((x0 + x1) / 2, topY + 0.02, z);
    group.add(lintel);
  };
  addCasing(-2.35, -0.65, K.notchWall, cy - 0.12);
  addCasing(-1.85, -0.85, -14.45, 2.12 + fy);

  // Wooden window sills, brass curtain rods & soft draped curtains on all 4 windows.
  const addWindowDress = (facing, wallCoord, c0, c1) => {
    const span = Math.abs(c1 - c0);
    const mid = (c0 + c1) / 2;
    const winBot = 1.10;
    const winTop = 1.88;
    const rodY = winTop + 0.14;
    const isZ = facing[1] === 'z';
    const sign = facing[0] === '+' ? 1 : -1;

    const sill = new THREE.Mesh(
      new THREE.BoxGeometry(isZ ? span + 0.18 : 0.12, 0.04, isZ ? 0.12 : span + 0.18),
      woodMat
    );
    sill.position.set(isZ ? mid : wallCoord + sign * 0.05, winBot - 0.02, isZ ? wallCoord + sign * 0.05 : mid);
    group.add(sill);

    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, span + 0.42, 10), brassMat);
    if (isZ) rod.rotation.z = Math.PI / 2;
    else rod.rotation.x = Math.PI / 2;
    rod.position.set(isZ ? mid : wallCoord + sign * 0.06, rodY, isZ ? wallCoord + sign * 0.06 : mid);
    group.add(rod);

    const panelH = rodY - (winBot - 0.28);
    const panelW = 0.28;
    for (const side of [-1, 1]) {
      const p = new THREE.Mesh(
        new THREE.BoxGeometry(isZ ? panelW : 0.045, panelH, isZ ? 0.045 : panelW),
        curtainMat
      );
      const offset = side * (span / 2 + 0.04);
      p.position.set(
        isZ ? mid + offset : wallCoord + sign * 0.065,
        rodY - panelH / 2 - 0.01,
        isZ ? wallCoord + sign * 0.065 : mid + offset
      );
      group.add(p);
    }
  };
  addWindowDress('-z', K.front, sx(-3.6741), sx(-2.1859));  // living room front-left
  addWindowDress('+x', K.west, sz(-11.0737), sz(-9.5922));  // bedroom west
  addWindowDress('+z', K.back, sx(-3.6741), sx(-2.1859));   // bedroom back
  addWindowDress('+z', K.back, sx(2.25), sx(3.7333));       // kitchen back

  // -------------------------------------------------------------------------
  // 2. Cozy Interactive Living Room Fireplace (against P1 partition, facing +z)
  // -------------------------------------------------------------------------
  const fpX = -3.82;
  const fpZ = K.notchWall + 0.24;
  const fireplace = new THREE.Group();
  fireplace.name = 'house-fireplace';
  fireplace.position.set(fpX, fy, fpZ);

  const brickMat = new THREE.MeshStandardMaterial({ color: 0x8d4a3a, roughness: 0.88 });
  const hearthMat = new THREE.MeshStandardMaterial({ color: 0x6b645c, roughness: 0.82 });
  const fireboxMat = new THREE.MeshStandardMaterial({ color: 0x1b1715, roughness: 0.95 });

  const hearth = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.10, 0.56), hearthMat);
  hearth.position.set(0, 0.05, 0.08);
  const surround = new THREE.Mesh(new THREE.BoxGeometry(1.32, 1.12, 0.36), brickMat);
  surround.position.set(0, 0.62, -0.02);
  const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.92, cy - fy - 1.2, 0.28), brickMat);
  chimney.position.set(0, 1.18 + (cy - fy - 1.2) / 2, -0.04);
  const mantel = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.09, 0.44), woodMat);
  mantel.position.set(0, 1.22, 0.02);
  const cavity = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.66, 0.20), fireboxMat);
  cavity.position.set(0, 0.44, 0.09);

  // Firewood logs inside the firebox.
  const logMat = new THREE.MeshStandardMaterial({ color: 0x4b3222, roughness: 0.92 });
  const logGeo = new THREE.CylinderGeometry(0.055, 0.06, 0.48, 8);
  logGeo.rotateZ(Math.PI / 2);
  const log1 = new THREE.Mesh(logGeo, logMat);
  log1.position.set(0, 0.18, 0.12);
  log1.rotation.y = 0.14;
  const log2 = new THREE.Mesh(logGeo, logMat);
  log2.position.set(0.02, 0.24, 0.11);
  log2.rotation.y = -0.22;

  // Flickering flames + glowing ember bed.
  const emberMat = new THREE.MeshStandardMaterial({ color: 0x3b180c, emissive: 0xff5a1f, emissiveIntensity: 1.4, roughness: 0.9 });
  const emberBed = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.05, 0.16), emberMat);
  emberBed.position.set(0, 0.13, 0.12);
  const flames = [];
  const flameColors = [0xff6b1a, 0xffaa2b, 0xffe066];
  for (let i = 0; i < 3; i++) {
    const fMat = new THREE.MeshBasicMaterial({ color: flameColors[i], transparent: true, opacity: 0.88 });
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.075 - i * 0.012, 0.26 - i * 0.03, 8), fMat);
    cone.position.set((i - 1) * 0.11, 0.30, 0.12);
    fireplace.add(cone);
    flames.push({ mesh: cone, mat: fMat, phase: i * 1.9, baseH: 0.26 - i * 0.03 });
  }

  // Mantel decor: brass clock + warm pillar candle.
  const mClock = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.09), brassMat);
  mClock.position.set(0, 1.35, 0.04);
  const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.038, 0.16, 10), new THREE.MeshStandardMaterial({ color: 0xf7eed8, roughness: 0.7 }));
  candle.position.set(0.46, 1.34, 0.04);

  let fireLight;
  if (lightPool) {
    fireLight = lightPool.addPoint({ x: fpX, y: fy + 0.55, z: fpZ + 0.55, color: 0xff9340, intensity: 10, distance: 6.5, decay: 2 });
  } else {
    fireLight = new THREE.PointLight(0xff9340, 10, 6.5, 2);
    fireLight.position.set(0, 0.55, 0.55);
    fireplace.add(fireLight);
  }

  fireplace.add(hearth, surround, chimney, mantel, cavity, log1, log2, emberBed, mClock, candle);
  group.add(fireplace);

  let fireLit = true;
  let warmedToday = false;
  const fireplaceObject = new THREE.Group();
  fireplaceObject.name = 'house-fireplace-interact';
  fireplaceObject.position.set(fpX, fy + 0.75, fpZ + 0.32);
  fireplaceObject.userData.getPrompt = (mobile) => (mobile ? 'Tap to ' : 'Press E to ') + (fireLit ? 'extinguish fireplace' : 'light fireplace');
  fireplaceObject.userData.interact = (ctx) => {
    fireLit = !fireLit;
    if (fireLit && !warmedToday) {
      warmedToday = true;
      ctx?.needs?.add?.('energy', 8);
      ctx?.needs?.add?.('mood', 10);
      ctx?.toast?.('Lit the hearth fireplace — cozy and warm! (+8 Energy)');
    } else {
      ctx?.toast?.(fireLit ? 'Lit the fireplace.' : 'Put out the fireplace.');
    }
    return 'press';
  };
  group.add(fireplaceObject);

  // -------------------------------------------------------------------------
  // 3. Kitchen Upgrade: Upper Cabinets, Stainless Sink & Faucet, Hanging Pot Rack, Under-Cabinet Glow
  // -------------------------------------------------------------------------
  const kitchenGroup = new THREE.Group();
  kitchenGroup.name = 'house-kitchen-upgrades';
  // Upper cabinets flanking the back kitchen window (window spans sx(2.25)..sx(3.73) ≈ 2.79..4.63).
  for (const [cx, cw] of [[2.35, 0.68], [4.98, 0.68]]) {
    const cab = new THREE.Mesh(new THREE.BoxGeometry(cw, 0.72, 0.34), cabinetMat);
    cab.position.set(cx, 2.08, -16.54);
    const doorLine = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.66, 0.015), woodMat);
    doorLine.position.set(cx, 2.08, -16.365);
    const handleL = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.14, 0.025), steelMat);
    handleL.position.set(cx - 0.05, 1.92, -16.355);
    const handleR = handleL.clone();
    handleR.position.x = cx + 0.05;
    kitchenGroup.add(cab, doorLine, handleL, handleR);
  }
  // Under-cabinet warm LED glow strip over the counter.
  const underGlow = new THREE.Mesh(
    new THREE.BoxGeometry(3.0, 0.022, 0.05),
    new THREE.MeshBasicMaterial({ color: 0xfff0cc })
  );
  underGlow.position.set(3.68, 1.70, -16.56);
  kitchenGroup.add(underGlow);

  // Stainless steel kitchen sink basin & gooseneck chrome faucet at x = 2.65.
  const sinkRim = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.024, 0.44), steelMat);
  sinkRim.position.set(2.65, 0.94 + fy, -16.38);
  const sinkBasin = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.028, 0.36), new THREE.MeshStandardMaterial({ color: 0x7b8691, metalness: 0.78, roughness: 0.32 }));
  sinkBasin.position.set(2.65, 0.945 + fy, -16.38);
  const faucetBase = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.24, 12), steelMat);
  faucetBase.position.set(2.65, 1.07 + fy, -16.58);
  const faucetArc = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.013, 10, 16, Math.PI), steelMat);
  faucetArc.position.set(2.65, 1.19 + fy, -16.51);
  faucetArc.rotation.y = Math.PI / 2;
  kitchenGroup.add(sinkRim, sinkBasin, faucetBase, faucetArc);

  // Hanging copper/steel cookware rack above the stove.
  const rackBar = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.95, 10), steelMat);
  rackBar.rotation.z = Math.PI / 2;
  rackBar.position.set(3.75, 2.52, -16.22);
  kitchenGroup.add(rackBar);
  const copperMat = new THREE.MeshStandardMaterial({ color: 0xc27146, metalness: 0.82, roughness: 0.28 });
  for (let i = 0; i < 3; i++) {
    const px = 3.42 + i * 0.33;
    const pan = new THREE.Mesh(new THREE.CylinderGeometry(0.11 - i * 0.012, 0.10 - i * 0.012, 0.045, 16), i === 1 ? steelMat : copperMat);
    pan.rotation.x = Math.PI / 2;
    pan.position.set(px, 2.26, -16.22);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.16, 6), steelMat);
    stem.position.set(px, 2.42, -16.22);
    kitchenGroup.add(pan, stem);
  }
  group.add(kitchenGroup);

  // -------------------------------------------------------------------------
  // 4. Bedroom Standing Wardrobe Mirror, Nightstand Lamp & Alarm Clock
  // -------------------------------------------------------------------------
  const mirrorGroup = new THREE.Group();
  mirrorGroup.name = 'house-bedroom-mirror';
  mirrorGroup.position.set(-0.86, fy, -12.15);
  const mFrame = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.66, 0.62), woodMat);
  mFrame.position.y = 0.86;
  const mGlass = new THREE.Mesh(
    new THREE.PlaneGeometry(0.52, 1.54),
    new THREE.MeshStandardMaterial({ color: 0xdbe7f0, metalness: 0.92, roughness: 0.06 })
  );
  mGlass.rotation.y = -Math.PI / 2;
  mGlass.position.set(-0.028, 0.86, 0);
  mirrorGroup.add(mFrame, mGlass);
  group.add(mirrorGroup);

  const mirrorObject = new THREE.Group();
  mirrorObject.name = 'house-bedroom-mirror-interact';
  mirrorObject.position.set(-1.05, fy + 1.15, -12.15);
  mirrorObject.userData.getPrompt = (mobile) => (mobile ? 'Tap to ' : 'Press E to ') + 'check outfit in mirror';
  mirrorObject.userData.interact = (ctx) => {
    ctx?.toast?.('Looking sharp! Open Phone → Style anytime to try new outfits & hair.');
    return 'press';
  };
  group.add(mirrorObject);

  // Bedside lamp & green digital alarm clock on the nightstand (-3.05, -16.45).
  const bedside = new THREE.Group();
  bedside.position.set(-3.05, fy + 0.56, -16.45);
  const bBase = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 0.08, 12), brassMat);
  bBase.position.set(-0.08, 0.04, 0);
  const bShade = new THREE.Mesh(
    new THREE.ConeGeometry(0.11, 0.14, 16, 1, true),
    new THREE.MeshStandardMaterial({ color: 0xfaeed6, emissive: 0xffd088, emissiveIntensity: 0.65, side: THREE.DoubleSide, roughness: 0.65 })
  );
  bShade.position.set(-0.08, 0.18, 0);
  const alarm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.065, 0.055), new THREE.MeshStandardMaterial({ color: 0x1e242b, roughness: 0.4 }));
  alarm.position.set(0.11, 0.032, 0.06);
  const alarmFace = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.035), new THREE.MeshBasicMaterial({ color: 0x4ade80 }));
  alarmFace.position.set(0.11, 0.035, 0.089);
  bedside.add(bBase, bShade, alarm, alarmFace);
  group.add(bedside);

  // -------------------------------------------------------------------------
  // 5. Bathroom Backlit Vanity Mirror, Chrome Rain Showerhead & Folded Towel Rack
  // -------------------------------------------------------------------------
  const bathWestIn = -2.35 + 0.075;
  const vanityBack = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.72, 0.56), new THREE.MeshBasicMaterial({ color: 0xe6f4ff }));
  vanityBack.position.set(bathWestIn + 0.015, 1.48, -15.25);
  const vanityGlass = new THREE.Mesh(
    new THREE.PlaneGeometry(0.48, 0.64),
    new THREE.MeshStandardMaterial({ color: 0xdce8f0, metalness: 0.92, roughness: 0.06 })
  );
  vanityGlass.rotation.y = Math.PI / 2;
  vanityGlass.position.set(bathWestIn + 0.032, 1.48, -15.25);
  // Chrome rain showerhead & arm.
  const showerArm = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.28, 10), steelMat);
  showerArm.rotation.x = Math.PI / 2;
  showerArm.position.set(-1.15, 2.08 + fy, -16.52);
  const showerHead = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.095, 0.025, 16), steelMat);
  showerHead.position.set(-1.15, 2.05 + fy, -16.38);
  // Folded towel rack on the bathroom west wall.
  const towelBar = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.44, 10), steelMat);
  towelBar.rotation.x = Math.PI / 2;
  towelBar.position.set(bathWestIn + 0.055, 1.12, -14.78);
  const towel = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.36, 0.34), new THREE.MeshStandardMaterial({ color: 0x5c949e, roughness: 0.92 }));
  towel.position.set(bathWestIn + 0.055, 0.96, -14.78);
  group.add(vanityBack, vanityGlass, showerArm, showerHead, towelBar, towel);

  let t = 0;
  function update(delta) {
    t += delta;
    emberMat.emissiveIntensity = fireLit ? 1.15 + Math.sin(t * 7.2) * 0.25 : 0;
    for (const f of flames) {
      f.mesh.visible = fireLit;
      if (fireLit) {
        const flick = 0.85 + Math.sin(t * 11 + f.phase) * 0.18 + Math.cos(t * 17 + f.phase) * 0.08;
        f.mesh.scale.set(1, flick, 1);
        f.mesh.position.y = 0.18 + (f.baseH * flick) / 2;
      }
    }
    if (fireLight) {
      fireLight.intensity = fireLit ? 9.5 + Math.sin(t * 9.5) * 1.4 : 0;
    }
  }

  return {
    group,
    update,
    interactables: [
      { id: 'house-fireplace', object: fireplaceObject, range: 2.0 },
      { id: 'house-bedroom-mirror', object: mirrorObject, range: 1.8 }
    ]
  };
}
