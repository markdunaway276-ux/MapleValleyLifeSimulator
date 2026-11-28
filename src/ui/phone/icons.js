/**
 * Crisp inline SVG Material-style icons for the in-game Android phone UI.
 * No real-world brand logos — clean geometric vector symbols on dark-tinted
 * adaptive icon backgrounds.
 */

const SVG_OPEN = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
const SVG_CLOSE = '</svg>';

export const APP_ICON_META = Object.freeze({
  messages: {
    bg: 'linear-gradient(145deg, #2b75e0, #174da3)',
    fg: '#f0f6ff',
    svg: `${SVG_OPEN}<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/><line x1="8.5" y1="11" x2="15.5" y2="11"/><line x1="8.5" y1="14.5" x2="13" y2="14.5"/>${SVG_CLOSE}`
  },
  bank: {
    bg: 'linear-gradient(145deg, #1f8a60, #12583d)',
    fg: '#e9fff5',
    svg: `${SVG_OPEN}<path d="M3 10h18"/><path d="M5 10v8"/><path d="M10 10v8"/><path d="M14 10v8"/><path d="M19 10v8"/><path d="M2 20h20"/><path d="M12 3L2 8.5h20L12 3z"/>${SVG_CLOSE}`
  },
  map: {
    bg: 'linear-gradient(145deg, #218588, #14555a)',
    fg: '#ecffff',
    svg: `${SVG_OPEN}<path d="M12 21s-6-5.3-6-10.2a6 6 0 1 1 12 0C18 15.7 12 21 12 21z"/><circle cx="12" cy="10.5" r="2.2"/>${SVG_CLOSE}`
  },
  style: {
    bg: 'linear-gradient(145deg, #9b5144, #683027)',
    fg: '#fff2ef',
    svg: `${SVG_OPEN}<path d="M20.38 3.46L16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"/>${SVG_CLOSE}`
  },
  weather: {
    bg: 'linear-gradient(145deg, #2e79bd, #1a4b7d)',
    fg: '#f2f9ff',
    svg: `${SVG_OPEN}<path d="M12 3v2"/><path d="M5.6 5.6l1.4 1.4"/><path d="M18.4 5.6L17 7"/><circle cx="12" cy="10" r="3.2"/><path d="M7.5 19h9a3.5 3.5 0 0 0 .4-6.98 5 5 0 0 0-9.65-1.1A3.2 3.2 0 0 0 7.5 19z" fill="currentColor" fill-opacity="0.22"/>${SVG_CLOSE}`
  },
  skills: {
    bg: 'linear-gradient(145deg, #b57726, #7a4c12)',
    fg: '#fff7e8',
    svg: `${SVG_OPEN}<circle cx="12" cy="9" r="5"/><path d="M8.5 13.5L7 21l5-2.5L17 21l-1.5-7.5"/>${SVG_CLOSE}`
  },
  settings: {
    bg: 'linear-gradient(145deg, #525e6d, #323b46)',
    fg: '#eef2f6',
    svg: `${SVG_OPEN}<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>${SVG_CLOSE}`
  },
  camera: {
    bg: 'linear-gradient(145deg, #323942, #191d23)',
    fg: '#f2f5f8',
    svg: `${SVG_OPEN}<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>${SVG_CLOSE}`
  },
  gallery: {
    bg: 'linear-gradient(145deg, #6b569e, #41326a)',
    fg: '#f4f0ff',
    svg: `${SVG_OPEN}<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="M21 16l-5-5-7 7"/>${SVG_CLOSE}`
  },
  tasks: {
    bg: 'linear-gradient(145deg, #2d7d6b, #1b5246)',
    fg: '#ecfff9',
    svg: `${SVG_OPEN}<rect x="4" y="3" width="16" height="18" rx="2.5"/><path d="M8.5 9l1.5 1.5L13 7.5"/><line x1="8.5" y1="14.5" x2="15.5" y2="14.5"/><line x1="8.5" y1="17.5" x2="13.5" y2="17.5"/>${SVG_CLOSE}`
  },
  home: {
    bg: 'linear-gradient(145deg, #b8663d, #7c3f21)',
    fg: '#fff5ee',
    svg: `${SVG_OPEN}<path d="M3 10.5L12 3l9 7.5"/><path d="M5 9.5V20h14V9.5"/><path d="M9.5 20v-6h5v6"/>${SVG_CLOSE}`
  },
  calendar: {
    bg: 'linear-gradient(145deg, #3e61ad, #253d75)',
    fg: '#eef4ff',
    svg: `${SVG_OPEN}<rect x="3" y="4" width="18" height="17" rx="2.5"/><line x1="16" y1="2.5" x2="16" y2="6"/><line x1="8" y1="2.5" x2="8" y2="6"/><line x1="3" y1="9.5" x2="21" y2="9.5"/><rect x="7.5" y="13" width="3" height="3" rx="0.5" fill="currentColor" stroke="none"/>${SVG_CLOSE}`
  }
});

export const ANDROID_STATUS_ICONS_SVG = `
<span class="phone-sys-icons" aria-hidden="true">
  <svg viewBox="0 0 16 12" width="14" height="11" fill="currentColor"><rect x="1" y="8" width="2.2" height="3.5" rx="0.6"/><rect x="4.6" y="5.8" width="2.2" height="5.7" rx="0.6"/><rect x="8.2" y="3.5" width="2.2" height="8" rx="0.6"/><rect x="11.8" y="1" width="2.2" height="10.5" rx="0.6" opacity="0.38"/></svg>
  <svg viewBox="0 0 16 12" width="14" height="11" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2 4.2a9 9 0 0 1 12 0"/><path d="M4.6 6.8a5.4 5.4 0 0 1 6.8 0"/><circle cx="8" cy="10" r="1.1" fill="currentColor" stroke="none"/></svg>
  <svg viewBox="0 0 22 12" width="19" height="11" fill="none"><rect x="0.8" y="1.4" width="17.5" height="9.2" rx="2.2" stroke="currentColor" stroke-width="1.3"/><rect x="2.6" y="3.2" width="11.8" height="5.6" rx="1" fill="currentColor"/><rect x="19.3" y="4" width="1.8" height="4" rx="0.8" fill="currentColor"/></svg>
</span>`;

export const FINGERPRINT_SVG = `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="M12 11a2 2 0 0 1 2 2c0 2.5-.5 4.8-1.5 6.8"/><path d="M8.5 11.8A4.2 4.2 0 0 1 16 13c0 2.7-.5 5-1.4 7"/><path d="M6.2 14.5A6.5 6.5 0 0 1 12 6.5a6.5 6.5 0 0 1 6.5 6.5c0 2.3-.3 4.3-1 6"/><path d="M12 3.5a9.5 9.5 0 0 1 9 6.5"/><path d="M4.5 9.2A9.5 9.5 0 0 1 12 3.5"/><path d="M10.2 14.5c0 1.8-.3 3.4-.9 4.8"/></svg>`;
