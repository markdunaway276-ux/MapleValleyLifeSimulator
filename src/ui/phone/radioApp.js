import { RADIO_STATIONS } from '../../systems/radio.js';

/**
 * Maple FM Radio phone app: switch between cozy stations on foot, at home,
 * or while driving the pickup (press R in the truck to cycle stations).
 */
export function renderRadioApp(screen, ctx) {
  const radio = ctx?.radio;
  const title = document.createElement('h3');
  title.className = 'phone-app-title';
  title.textContent = 'Maple FM Radio';

  const nowCard = document.createElement('div');
  nowCard.style.cssText = 'padding:10px 12px;border-radius:12px;background:rgba(255,255,255,0.08);margin-bottom:10px;';
  const freqEl = document.createElement('div');
  freqEl.style.cssText = 'font-size:11px;opacity:0.75;letter-spacing:0.06em;text-transform:uppercase;';
  const nameEl = document.createElement('div');
  nameEl.style.cssText = 'font-size:16px;font-weight:700;margin:2px 0;';
  const tagEl = document.createElement('div');
  tagEl.style.cssText = 'font-size:12px;opacity:0.8;';
  nowCard.append(freqEl, nameEl, tagEl);

  const list = document.createElement('div');
  list.style.cssText = 'display:flex;flex-direction:column;gap:6px;margin-bottom:12px;';

  const volWrap = document.createElement('label');
  volWrap.className = 'phone-pref';
  volWrap.textContent = 'Volume';
  const volInput = document.createElement('input');
  volInput.type = 'range';
  volInput.min = '0';
  volInput.max = '1';
  volInput.step = '0.05';
  volInput.value = String(radio?.getState?.().volume ?? 0.55);
  volInput.addEventListener('input', () => radio?.setVolume?.(Number(volInput.value)));
  volWrap.append(volInput);

  const tip = document.createElement('p');
  tip.style.cssText = 'font-size:11px;opacity:0.7;margin:8px 0 0;';
  tip.textContent = 'Tip: Press R while driving the pickup to cycle stations.';

  function paint(state) {
    const s = state || radio?.getState?.() || { stationId: 'off', station: RADIO_STATIONS[0], volume: 0.55, playing: false };
    freqEl.textContent = s.playing ? `● ON AIR · ${s.station.freq}` : 'RADIO OFF';
    nameEl.textContent = s.station.name;
    tagEl.textContent = s.station.tagline;
    volInput.value = String(s.volume);

    list.replaceChildren();
    for (const st of RADIO_STATIONS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'phone-task-pin';
      const active = st.id === s.stationId;
      btn.style.cssText = active
        ? 'text-align:left;border:1px solid rgba(236,184,96,0.9);background:rgba(236,184,96,0.22);'
        : 'text-align:left;';
      btn.textContent = st.id === 'off' ? '⏹ Turn Radio Off' : `♫ ${st.name} (${st.freq})`;
      btn.addEventListener('click', () => radio?.setStation?.(st.id));
      list.append(btn);
    }
  }

  paint();
  const off = radio?.onChange?.(paint);
  screen.append(title, nowCard, list, volWrap, tip);
  return () => { if (typeof off === 'function') off(); };
}
