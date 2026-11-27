import * as THREE from 'three';
import { CAR_SEAT, CAR_SPAWN, poseCarWheels } from '../world/props.js';
import { STREET } from '../world/street.js';
import { warmOpening } from './loadingGate.js';

const LENGTH = 52;
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

export function createRoadTrip(g, onFinish, wave) {
  const {camera,scene,renderer} = g;
  const car = g.car.object;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const eye = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const target = new THREE.Vector3();
  const forward = new THREE.Vector3();
  let phase = 'idle';
  let time = 0;
  let music;
  let shutDown = false;

  const overlay = document.createElement('section');
  overlay.className = 'road-trip';
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="road-trip-bar top"></div><div class="road-trip-bar bottom"></div>
    <div class="road-trip-title"><strong>MAPLE LANE</strong><span>a small-town life</span></div>
    <div class="road-trip-caption">Route 9 · 8:12 AM</div>
    <div class="road-trip-notice">Rita · Keys are ready! See you at 8:30.</div>
    <div class="road-trip-loading"><div>Getting Maple Lane ready…</div><progress aria-label="Loading Maple Lane" max="1" value="0"></progress></div>
    <button type="button" class="road-trip-skip">Skip intro</button>`;
  document.body.append(overlay);
  const button = overlay.querySelector('button');
  const progress = overlay.querySelector('progress');
  const title = overlay.querySelector('.road-trip-title');
  const caption = overlay.querySelector('.road-trip-caption');
  const notice = overlay.querySelector('.road-trip-notice');
  button.addEventListener('click', () => finish());
  overlay.addEventListener('keydown', event => {
    if (event.code === 'Escape' || event.code === 'KeyX') {
      event.preventDefault();
      event.stopPropagation();
      finish();
    }
  });
  window.addEventListener('keydown', event => {
    if ((phase === 'loading' || phase === 'playing') && (event.code === 'Escape' || event.code === 'KeyX')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      finish();
    }
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
    overlay.classList.remove('playing','loading');
    overlay.classList.add('finished');
    overlay.inert = true;
    document.body.classList.remove('intro-active');
    window.setTimeout(()=>{ overlay.hidden=true; },650);
    g.sfx.setCar(false);
    music?.stop();
    park();
    wave(0,time);
    g.clock.setTime(8*60+30);
    onFinish();
  }

  function paint(at, render) {
    const inside = INSIDE(at);
    const oldFov = camera.fov;
    const frameAt = !reduced ? at : at < 7 ? 3 : at < 17 ? 12 : at < 24 ? 20 : at < 32 ? 30 : at < 44 ? 40 : 52;
    const x = distanceAt(frameAt);
    const turn = smooth(frameAt,44,49);
    const lane = STREET.roadCenterZ + 1.32;
    const z = THREE.MathUtils.lerp(lane,CAR_SPAWN.z,turn);
    const steer = (reduced ? 0 : Math.sin(at*1.9)*0.045) + Math.sin(turn*Math.PI)*0.18;
    const speed = at<24 ? 17.9 : at<44 ? THREE.MathUtils.lerp(17.9,11.2,smooth(at,24,32)) : 8*(1-smooth(at,44,49));
    eye.copy(camera.position);
    rotation.copy(camera.quaternion);
    car.position.set(x,0,z);
    car.rotation.y=-Math.sin(turn*Math.PI)*0.28;
    poseCarWheels(car, steer, x - ROUTE[0][1]);
    car.updateMatrixWorld(true);
    g.cabin.update({visible:inside,speed,steer,opening:true,notice:at>=12&&at<17,
      shade:0.91+0.17*Math.sin(x*2.3)*Math.cos(x*0.46)});
    wave(at >= 49 ? smooth(at,49,49.45) : 0, at);
    if (inside) {
      if (g.isMobile && camera.aspect < 1) {
        camera.fov = Math.max(camera.fov, 83);
        camera.updateProjectionMatrix();
      }
      camera.position.copy(car.localToWorld(target.set(CAR_SEAT.x,CAR_SEAT.y,CAR_SEAT.z)));
      const signLook = (smooth(at,25,27)-smooth(at,28.4,31.5))*0.25;
      const arrivalLook = smooth(at,49,52)*0.55;
      forward.set(1,-0.05,signLook).applyQuaternion(car.quaternion);
      forward.lerp(target.set(0.95,1.5,-3.25).sub(camera.position).normalize(), arrivalLook * 0.8);
      camera.lookAt(target.copy(camera.position).add(forward));
      g.actions.drive(g.cabin.grips);
    } else {
      g.actions.rig.visible=false;
      if(at<7) {
        const k=smooth(at,0,7);
        camera.position.set(x-16+8*k,23-13*k,z-9);
        camera.lookAt(x+7,0.4,z);
      } else if(at<24) {
        camera.position.set(-170,1.48,lane+10.2);
        camera.lookAt(x+2,0.75,z);
      } else {
        const k=smooth(at,32,44);
        camera.position.set(x-12+10*k,5+12*Math.sin(Math.PI*k),z-7+3*k);
        camera.lookAt(x+15,0.9,z);
      }
      if(reduced) {
        if(at<7) { camera.position.set(-266,18,-2); camera.lookAt(-249,0,lane); }
        else if(at>=32) { camera.position.set(-35,14,-9); camera.lookAt(18,2,lane); }
      }
    }
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
      button.focus();
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
      music?.start();
    },
    draw(delta,render) {
      if(phase==='loading') return true;
      if(phase!=='playing') return false;
      const at=time;
      time+=Math.min(delta,0.075);
      if(time>=LENGTH) { finish(); return true; }
      const endShot=at>=49;
      music?.radio(INSIDE(at));
      if(endShot&&!shutDown) {
        shutDown=true;
        music?.stop();
        g.sfx.setCar(false);
        g.sfx.play('car');
        g.sfx.play('bird-chirp');
      } else if(!endShot) g.sfx.setCar(true,at<32?0.63:0.38);
      title.style.opacity=String(smooth(at,26,27.6)-smooth(at,30.8,32));
      caption.style.opacity=String(smooth(at,0.6,1.4)-smooth(at,5.1,6.4));
      notice.style.opacity=String(smooth(at,12,12.4)-smooth(at,15.6,16.4));
      if(reduced) {
        const cut=[7,17,24,32,44].find(value=>Math.abs(value-at)<0.36);
        overlay.style.background=cut? `rgba(0,0,0,${(1-Math.abs(cut-at)/0.36)*0.52})` : '';
      }
      paint(at,render);
      return true;
    }
  };
}
