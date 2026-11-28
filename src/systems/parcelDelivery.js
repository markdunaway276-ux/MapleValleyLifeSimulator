/**
 * Post Office Parcel Delivery Shift & anytime pickup truck-bed utility.
 *
 * 1. Anytime after Day 1 unloading, players can open/close the pickup's hinged
 *    bed cover & tailgate from behind the truck.
 * 2. Talking to Hank at Maple Lane Post Office starts a 3-parcel delivery route:
 *    3 stamped parcels appear in your pickup bed, you grab them out of the bed
 *    using the cover/tailgate/drag animations, and deliver them to Vince,
 *    Dottie, and Walt for cash + tips + a route completion bonus.
 */

import * as THREE from 'three';

export const DELIVERY_STOPS = [
  { id: 'vince', name: 'Vince (Maple Lane Market)', pay: 10, tip: 3, fallbackPos: { x: 16.5, z: 16.2 } },
  { id: 'dottie', name: 'Dottie (Laundromat)', pay: 10, tip: 4, fallbackPos: { x: 32.0, z: -4.2 } },
  { id: 'walt', name: 'Walt (Trailer Park)', pay: 10, tip: 5, fallbackPos: { x: -30.5, z: -4.3 } }
];
export const ROUTE_BONUS = 15;

function makeParcelMesh(seed = 0) {
  const g = new THREE.Group();
  const card = new THREE.MeshStandardMaterial({ color: [0xb98d5b, 0xaa8050, 0xc49c6b][seed % 3], roughness: 0.9 });
  const tape = new THREE.MeshStandardMaterial({ color: 0x2b5f9e, roughness: 0.55 });
  const label = new THREE.MeshStandardMaterial({ color: 0xf4f0e4, roughness: 0.85 });
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.32, 0.38), card);
  box.position.y = 0.16;
  box.castShadow = box.receiveShadow = true;
  const strap = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.33, 0.39), tape);
  strap.position.y = 0.165;
  const sticker = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.005, 0.11), label);
  sticker.position.set(0.10, 0.325, 0.06);
  g.add(box, strap, sticker);
  return g;
}

export function createParcelDelivery({
  scene = null,
  player = null,
  car = null,
  npcs = null,
  actions = null,
  money = null,
  sfx = null,
  toast = null,
  minimap = null,
  mode = null,
  isMobile = false,
  isDayOneUnloadActive = () => false,
  save = null,
  saved = null
} = {}) {
  let active = !!saved?.active;
  let stopIndex = Math.max(0, Math.min(DELIVERY_STOPS.length, saved?.stopIndex | 0));
  let holdingParcel = false;
  let completedRoutes = Math.max(0, saved?.completedRoutes | 0);
  if (!active) stopIndex = 0;

  let bedOpen = false;
  let bedAnim = null;
  let tailgateAnim = null;
  let dragAnim = null;
  let pendingHide = null;

  const carObj = () => car?.object ?? scene?.userData?.prop ?? scene?.getObjectByName?.('parked-car');
  const parcelGroup = new THREE.Group();
  parcelGroup.name = 'pickup-delivery-parcels';
  const SLOTS = [[-1.44, 0.93, -0.26, 0.08], [-1.46, 0.93, 0.27, -0.06], [-1.98, 0.94, 0, 0.04]];
  const parcelMeshes = SLOTS.map(([x, y, z, r], i) => {
    const m = makeParcelMesh(i);
    m.position.set(x, y, z);
    m.rotation.y = r;
    m.visible = false;
    parcelGroup.add(m);
    return m;
  });

  function ensureCargoAttached() {
    const cargo = carObj()?.userData?.pickupCargo;
    if (cargo && parcelGroup.parent !== cargo) cargo.add(parcelGroup);
  }

  function syncParcels() {
    ensureCargoAttached();
    const remainingInTruck = active ? Math.max(0, DELIVERY_STOPS.length - stopIndex - (holdingParcel ? 1 : 0)) : 0;
    for (let i = 0; i < parcelMeshes.length; i++) {
      const [x, y, z] = SLOTS[i];
      if (!dragAnim || dragAnim.box !== parcelMeshes[i]) {
        parcelMeshes[i].position.set(x, y, z);
      }
      parcelMeshes[i].visible = i < remainingInTruck;
    }
  }

  function animateBed(open) {
    const obj = carObj();
    const curBed = obj?.userData?.bedCover ? -obj.userData.bedCover.rotation.z / 0.92 : (bedOpen ? 1 : 0);
    const curGate = obj?.userData?.tailgate ? obj.userData.tailgate.rotation.z / (Math.PI * 0.5) : (bedOpen ? 1 : 0);
    bedOpen = !!open;
    const now = performance.now();
    if (bedOpen) {
      bedAnim = { from: curBed, to: 1, start: now + 150, duration: 420 };
      tailgateAnim = { from: curGate, to: 1, start: now + 680, duration: 480 };
    } else {
      tailgateAnim = { from: curGate, to: 0, start: now, duration: 440 };
      bedAnim = { from: curBed, to: 0, start: now + 260, duration: 440 };
    }
  }

  function currentStop() {
    return active && stopIndex < DELIVERY_STOPS.length ? DELIVERY_STOPS[stopIndex] : null;
  }

  function stopPosition(stop) {
    if (!stop) return null;
    const npc = npcs?.get?.(stop.id);
    return npc?.position || stop.fallbackPos;
  }

  function updateWaypoint() {
    if (!minimap) return;
    const stop = currentStop();
    if (!stop) {
      if (minimap.getWaypointId?.() === 'parcel-delivery') minimap.setWaypoint?.(null);
      return;
    }
    minimap.setWaypoint?.({
      id: 'parcel-delivery',
      name: `Deliver to ${stop.name}`,
      position: () => stopPosition(stop)
    });
  }

  function startShift() {
    if (active) return false;
    active = true;
    stopIndex = 0;
    holdingParcel = false;
    syncParcels();
    updateWaypoint();
    sfx?.play?.('pickup');
    toast?.('3 parcels loaded in your pickup bed! Open the tailgate and deliver them.');
    save?.();
    return true;
  }

  function deliverCurrent() {
    const stop = currentStop();
    if (!stop || !holdingParcel) return false;
    holdingParcel = false;
    actions?.setCarry?.(null);
    actions?.play?.('handOver');
    const payout = stop.pay + stop.tip;
    money?.add?.(payout, { label: `Parcel delivery (${stop.id})` });
    sfx?.play?.('cash');
    stopIndex += 1;

    if (stopIndex >= DELIVERY_STOPS.length) {
      active = false;
      stopIndex = 0;
      completedRoutes += 1;
      money?.add?.(ROUTE_BONUS, { label: 'Post Office route bonus' });
      toast?.(`All parcels delivered! +$${payout} + $${ROUTE_BONUS} route bonus!`);
      if (bedOpen) animateBed(false);
    } else {
      toast?.(`Delivered to ${stop.name}! +$${payout} ($${stop.tip} tip). Next: ${DELIVERY_STOPS[stopIndex].name}`);
    }
    syncParcels();
    updateWaypoint();
    save?.();
    return true;
  }

  // Rear pickup utility interactable (works anytime Day 1 move-in boxes aren't active).
  const _local = new THREE.Vector3();
  function rearEdge() {
    return (carObj()?.userData?.size?.width || 4.8) / 2;
  }
  function behindCar() {
    const obj = carObj();
    if (!obj || !player?.position) return false;
    obj.worldToLocal(_local.set(player.position.x, 0, player.position.z));
    return _local.x < -rearEdge() + 0.28 && Math.abs(_local.z) < 1.35;
  }
  function bedPoint() {
    const obj = carObj();
    if (!obj || !player?.position) return { x: 0, y: 1.4, z: 0 };
    obj.worldToLocal(_local.set(player.position.x, 0, player.position.z));
    _local.set(-rearEdge() - 0.08, 0, THREE.MathUtils.clamp(_local.z, -0.85, 0.85) * 0.85);
    obj.localToWorld(_local);
    return { x: _local.x, y: 1.4, z: _local.z };
  }

  const prompt = (verb) => (isMobile ? 'Tap to ' : 'Press E to ') + verb;
  const bedSpot = new THREE.Object3D();
  bedSpot.name = 'pickup-bed-utility';
  if (scene) scene.add(bedSpot);
  bedSpot.getPoint = bedPoint;
  bedSpot.userData.getPrompt = () => {
    const left = active ? Math.max(0, DELIVERY_STOPS.length - stopIndex - (holdingParcel ? 1 : 0)) : 0;
    if (active && !holdingParcel && left > 0) {
      return prompt(bedOpen ? `grab parcel for ${currentStop()?.name}` : `open tailgate & grab parcel (${left} left)`);
    }
    return prompt(bedOpen ? 'close truck bed & tailgate' : 'open truck bed & tailgate');
  };
  bedSpot.userData.interact = (ctx) => {
    if (active && !holdingParcel) {
      if (actions?.carrying) { ctx?.toast?.('Your hands are full.'); return false; }
      const left = DELIVERY_STOPS.length - stopIndex;
      if (left <= 0) return false;
      const boxMesh = parcelMeshes[left - 1];
      const needsOpen = !bedOpen;
      const now = performance.now();
      if (needsOpen) {
        sfx?.play?.('click');
        animateBed(true);
        if (typeof window !== 'undefined') window.setTimeout(() => sfx?.play?.('click'), 660);
      }
      if (boxMesh) {
        dragAnim = {
          box: boxMesh,
          fromX: boxMesh.position.x,
          fromZ: boxMesh.position.z,
          toX: -2.62,
          toZ: 0,
          start: now + (needsOpen ? 1420 : 360),
          duration: 440
        };
        pendingHide = { box: boxMesh, at: now + (needsOpen ? 1950 : 860) };
      }
      holdingParcel = true;
      actions?.setCarry?.('box');
      toast?.(`Grabbed parcel for ${currentStop()?.name}.`);
      return needsOpen ? 'openTruckBed' : 'reachTruckBox';
    }
    sfx?.play?.('click');
    animateBed(!bedOpen);
    return 'press';
  };

  if (scene) {
    const interactables = (scene.userData.interactables ??= []);
    interactables.push({
      id: 'pickup-bed-utility',
      kind: 'trunk',
      object: bedSpot,
      range: 2.4,
      getPoint: bedPoint,
      enabled: () => !isDayOneUnloadActive() && !mode?.driving?.() && behindCar()
    });
  }

  function pageFor(npcId) {
    if (npcId === 'hank') {
      if (active) {
        const stop = currentStop();
        return {
          lines: [
            `You've still got ${DELIVERY_STOPS.length - stopIndex} parcel${DELIVERY_STOPS.length - stopIndex === 1 ? '' : 's'} left on your route.`,
            `Next stop is ${stop?.name}. Grab the parcel from your pickup bed and hand it right over!`
          ]
        };
      }
      return {
        lines: [
          'Got three priority parcels headed out across Maple Lane — Market, Laundromat, and the Trailer Park.',
          'Want to load them into your pickup bed and run the route for $30 plus tips and a $15 bonus?'
        ],
        action: { label: 'Start Parcel Delivery Shift', run: startShift },
        response: [
          "Loaded all three into your pickup bed! Pop the tailgate when you're ready and watch the minimap for each drop."
        ]
      };
    }
    const stop = currentStop();
    if (stop && stop.id === npcId && holdingParcel) {
      return {
        lines: [`Oh, is that my Maple Lane Post Office parcel? Right on time!`],
        action: { label: `Hand over parcel (+$${stop.pay + stop.tip})`, run: deliverCurrent },
        response: ["Appreciate you hauling it over — here's a little extra for the trouble!"]
      };
    }
    return null;
  }

  function task() {
    const stop = currentStop();
    if (!stop) return null;
    return {
      id: 'parcel-delivery',
      title: `Deliver parcel to ${stop.name}`,
      step: holdingParcel
        ? `Hand the parcel to ${stop.name} (${stopIndex + 1}/${DELIVERY_STOPS.length}).`
        : `Grab the parcel from your pickup bed for ${stop.name} (${stopIndex + 1}/${DELIVERY_STOPS.length}).`,
      npcId: stop.id,
      complete: false
    };
  }

  function update() {
    const obj = carObj();
    obj?.userData?.updateDoorAnim?.();
    const now = performance.now();
    if (bedAnim) {
      const raw = (now - bedAnim.start) / bedAnim.duration;
      if (raw >= 0) {
        const t = Math.min(1, raw);
        const ease = t * t * (3 - 2 * t);
        obj?.userData?.setBedOpen?.(THREE.MathUtils.lerp(bedAnim.from, bedAnim.to, ease));
        if (t >= 1) bedAnim = null;
      }
    }
    if (tailgateAnim) {
      const raw = (now - tailgateAnim.start) / tailgateAnim.duration;
      if (raw >= 0) {
        const t = Math.min(1, raw);
        const ease = t * t * (3 - 2 * t);
        obj?.userData?.setTailgateOpen?.(THREE.MathUtils.lerp(tailgateAnim.from, tailgateAnim.to, ease));
        if (t >= 1) tailgateAnim = null;
      }
    }
    if (dragAnim) {
      const raw = (now - dragAnim.start) / dragAnim.duration;
      if (raw >= 0) {
        const t = Math.min(1, raw);
        const ease = t * t * (3 - 2 * t);
        dragAnim.box.position.x = THREE.MathUtils.lerp(dragAnim.fromX, dragAnim.toX, ease);
        dragAnim.box.position.z = THREE.MathUtils.lerp(dragAnim.fromZ, dragAnim.toZ, ease);
        if (t >= 1) dragAnim = null;
      }
    }
    if (pendingHide && now >= pendingHide.at) {
      pendingHide.box.visible = false;
      sfx?.play?.('pickup');
      pendingHide = null;
    }
    if (bedOpen && mode?.driving?.() && !bedAnim && !tailgateAnim) {
      animateBed(false);
    }
  }

  syncParcels();

  return {
    startShift,
    deliverCurrent,
    pageFor,
    task,
    update,
    get active() { return active; },
    get holdingParcel() { return holdingParcel; },
    get stopIndex() { return stopIndex; },
    get completedRoutes() { return completedRoutes; },
    serialize: () => ({ active, stopIndex, completedRoutes })
  };
}
