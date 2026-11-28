import { STREET } from '../world/street.js';

/**
 * Procedural Maple FM Radio & Spatial Town Ambience (Web Audio API, zero external MP3s).
 * Stations:
 *   - off: Radio off
 *   - acoustic: Maple FM Acoustic (warm plucked folk guitar arpeggios in G major)
 *   - lofi: Late Night Lo-Fi (mellow Rhodes chords + gentle warm filter)
 *   - ambient: Valley Ambient (soft shimmering acoustic-synth pads)
 *
 * Also layers subtle spatial ambience when unmuted:
 *   - Pond water lapping when standing near Maple Lane Park pond
 *   - Soft outdoor breeze rustling through the trees
 */

export const RADIO_STATIONS = Object.freeze([
  { id: 'off', name: 'Off', freq: '—', tagline: 'Enjoy the sounds of Maple Lane' },
  { id: 'acoustic', name: 'Maple FM Acoustic', freq: '94.3 FM', tagline: 'Warm valley folk & front-porch guitar' },
  { id: 'lofi', name: 'Late Night Lo-Fi', freq: '101.7 FM', tagline: 'Mellow dusty Rhodes for evening drives' },
  { id: 'ambient', name: 'Valley Ambient', freq: '88.9 FM', tagline: 'Gentle mountain pads & calm horizons' }
]);

const ACOUSTIC_NOTES = [196.0, 246.94, 293.66, 329.63, 392.0, 440.0, 493.88, 587.33];
const LOFI_CHORDS = [
  [174.61, 220.0, 261.63, 329.63], // Fmaj7
  [164.81, 196.0, 246.94, 293.66], // Em7
  [146.83, 174.61, 220.0, 261.63], // Dm7
  [130.81, 164.81, 196.0, 246.94]  // Cmaj7
];
const AMBIENT_CHORDS = [
  [146.83, 220.0, 293.66, 369.99], // Dmaj
  [164.81, 246.94, 329.63, 392.0], // Em
  [196.0, 246.94, 293.66, 440.0],  // Gadd9
  [130.81, 196.0, 261.63, 329.63]  // C
];

export function createRadio({ isMuted = () => false } = {}) {
  let stationId = 'off';
  let volume = 0.55;
  let audioCtx = null;
  let radioGain = null;
  let ambientGain = null;
  let pondGain = null;
  let windGain = null;
  let stepTimer = null;
  let stepIndex = 0;
  const listeners = new Set();

  function notify() {
    const snap = getState();
    listeners.forEach(fn => fn(snap));
  }

  function ensureAudio() {
    if (audioCtx) {
      if (audioCtx.state === 'suspended') audioCtx.resume?.().catch(() => {});
      return audioCtx;
    }
    const Ctor = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!Ctor) return null;
    try {
      audioCtx = new Ctor();
    } catch {
      return null;
    }
    radioGain = audioCtx.createGain();
    radioGain.gain.value = 0;
    radioGain.connect(audioCtx.destination);

    // Filtered pink-ish noise bus for gentle pond lapping & outdoor tree breeze.
    const len = audioCtx.sampleRate * 2;
    const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.997 * b0 + white * 0.029;
      b1 = 0.985 * b1 + white * 0.032;
      b2 = 0.950 * b2 + white * 0.048;
      data[i] = (b0 + b1 + b2) * 0.35;
    }

    ambientGain = audioCtx.createGain();
    ambientGain.gain.value = 1;
    ambientGain.connect(audioCtx.destination);

    const pondSrc = audioCtx.createBufferSource();
    pondSrc.buffer = buf;
    pondSrc.loop = true;
    const pondFilter = audioCtx.createBiquadFilter();
    pondFilter.type = 'bandpass';
    pondFilter.frequency.value = 420;
    pondFilter.Q.value = 1.6;
    pondGain = audioCtx.createGain();
    pondGain.gain.value = 0;
    pondSrc.connect(pondFilter).connect(pondGain).connect(ambientGain);
    pondSrc.start();

    const windSrc = audioCtx.createBufferSource();
    windSrc.buffer = buf;
    windSrc.loop = true;
    const windFilter = audioCtx.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.value = 260;
    windGain = audioCtx.createGain();
    windGain.gain.value = 0;
    windSrc.connect(windFilter).connect(windGain).connect(ambientGain);
    windSrc.start();

    return audioCtx;
  }

  function playNote(freq, { type = 'triangle', dur = 0.65, peak = 0.08, filterHz = 1800, delay = 0 } = {}) {
    if (!audioCtx || !radioGain) return;
    const t = audioCtx.currentTime + delay;
    const osc = audioCtx.createOscillator();
    const flt = audioCtx.createBiquadFilter();
    const g = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    flt.type = 'lowpass';
    flt.frequency.setValueAtTime(filterHz, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + 0.025);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(flt).connect(g).connect(radioGain);
    osc.start(t);
    osc.stop(t + dur + 0.03);
  }

  function tickStation() {
    if (stationId === 'off' || isMuted() || !audioCtx) return;
    const s = stepIndex++;
    if (stationId === 'acoustic') {
      const pattern = [0, 2, 4, 5, 4, 2, 1, 3, 0, 4, 6, 7, 5, 4, 2, 1];
      const f = ACOUSTIC_NOTES[pattern[s % pattern.length]];
      playNote(f, { type: 'triangle', dur: 0.72, peak: 0.085, filterHz: 1900 });
      if (s % 4 === 0) playNote(f * 0.5, { type: 'sine', dur: 1.1, peak: 0.06, filterHz: 700 });
    } else if (stationId === 'lofi') {
      if (s % 4 === 0) {
        const chord = LOFI_CHORDS[Math.floor(s / 4) % LOFI_CHORDS.length];
        chord.forEach((f, idx) => {
          playNote(f, { type: 'sine', dur: 2.1, peak: 0.042, filterHz: 950, delay: idx * 0.035 });
        });
      }
      if (s % 2 === 1) {
        const mel = LOFI_CHORDS[Math.floor(s / 4) % LOFI_CHORDS.length][s % 4] * 2;
        playNote(mel, { type: 'triangle', dur: 0.45, peak: 0.028, filterHz: 1100 });
      }
    } else if (stationId === 'ambient') {
      if (s % 6 === 0) {
        const chord = AMBIENT_CHORDS[Math.floor(s / 6) % AMBIENT_CHORDS.length];
        chord.forEach((f, idx) => {
          playNote(f, { type: 'sine', dur: 3.4, peak: 0.032, filterHz: 800, delay: idx * 0.08 });
        });
      }
    }
  }

  function restartLoop() {
    if (stepTimer) {
      clearInterval(stepTimer);
      stepTimer = null;
    }
    if (stationId === 'off') return;
    ensureAudio();
    const ms = stationId === 'acoustic' ? 420 : (stationId === 'lofi' ? 560 : 620);
    tickStation();
    stepTimer = setInterval(tickStation, ms);
  }

  function getState() {
    const def = RADIO_STATIONS.find(s => s.id === stationId) || RADIO_STATIONS[0];
    return {
      stationId: def.id,
      station: def,
      volume,
      playing: def.id !== 'off'
    };
  }

  function setStation(id) {
    const valid = RADIO_STATIONS.some(s => s.id === id) ? id : 'off';
    stationId = valid;
    stepIndex = 0;
    restartLoop();
    if (radioGain && audioCtx) {
      radioGain.gain.setTargetAtTime(stationId === 'off' || isMuted() ? 0 : volume, audioCtx.currentTime, 0.08);
    }
    notify();
    return getState();
  }

  function cycleStation() {
    const idx = RADIO_STATIONS.findIndex(s => s.id === stationId);
    const next = RADIO_STATIONS[(idx + 1) % RADIO_STATIONS.length];
    return setStation(next.id);
  }

  function setVolume(v) {
    volume = Math.max(0, Math.min(1, Number(v) || 0));
    if (radioGain && audioCtx) {
      radioGain.gain.setTargetAtTime(stationId === 'off' || isMuted() ? 0 : volume, audioCtx.currentTime, 0.05);
    }
    notify();
    return volume;
  }

  const pond = STREET.expansion?.pond;
  const pondCx = pond ? (pond.minX + pond.maxX) / 2 : 74;
  const pondCz = pond ? (pond.minZ + pond.maxZ) / 2 : 12;

  function update(delta, { playerPos = null, rain = 0, indoor = false } = {}) {
    if (!audioCtx) return;
    const muted = !!isMuted();
    const t = audioCtx.currentTime;
    if (radioGain) {
      const targetRadio = muted || stationId === 'off' ? 0 : volume * (indoor ? 0.92 : 0.85);
      radioGain.gain.setTargetAtTime(targetRadio, t, 0.12);
    }
    if (pondGain && windGain) {
      if (muted) {
        pondGain.gain.setTargetAtTime(0, t, 0.12);
        windGain.gain.setTargetAtTime(0, t, 0.12);
      } else {
        const distPond = playerPos ? Math.hypot(playerPos.x - pondCx, playerPos.z - pondCz) : 99;
        const pondLevel = indoor ? 0 : Math.max(0, 1 - distPond / 22) * 0.045;
        const windLevel = indoor ? 0.004 : (0.012 + Math.min(1, Number(rain) || 0) * 0.025);
        pondGain.gain.setTargetAtTime(pondLevel, t, 0.2);
        windGain.gain.setTargetAtTime(windLevel, t, 0.2);
      }
    }
  }

  return {
    getState,
    setStation,
    cycleStation,
    setVolume,
    update,
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    dispose() {
      if (stepTimer) clearInterval(stepTimer);
      stepTimer = null;
      if (audioCtx && typeof audioCtx.close === 'function') audioCtx.close().catch(() => {});
      audioCtx = null;
    }
  };
}
