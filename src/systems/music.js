const BEAT = 60 / 84;
const CHORDS = [[43,55,59,62,67],[38,54,57,62,66],[40,55,59,64,67],[36,55,60,64,67]];
const hz = note => 440 * 2 ** ((note-69)/12);

export function createOpeningMusic(context, output) {
  const bus = context.createGain();
  const dry = context.createGain();
  const radio = context.createBiquadFilter();
  const wet = context.createGain();
  const drive = context.createWaveShaper();
  drive.curve = Float32Array.from({length:65},(_,i)=>Math.tanh((i/32-1)*1.22));
  radio.type = 'bandpass';
  radio.frequency.value = 1050;
  radio.Q.value = 0.43;
  bus.connect(dry).connect(output);
  bus.connect(radio).connect(drive).connect(wet).connect(output);
  dry.gain.value = 1;
  wet.gain.value = 0;
  let sources = [];
  let sourceFile;
  let origin;
  let lastRadio;
  const chordLength = BEAT * 4;
  const sampleRate = context.sampleRate;
  function voice(node, time, length, gain, attack=0.018, destination=bus) {
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(0,time);
    envelope.gain.linearRampToValueAtTime(gain,time+attack);
    envelope.gain.exponentialRampToValueAtTime(0.0001,time+length);
    node.connect(envelope).connect(destination);
    node.start(time);
    node.stop(time+length+0.01);
    sources.push(node);
  }
  function oscillator(type, frequency) {
    const node = context.createOscillator();
    node.type=type; node.frequency.value=frequency;
    return node;
  }
  const plucks = new Map();
  function guitar(note) {
    if (!plucks.has(note)) {
      const buffer = context.createBuffer(1,Math.floor(sampleRate*0.9),sampleRate);
      const data = buffer.getChannelData(0);
      const period = Math.max(2,Math.round(sampleRate/hz(note)));
      for(let i=0;i<period;i++) data[i]=Math.random()*2-1;
      for(let i=period;i<data.length;i++) data[i]=0.498*(data[i-period]+data[i-period+1]);
      plucks.set(note,buffer);
    }
    const node = context.createBufferSource();
    node.buffer=plucks.get(note);
    return node;
  }
  function compose() {
    const pad = context.createBiquadFilter();
    pad.type='lowpass'; pad.frequency.value=480; pad.connect(bus);
    const noise = context.createBuffer(1,Math.floor(sampleRate*0.11),sampleRate);
    const data = noise.getChannelData(0);
    for(let i=0;i<data.length;i++) data[i]=Math.random()*2-1;
    const shake = context.createBiquadFilter();
    shake.type='bandpass'; shake.frequency.value=4200; shake.connect(bus);
    for(let bar=0;bar<18;bar++) {
      const t=origin+bar*chordLength;
      const chord=CHORDS[bar >= 17 ? 0 : bar%4];
      const lift=bar>=9&&bar<13;
      for(const note of chord.slice(0,4)) {
        for(const detune of [-4,4]) {
          const tone=oscillator('triangle',hz(note));
          tone.detune.value=detune;
          voice(tone,t,3.05,lift?0.013:0.008,0.55,pad);
        }
      }
      for(let beat=0;beat<8;beat++) {
        const tick=t+beat*BEAT/2;
        const note=chord[[0,2,3,1,4,2,3,1][beat]];
        voice(guitar(note),tick,0.78,beat%2?0.07:0.12);
        if(bar>=2 && beat%2===1) {
          const pitch=hz(note+12);
          voice(oscillator('sine',pitch),tick,0.52,lift?0.045:0.025);
          voice(oscillator('sine',pitch*2),tick,0.13,0.008);
        }
        if(bar>=6&&bar<16&&beat%2===0) {
          const shaker=context.createBufferSource();
          shaker.buffer=noise;
          voice(shaker,tick,0.10,0.025,0.007,shake);
          if(beat===0||beat===4) {
            const kick=oscillator('sine',85);
            kick.frequency.exponentialRampToValueAtTime(38,tick+0.15);
            voice(kick,tick,0.18,0.08,0.006);
          }
        }
      }
    }
  }
  // Optional checked-in sources are referenced only when the deployment includes them.
  const override = document.querySelector('meta[name="maple-opening-audio"]')?.content;
  if (override && /^assets\/audio\/opening\.(mp3|ogg)$/.test(override)) {
    fetch(override).then(response => {
      if (!response.ok) throw new Error('Opening audio unavailable');
      return response.arrayBuffer();
    }).then(bytes=>context.decodeAudioData(bytes)).then(buffer=>{sourceFile=buffer;}).catch(()=>{});
  }
  return {
    start() {
      if (origin!==undefined) return;
      origin=context.currentTime+0.04;
      bus.gain.setValueAtTime(0.48,origin);
      if(sourceFile) {
        const node=context.createBufferSource();
        node.buffer=sourceFile;
        node.connect(bus);
        node.start(origin);
        sources.push(node);
      } else compose();
    },
    radio(inside) {
      if(inside===lastRadio) return;
      lastRadio=inside;
      dry.gain.setTargetAtTime(inside?0:1,context.currentTime,0.16);
      wet.gain.setTargetAtTime(inside?1.55:0,context.currentTime,0.16);
    },
    stop() {
      if(origin===undefined) return;
      const t=context.currentTime;
      bus.gain.setTargetAtTime(0,t,0.12);
      for(const node of sources) {
        try { node.stop(t+0.65); } catch { /* already ended */ }
      }
      sources=[];
    }
  };
}
