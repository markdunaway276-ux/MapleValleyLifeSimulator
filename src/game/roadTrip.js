import * as THREE from 'three';
import { CAR_SPAWN, poseCarWheels } from '../world/props.js';
import { FUEL } from '../systems/fuel.js';
import { STREET } from '../world/street.js';
import { setOpeningDeerBeat } from '../world/scenery.js';
import { warmOpening } from './loadingGate.js';

const LENGTH = 52;
const ARRIVAL = 49;
const SKIP_HOLD_MS = 950;
const SEEN_KEY = 'mapleValleyLife_roadTripSeen';
const ROUTE = [[0,-279],[7,-244],[17,-185],[24,-145],[32,-65],[44,-8],[49,6.8],[52,6.8]];
const INSIDE = at => (at >= 7 && at < 17) || (at >= 24 && at < 32) || at >= 44;
const smooth = THREE.MathUtils.smoothstep;

function distanceAt(t) {
  const i = Math.max(1, ROUTE.findIndex(point => point[0] >= t));
  const [a,x] = ROUTE[i-1];
  const [b,y] = ROUTE[i];
  const k = (t-a)/(b-a);
  return THREE.MathUtils.lerp(x,y,i===6 ? 1-(1-k)**2 : k);
}

const STORY_BEATS = [
  { from: 2.0, to: 6.8, text: 'Last $50 in the glovebox.' },
  { from: 17.5, to: 23.4, text: 'A cheap lease on Maple Lane — no questions asked.' },
  { from: 33.2, to: 38.8, text: 'Bills come due at the end of the week.' },
  { from: 40.5, to: 46.2, text: 'Time to start over.' }
];

export function createRoadTrip(g, onFinish, wave) {
  const {camera,scene,renderer} = g;
  const car = g.car.object;
  const welcome = scene.getObjectByName('maple-lane-welcome-sign');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const eye = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const target = new THREE.Vector3();
  const forward = new THREE.Vector3();
  let phase = 'idle';
  let time = 0;
  let fastForward = false;
  let music;
  let shutDown = false;
  let seen = false;
  try { seen = localStorage.getItem(SEEN_KEY) === '1'; } catch { /* Storage is optional. */ }
  let hold = null;

  const overlay = document.createElement('section');
  overlay.className = 'road-trip';
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="road-trip-bar top"></div><div class="road-trip-bar bottom"></div>
    <div class="road-trip-title road-trip-credit">A Maple Lane story</div>
    <div class="road-trip-title road-trip-name"><strong>MAPLE LANE</strong><span>a small-town life</span></div>
    <div class="road-trip-caption">Route 9 · 8:12 AM</div>
    <div class="road-trip-notice">Rita · Keys are ready! See you at 8:30.</div>
    <div class="road-trip-story" aria-live="polite"></div>
    <div class="road-trip-loading"><div>Getting Maple Lane ready…</div><progress aria-label="Loading Maple Lane" max="1" value="0"></progress></div>
    <button type="button" class="road-trip-ff">2× Hold</button>
    <button type="button" class="road-trip-skip" hidden>Hold to skip</button>`;
  document.body.append(overlay);
  const button = overlay.querySelector('.road-trip-skip');
  const ffButton = overlay.querySelector('.road-trip-ff');
  const progress = overlay.querySelector('progress');
  const credit = overlay.querySelector('.road-trip-credit');
  const title = overlay.querySelector('.road-trip-name');
  const caption = overlay.querySelector('.road-trip-caption');
  const notice = overlay.querySelector('.road-trip-notice');
  const story = overlay.querySelector('.road-trip-story');

  function setFast(on) {
    fastForward = !!on;
    ffButton.classList.toggle('is-fast', fastForward);
  }
  for (const ev of ['pointerdown', 'touchstart']) ffButton.addEventListener(ev, () => setFast(true));
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel', 'touchend', 'touchcancel']) ffButton.addEventListener(ev, () => setFast(false));
  if (!g.isMobile) button.textContent = 'Hold to skip [X]';

  function beginHold(input) {
    if (!button.hidden && !hold) hold = { input, from: performance.now() };
  }

  function clearHold() {
    hold = null;
    button.style.removeProperty('--held');
  }

  button.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    beginHold(event.pointerId);
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    button.addEventListener(type, event => {
      if (hold?.input === event.pointerId) clearHold();
    });
  }
  window.addEventListener('blur', clearHold);
  function skipKey(event) {
    return event.code === 'KeyX' || event.code === 'Escape' ||
      (event.target === button && ['Space', 'Enter'].includes(event.code));
  }
  window.addEventListener('keydown', event => {
    if (phase === 'playing' && event.code === 'Space' && event.target !== button) setFast(true);
    if (phase !== 'playing' || button.hidden || !skipKey(event)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!event.repeat) beginHold(event.code);
  });
  window.addEventListener('keyup', event => {
    if (hold?.input === event.code) clearHold();
  });
  window.addEventListener('keyup', event => {
    if (event.code === 'Space') setFast(false);
  });

  function park() {
    car.position.set(CAR_SPAWN.x,0,CAR_SPAWN.z);
    car.rotation.y=CAR_SPAWN.rotY;
    poseCarWheels(car, 0, 0);
    car.updateMatrixWorld(true);
  }

  function finish() {
    if (phase==='idle' || phase==='finished') return;
    phase='finished';
    clearHold();
    try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* Storage is optional. */ }
    overlay.classList.remove('playing','loading');
    overlay.classList.add('finished');
    overlay.inert = true;
    document.body.classList.remove('intro-active');
    window.setTimeout(()=>{ overlay.hidden=true; },650);
    g.sfx.setCar(false);
    music?.stop();
    setOpeningDeerBeat(null);
    park();
    wave(0,time);
    onFinish();
  }

  function paint(at, render) {
    const inside = INSIDE(at);
    const oldFov = camera.fov;
    const frameAt = !reduced ? at : at < 7 ? 3 : at < 17 ? 12 : at < 24 ? 20 : at < 32 ? 30 : at < 44 ? 35 : LENGTH;
    setOpeningDeerBeat(frameAt);
    const x = distanceAt(frameAt);
    const turn = smooth(frameAt,44,49);
    const lane = STREET.roadCenterZ + 1.32;
    const z = THREE.MathUtils.lerp(lane,CAR_SPAWN.z,turn);
    const steer = (reduced || at >= ARRIVAL ? 0 : Math.sin(at*1.9)*0.045) + Math.sin(turn*Math.PI)*0.18;
    const speed = at<24 ? 17.9 : at<44 ? THREE.MathUtils.lerp(17.9,11.2,smooth(at,24,32)) : 8*(1-smooth(at,44,49));
    eye.copy(camera.position);
    rotation.copy(camera.quaternion);
    car.position.set(x,0,z);
    car.rotation.y=-Math.sin(turn*Math.PI)*0.28;
    poseCarWheels(car, steer, x - ROUTE[0][1]);
    car.updateMatrixWorld(true);
    const handoff = smooth(at, ARRIVAL + 1, LENGTH);
    g.cabin.update({visible:inside,speed,steer,opening:at<ARRIVAL,boxes:true,notice:at>=12&&at<17,
      clock:at>=ARRIVAL?'08:30':'',fuel:g.car.fuel.get()/FUEL.TANK,
      shade:THREE.MathUtils.lerp(0.91+0.17*Math.sin(x*2.3)*Math.cos(x*0.46),1,handoff)});
    wave(smooth(at,ARRIVAL,ARRIVAL+0.45)*(1-handoff), at);
    if (inside) {
      if (g.isMobile && camera.aspect < 1) {
        camera.fov = THREE.MathUtils.lerp(Math.max(oldFov, 83), oldFov, handoff);
        camera.updateProjectionMatrix();
      }
      const seat = car.userData.seat;
      camera.position.copy(car.localToWorld(target.set(seat.x, seat.y, seat.z)));
      const arrivalLook = reduced ? 0 : 0.48 * smooth(at, 48.3, 49.65) * (1 - handoff);
      // Driver glances over toward the roadside deer before the camera cuts to focus on it.
      const deerGlance = smooth(at, 14.5, 15.8) * (1 - smooth(at, 17.4, 17.8));
      const glanceBack = smooth(at, 23.6, 24.4) * (1 - smooth(at, 24.4, 25.3));
      forward.set(1,-0.05*(1-handoff),0).applyQuaternion(car.quaternion);
      if (deerGlance > 0.001) {
        const deerTarget = target.set(-170.0, 1.0, STREET.roadCenterZ + 10.5).sub(camera.position).normalize();
        forward.lerp(deerTarget, deerGlance * 0.72);
      } else if (glanceBack > 0.001) {
        const deerTarget = target.set(-170.0, 1.0, STREET.roadCenterZ + 10.5).sub(camera.position).normalize();
        forward.lerp(deerTarget, glanceBack * 0.35);
      }
      forward.lerp(target.set(0.0,1.5,-4.40).sub(camera.position).normalize(), arrivalLook);
      camera.lookAt(target.copy(camera.position).add(forward));
      g.actions.drive(g.cabin.grips);
    } else {
      g.actions.rig.visible=false;
      if(at<7) {
        const k=smooth(at,0,7);
        camera.position.set(x-16+8*k,23-13*k,z-9);
        camera.lookAt(x+7,0.4,z);
      } else if(at<24) {
        // Hero focus shot on the 1.72m stag bending down to grab & eat grass, then panning to the passing pickup.
        const dolly = smooth(frameAt, 17, 24);
        const panToTruck = smooth(frameAt, 20.6, 22.8);
        const deerZ = STREET.roadCenterZ + 10.5;
        camera.position.set(
          THREE.MathUtils.lerp(-166.1, -166.9, dolly),
          THREE.MathUtils.lerp(1.12, 1.28, dolly),
          THREE.MathUtils.lerp(deerZ + 1.85, deerZ + 1.15, dolly)
        );
        const deerFocusX = -170.0;
        const deerFocusY = THREE.MathUtils.lerp(0.82, 1.12, smooth(frameAt, 19.0, 20.5));
        const deerFocusZ = deerZ - 0.1;
        camera.lookAt(
          THREE.MathUtils.lerp(deerFocusX, x + 2.0, panToTruck),
          THREE.MathUtils.lerp(deerFocusY, 0.90, panToTruck),
          THREE.MathUtils.lerp(deerFocusZ, z, panToTruck)
        );
      } else {
        const k=smooth(at,32,44);
        camera.position.set(x-12+10*k,5+12*Math.sin(Math.PI*k),z-7+3*k);
        target.set(x+15,0.9,z);
        if (welcome) {
          const signFocus = smooth(at,32,34.4) * (1-smooth(at,35,38));
          target.lerp(forward.set(welcome.position.x,2,welcome.position.z), signFocus * 0.8);
        }
        camera.lookAt(target);
      }
      if(reduced) {
        if(at<7) { camera.position.set(-266,18,-2); camera.lookAt(-249,0,lane); }
        else if(at>=32) {
          camera.position.set(-65,5,lane-4);
          camera.lookAt(-44,1.2,lane+4);
        }
      }
    }
    const sky = scene.getObjectByName('sky');
    if (sky) sky.position.copy(camera.position);
    try { render(); }
    finally {
      camera.position.copy(eye);
      camera.quaternion.copy(rotation);
      if (camera.fov !== oldFov) {
        camera.fov = oldFov;
        camera.updateProjectionMatrix();
      }
      camera.updateMatrixWorld(true);
      g.actions.rig.visible=false;
    }
  }

  return {
    get active() { return phase==='loading'||phase==='playing'; },
    async start() {
      if (phase!=='idle') return;
      phase='loading';
      g.clock.setTime(8*60+12);
      overlay.hidden=false;
      document.body.classList.add('intro-active');
      overlay.classList.add('loading');
      music = g.sfx.openingMusic();
      try {
        await warmOpening({renderer,scene,camera,paint,active:()=>phase==='loading',
          progress: value=>{progress.value=value;}});
      } catch (error) {
        console.warn('Opening warm-up skipped:',error);
      }
      if(phase!=='loading') return;
      phase='playing';
      overlay.classList.remove('loading');
      overlay.classList.add('playing');
      button.hidden = !seen;
      music?.start();
    },
    draw(delta,render) {
      if(phase==='loading') return true;
      if(phase!=='playing') return false;
      if (hold) {
        const held = Math.min(1, (performance.now() - hold.from) / SKIP_HOLD_MS);
        button.style.setProperty('--held', String(held));
        if (held >= 1) {
          clearHold();
          button.hidden = true;
          time = Math.max(time, ARRIVAL);
        }
      }
      const at = Math.min(time, LENGTH);
      time += Math.min(delta,0.075)*(fastForward?2.2:1);
      const endShot=at>=ARRIVAL;
      music?.radio(INSIDE(at));
      if(endShot&&!shutDown) {
        shutDown=true;
        music?.stop();
        g.sfx.setCar(false);
        g.sfx.play('car');
        g.sfx.play('bird-chirp');
        g.clock.setTime(8*60+30);
      } else if(!endShot) g.sfx.setCar(true,at<32?0.63:0.38);
      if (at >= ARRIVAL + 1) {
        overlay.classList.add('leaving');
        button.hidden = true;
        clearHold();
      }
      credit.style.opacity=String(smooth(at,1,2.1)-smooth(at,4.9,6.6));
      title.style.opacity=String(smooth(at,26,27.6)-smooth(at,30.8,32));
      caption.style.opacity=String(smooth(at,0.6,1.4)-smooth(at,5.1,6.4));

      // Two timed texts from Rita during the drive.
      const notice1 = smooth(at,12,12.4)-smooth(at,15.6,16.4);
      const notice2 = smooth(at,35.2,35.6)-smooth(at,39.8,40.6);
      if (notice2 > 0.01) {
        if (notice.dataset.n !== '2') {
          notice.dataset.n = '2';
          notice.textContent = "Rita · Don't mind the porch — last tenant left in a hurry.";
        }
        notice.style.opacity = String(notice2);
      } else {
        if (notice.dataset.n !== '1') {
          notice.dataset.n = '1';
          notice.textContent = 'Rita · Keys are ready! See you at 8:30.';
        }
        notice.style.opacity = String(notice1);
      }

      // Timed inner-monologue story captions.
      const beat = STORY_BEATS.find(b => at >= b.from && at <= b.to);
      if (beat) {
        if (story.textContent !== beat.text) story.textContent = beat.text;
        const fade = smooth(at, beat.from, beat.from + 0.65) - smooth(at, beat.to - 0.75, beat.to);
        story.style.opacity = String(Math.max(0, fade));
      } else {
        story.style.opacity = '0';
      }

      if(reduced) {
        const cut=[7,17,24,32,44].find(value=>Math.abs(value-at)<0.36);
        overlay.style.background=cut? `rgba(0,0,0,${(1-Math.abs(cut-at)/0.36)*0.52})` : '';
      }
      paint(at,render);
      if (at === LENGTH) finish();
      return true;
    }
  };
}
