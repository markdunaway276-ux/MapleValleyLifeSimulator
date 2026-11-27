const OPENING_TRACK = new URL('../../assets/audio/opening.mp3', import.meta.url);
const TRACK_GAIN = 0.32;
const FADE_IN = 1.4;

// Start the download during the opening's render warm-up.
export function createOpeningMusic(context, output) {
  const track = fetch(OPENING_TRACK).then(response => {
    if (!response.ok) throw new Error('Opening audio unavailable');
    return response.arrayBuffer();
  }).then(bytes => context.decodeAudioData(bytes)).catch(error => {
    console.warn('Opening music unavailable:', error);
    return null;
  });

  const bus = context.createGain();
  const dry = context.createGain();
  const radio = context.createBiquadFilter();
  const wet = context.createGain();
  radio.type = 'bandpass';
  radio.frequency.value = 1050;
  radio.Q.value = 0.43;
  bus.connect(dry).connect(output);
  bus.connect(radio).connect(wet).connect(output);
  dry.gain.value = 1;
  wet.gain.value = 0;
  let source;
  let started = false;
  let fadeStartedAt;
  let stopped = false;
  let lastRadio;

  function disconnect() {
    dry.disconnect();
    wet.disconnect();
  }

  return {
    async start() {
      if (started || stopped) return;
      started = true;
      const buffer = await track;
      if (stopped) return;
      if (!buffer) { disconnect(); return; }
      const now = context.currentTime;
      source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(bus);
      source.onended = () => {
        source.disconnect();
        source = null;
        disconnect();
      };
      fadeStartedAt = now;
      bus.gain.setValueAtTime(0, now);
      bus.gain.linearRampToValueAtTime(TRACK_GAIN, now + FADE_IN);
      source.start(now);
    },
    radio(inside) {
      if (stopped || inside === lastRadio) return;
      lastRadio = inside;
      dry.gain.setTargetAtTime(inside ? 0 : 1, context.currentTime, 0.16);
      wet.gain.setTargetAtTime(inside ? 1.35 : 0, context.currentTime, 0.16);
    },
    stop() {
      if (stopped) return;
      stopped = true;
      if (!source) { disconnect(); return; }
      const now = context.currentTime;
      const gain = TRACK_GAIN * Math.min(1, (now - fadeStartedAt) / FADE_IN);
      bus.gain.cancelScheduledValues(now);
      bus.gain.setValueAtTime(gain, now);
      bus.gain.linearRampToValueAtTime(0, now + 0.85);
      source.stop(now + 0.85);
    }
  };
}
