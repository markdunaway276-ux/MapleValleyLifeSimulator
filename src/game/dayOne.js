import * as THREE from 'three';
import { STREET } from '../world/street.js';

const SHOT_SECONDS = 4.4;
const STAGES = ['walk', 'phone', 'market', 'day', 'done'];

export function createDayOne(g, saveData, beginPlay) {
  const { camera, isMobile, player, scene } = g;
  const fresh = Object.keys(saveData).length === 0;
  let stage = fresh ? 'walk' : (STAGES.includes(saveData.dayOne) ? saveData.dayOne : 'done');
  let elapsed = 0;
  let playing = false;
  let initialPosition;
  let marketWaypointSet = false;
  const south = STREET.roadCenterZ - STREET.roadWidth / 2 - STREET.sidewalkWidth / 2;
  const north = STREET.roadCenterZ + STREET.roadWidth / 2 + STREET.sidewalkWidth / 2;
  const marketX = scene.userData.cornerShop.position.x;
  const market = { id: 'day-one-market', name: 'Corner Market', position: () => ({ x: marketX, z: north }) };
  const shots = [
    { title: 'Day One', text: 'Your first morning on Maple Lane. You have a place to call home and a whole day to settle in.',
      from: [-13, 5.2, 4], to: [-6, 3.3, 2.4], aim: [0, 1.7, -9] },
    { title: 'Corner Market', text: 'The market is a short walk from home. Pick up what you need and get to know the people behind the counter.',
      from: [marketX - 9, 4.2, 5], to: [marketX - 2, 2.9, 7.5], aim: [marketX, 1.9, 15] },
    { title: 'Maple Lane Park', text: 'There’s a park just past the market. For now, take a walk and get your bearings.',
      from: [66, 7, 9], to: [72, 6.4, 15], aim: [83, 1.2, 27] }
  ];
  const motion = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const eye = new THREE.Vector3();
  const orientation = new THREE.Quaternion();
  const end = new THREE.Vector3();

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

  function renderTask() {
    const dismiss = isMobile ? 'Skip tutorial' : 'Skip tutorial [X]';
    switch (stage) {
      case 'walk':
        show('Get your bearings', isMobile
          ? 'Use the left stick to walk and drag the right side of the screen to look around.'
          : 'Walk a few steps with WASD or the arrow keys. Move the mouse to look around.', dismiss);
        break;
      case 'phone':
        show('Check your phone', 'Open the phone from the HUD. The map shows where things are, and Tasks keeps track of favors and work.', dismiss);
        break;
      case 'market':
        show('Walk to Corner Market', 'Follow the minimap route and use a marked crossing. At the market, ' +
          (isMobile ? 'tap the interaction prompt' : 'press E when prompted') + ' to browse or talk.', dismiss);
        break;
      case 'day':
        show('Make the day your own', 'Browse the market, ask a neighbor about a favor, or explore the park. Check your needs as you go and use the bed at home when you’re ready to end the day.',
          isMobile ? 'Finish tutorial' : 'Finish tutorial [X]');
        break;
    }
  }

  function clearWaypoint() {
    if (g.minimap.getWaypointId() === market.id) g.minimap.setWaypoint(null);
  }

  function finishTutorial() {
    stage = 'done';
    panel.hidden = true;
    clearWaypoint();
    g.save();
  }

  function beginTutorial() {
    playing = false;
    panel.classList.remove('day-one-cinematic');
    if (fresh) {
      player.position.set(0, 1.6, south);
      player.rotation.set(0, -Math.PI / 2, 0);
    }
    initialPosition = player.position.clone();
    panel.hidden = stage === 'done';
    renderTask();
    beginPlay();
    if (fresh) g.save();
  }

  action.addEventListener('click', () => {
    if (playing) beginTutorial();
    else finishTutorial();
  });
  window.addEventListener('keydown', event => {
    if (event.code === 'KeyX' && !panel.hidden && !event.repeat && !event.ctrlKey && !event.metaKey && !event.altKey &&
        !event.target?.closest?.('input, textarea, [contenteditable]')) {
      action.click();
    }
  });

  return {
    start() {
      if (!fresh) {
        beginTutorial();
        return;
      }
      playing = true;
      panel.classList.add('day-one-cinematic');
      panel.hidden = false;
      show(shots[0].title, shots[0].text, isMobile ? 'Skip intro' : 'Skip intro [X]');
      action.focus();
    },
    draw(delta, render) {
      if (!playing) return false;
      elapsed += delta;
      const index = Math.min(shots.length - 1, Math.floor(elapsed / SHOT_SECONDS));
      const shot = shots[index];
      show(shot.title, shot.text, elapsed >= SHOT_SECONDS * shots.length
        ? 'Start Day One' : (isMobile ? 'Skip intro' : 'Skip intro [X]'));
      const progress = motion ? THREE.MathUtils.smoothstep(elapsed - index * SHOT_SECONDS, 0, SHOT_SECONDS) : 0;
      eye.copy(camera.position);
      orientation.copy(camera.quaternion);
      camera.position.fromArray(shot.from).lerp(end.fromArray(shot.to), progress);
      camera.lookAt(...shot.aim);
      try {
        render();
      } finally {
        camera.position.copy(eye);
        camera.quaternion.copy(orientation);
      }
      return true;
    },
    update() {
      if (!g.mode.started() || stage === 'done') return;
      const phoneOpen = g.phone.isOpen();
      panel.hidden = g.mode.menuOpen() && !phoneOpen;
      const prior = stage;
      if (stage === 'walk' && Math.hypot(player.position.x - initialPosition.x, player.position.z - initialPosition.z) >= 2) {
        stage = 'phone';
      } else if (stage === 'phone' && phoneOpen) {
        stage = 'market';
      }
      if (stage === 'market' && !phoneOpen) {
        if (!marketWaypointSet) {
          marketWaypointSet = true;
          if (!g.minimap.getWaypointId()) g.minimap.setWaypoint(market);
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
    hide() { if (!playing) panel.hidden = true; },
    serialize: () => stage
  };
}
