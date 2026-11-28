/**
 * Clean daylight navigation Map app for the phone:
 * floating pill search bar, horizontal category chips, full-bleed live
 * daylight map with tap-to-select POI pins, and a floating bottom place &
 * directions sheet. 100% original procedural cartography and UI.
 */

const STYLE_ID = 'maple-phone-map-app-css';

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'home', label: 'Home' },
  { id: 'shops', label: 'Shops' },
  { id: 'services', label: 'Services' },
  { id: 'park', label: 'Park' }
];

function categoryOf(dest) {
  const id = String(dest?.id || '');
  if (id === 'mailbox' || id === 'desk') return { key: 'home', label: 'Home · Maple Ln', color: '#d97706' };
  if (id === 'market' || id === 'gas-station') return { key: 'shops', label: 'Shop · Maple Ln', color: '#1e8e3e' };
  if (id === 'laundromat' || id === 'post-office') return { key: 'services', label: 'Service · Maple Ln', color: '#1a73e8' };
  if (id === 'park') return { key: 'park', label: 'Public Park · Maple Ln', color: '#1e8e3e' };
  if (id === 'trailer-park') return { key: 'home', label: 'West Maple Ln', color: '#8e44ad' };
  if (id.startsWith('task:')) return { key: 'services', label: 'Active Task', color: '#ea4335' };
  return { key: 'services', label: 'Maple Lane', color: '#1a73e8' };
}

const CSS = `
.nmap-root {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  border-radius: 16px;
  overflow: hidden;
  background: #eef1ec;
  font-family: system-ui, -apple-system, sans-serif;
}
.nmap-canvas-wrap {
  position: relative;
  flex: 1 1 auto;
  min-height: 220px;
  border-radius: 0 !important;
  border: none !important;
}
.nmap-top-overlay {
  position: absolute;
  top: 8px;
  left: 8px;
  right: 8px;
  z-index: 4;
  display: flex;
  flex-direction: column;
  gap: 6px;
  pointer-events: none;
}
.nmap-search-pill {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 6px;
  background: #ffffff;
  color: #202124;
  border-radius: 999px;
  padding: 6px 10px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.22);
}
.nmap-search-icon {
  font-size: 13px;
  color: #5f6368;
  flex-shrink: 0;
}
.nmap-search-input {
  flex: 1 1 auto;
  min-width: 0;
  border: none;
  background: transparent;
  color: #202124;
  font: 500 12px/1.2 system-ui, sans-serif;
  outline: none;
}
.nmap-search-input::placeholder { color: #70757a; }
.nmap-clear-btn {
  border: none;
  background: #eef1f5;
  color: #5f6368;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  font: 700 12px/1 system-ui, sans-serif;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
}
.nmap-clear-btn[hidden] { display: none; }

.nmap-results {
  pointer-events: auto;
  background: #ffffff;
  border-radius: 14px;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.22);
  overflow: hidden;
  max-height: 150px;
  overflow-y: auto;
}
.nmap-results[hidden] { display: none; }
.nmap-result-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  border: none;
  border-bottom: 1px solid #f1f3f4;
  background: #ffffff;
  color: #202124;
  text-align: left;
  padding: 8px 11px;
  font: 500 12px/1.2 system-ui, sans-serif;
  cursor: pointer;
}
.nmap-result-row:last-child { border-bottom: none; }
.nmap-result-row:hover { background: #f1f5fb; }
.nmap-result-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  flex-shrink: 0;
}
.nmap-result-sub {
  margin-left: auto;
  font: 400 10px/1 system-ui, sans-serif;
  color: #70757a;
}

.nmap-chips {
  pointer-events: auto;
  display: flex;
  gap: 5px;
  overflow-x: auto;
  scrollbar-width: none;
  padding-bottom: 2px;
}
.nmap-chips::-webkit-scrollbar { display: none; }
.nmap-chip {
  border: none;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.96);
  color: #3c4043;
  font: 600 11px/1 system-ui, sans-serif;
  padding: 6px 10px;
  white-space: nowrap;
  cursor: pointer;
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.16);
  flex: 0 0 auto;
}
.nmap-chip.is-active {
  background: #1a73e8;
  color: #ffffff;
}

/* Floating bottom sheet */
.nmap-sheet {
  position: absolute;
  left: 8px;
  right: 8px;
  bottom: 8px;
  z-index: 4;
  background: #ffffff;
  color: #202124;
  border-radius: 16px;
  padding: 9px 11px 10px;
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.24);
  display: flex;
  flex-direction: column;
  gap: 7px;
}
.nmap-sheet-handle {
  align-self: center;
  width: 28px;
  height: 3px;
  border-radius: 999px;
  background: #dadce0;
  margin-bottom: -2px;
}
.nmap-place-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.nmap-place-title {
  margin: 0;
  font: 700 13.5px/1.2 system-ui, sans-serif;
  color: #202124;
}
.nmap-place-sub {
  margin: 2px 0 0;
  font: 500 11px/1.2 system-ui, sans-serif;
  color: #5f6368;
}
.nmap-route-meta {
  font: 600 11.5px/1.2 system-ui, sans-serif;
  color: #188038;
}
.nmap-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}
.nmap-btn-primary {
  flex: 1 1 auto;
  border: none;
  border-radius: 999px;
  background: #1a73e8;
  color: #ffffff;
  font: 600 12px/1 system-ui, sans-serif;
  padding: 8px 12px;
  cursor: pointer;
}
.nmap-btn-primary:hover { background: #1967d2; }
.nmap-btn-stop {
  flex: 1 1 auto;
  border: none;
  border-radius: 999px;
  background: #fce8e6;
  color: #c5221f;
  font: 600 12px/1 system-ui, sans-serif;
  padding: 8px 12px;
  cursor: pointer;
}
.nmap-btn-stop:hover { background: #fad2cf; }
.nmap-btn-ghost {
  border: 1px solid #dadce0;
  border-radius: 999px;
  background: #ffffff;
  color: #3c4043;
  font: 600 11px/1 system-ui, sans-serif;
  padding: 8px 10px;
  cursor: pointer;
}
.nmap-quick-places {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  scrollbar-width: none;
}
.nmap-quick-places::-webkit-scrollbar { display: none; }
.nmap-quick-card {
  border: 1px solid #e8eaed;
  border-radius: 12px;
  background: #f8f9fa;
  color: #202124;
  padding: 6px 9px;
  font: 600 11px/1.2 system-ui, sans-serif;
  white-space: nowrap;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  flex: 0 0 auto;
}
.nmap-quick-card:hover { background: #e8f0fe; border-color: #c6dafc; color: #1967d2; }
.nmap-sr-select {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}
`;

function ensureStyles() {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

function estimateWalkText(routeLabel) {
  if (!routeLabel) return '';
  if (routeLabel.startsWith('Arrived')) return 'Arrived at destination';
  const m = routeLabel.match(/(\d+)\s*m/);
  if (!m) return routeLabel;
  const metres = Number(m[1]);
  const mins = Math.max(1, Math.round(metres / 80));
  return `${mins} min walk (${metres} m)`;
}

export function renderMapApp(screen, ctx = {}) {
  if (!screen) return null;
  ensureStyles();

  const destinations = typeof ctx.getDestinations === 'function' ? (ctx.getDestinations() || []) : [];
  let activeCat = 'all';
  let query = '';
  let routeLabel = '';
  const initialId = typeof ctx.getWaypointId === 'function' ? ctx.getWaypointId() : '';
  let selectedId = initialId || '';

  const root = document.createElement('div');
  root.className = 'nmap-root';

  // Visually-hidden select for accessibility & legacy destination selection hooks.
  const srSelect = document.createElement('select');
  srSelect.className = 'phone-map-destination nmap-sr-select';
  srSelect.setAttribute('aria-label', 'Map destination');
  for (const { id, name } of [{ id: '', name: 'Choose a destination' }, ...destinations]) {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = name;
    srSelect.appendChild(opt);
  }
  srSelect.value = initialId || '';
  srSelect.addEventListener('change', () => {
    const found = destinations.find((d) => d.id === srSelect.value) || null;
    selectedId = found ? found.id : '';
    ctx.setWaypoint?.(found);
    renderSheet();
  });

  // Full-bleed daylight map surface
  const mapWrap = document.createElement('div');
  mapWrap.className = 'phone-map nmap-canvas-wrap';

  // Floating top search & category chips
  const topOverlay = document.createElement('div');
  topOverlay.className = 'nmap-top-overlay';

  const searchPill = document.createElement('div');
  searchPill.className = 'nmap-search-pill';
  const searchIcon = document.createElement('span');
  searchIcon.className = 'nmap-search-icon';
  searchIcon.textContent = '🔍';
  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.className = 'nmap-search-input';
  searchInput.placeholder = 'Search Maple Lane…';
  searchInput.setAttribute('aria-label', 'Search Maple Lane places');
  searchInput.addEventListener('keydown', (e) => e.stopPropagation());
  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.className = 'nmap-clear-btn';
  clearBtn.textContent = '×';
  clearBtn.setAttribute('aria-label', 'Clear search');
  clearBtn.hidden = true;
  searchPill.append(searchIcon, searchInput, clearBtn);

  const resultsBox = document.createElement('div');
  resultsBox.className = 'nmap-results';
  resultsBox.hidden = true;

  const chipsRow = document.createElement('div');
  chipsRow.className = 'nmap-chips';
  const chipEls = [];
  for (const cat of CATEGORIES) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'nmap-chip' + (cat.id === activeCat ? ' is-active' : '');
    btn.textContent = cat.label;
    btn.addEventListener('click', () => {
      activeCat = cat.id;
      for (const el of chipEls) el.classList.toggle('is-active', el.dataset.cat === activeCat);
      renderSheet();
      renderResults();
    });
    btn.dataset.cat = cat.id;
    chipEls.push(btn);
    chipsRow.appendChild(btn);
  }
  topOverlay.append(searchPill, resultsBox, chipsRow);

  // Floating bottom place & directions sheet
  const sheet = document.createElement('div');
  sheet.className = 'nmap-sheet';

  function filteredDestinations() {
    const q = query.trim().toLowerCase();
    return destinations.filter((d) => {
      const cat = categoryOf(d);
      if (activeCat !== 'all' && cat.key !== activeCat) return false;
      if (q && !String(d.name || '').toLowerCase().includes(q)) return false;
      return true;
    });
  }

  function selectPlace(dest, startNav = false) {
    selectedId = dest ? dest.id : '';
    resultsBox.hidden = true;
    if (startNav) {
      srSelect.value = selectedId;
      ctx.setWaypoint?.(dest || null);
    }
    renderSheet();
  }

  function renderResults() {
    const q = query.trim();
    clearBtn.hidden = !q;
    if (!q) {
      resultsBox.hidden = true;
      return;
    }
    const matches = filteredDestinations();
    resultsBox.innerHTML = '';
    if (!matches.length) {
      const empty = document.createElement('div');
      empty.className = 'nmap-result-row';
      empty.textContent = 'No places found';
      resultsBox.appendChild(empty);
    } else {
      for (const d of matches) {
        const cat = categoryOf(d);
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'nmap-result-row';
        const dot = document.createElement('span');
        dot.className = 'nmap-result-dot';
        dot.style.background = cat.color;
        const lbl = document.createElement('span');
        lbl.textContent = d.name;
        const sub = document.createElement('span');
        sub.className = 'nmap-result-sub';
        sub.textContent = cat.label;
        row.append(dot, lbl, sub);
        row.addEventListener('click', () => {
          searchInput.value = d.name;
          query = d.name;
          selectPlace(d, true);
        });
        resultsBox.appendChild(row);
      }
    }
    resultsBox.hidden = false;
  }

  function renderSheet() {
    sheet.innerHTML = '';
    const handle = document.createElement('div');
    handle.className = 'nmap-sheet-handle';
    sheet.appendChild(handle);

    const activeWaypointId = typeof ctx.getWaypointId === 'function' ? ctx.getWaypointId() : '';
    const chosen = destinations.find((d) => d.id === selectedId)
      || destinations.find((d) => d.id === activeWaypointId)
      || null;
    const isNavigating = !!(chosen && activeWaypointId && chosen.id === activeWaypointId);

    if (chosen) {
      const cat = categoryOf(chosen);
      const head = document.createElement('div');
      head.className = 'nmap-place-head';
      const info = document.createElement('div');
      const title = document.createElement('p');
      title.className = 'nmap-place-title';
      title.textContent = chosen.name;
      const sub = document.createElement('p');
      sub.className = 'nmap-place-sub';
      sub.textContent = cat.label;
      info.append(title, sub);
      head.appendChild(info);

      if (isNavigating && routeLabel) {
        const meta = document.createElement('span');
        meta.className = 'nmap-route-meta phone-route-status';
        meta.textContent = estimateWalkText(routeLabel);
        head.appendChild(meta);
      }
      sheet.appendChild(head);

      const actions = document.createElement('div');
      actions.className = 'nmap-actions';
      if (isNavigating) {
        const stopBtn = document.createElement('button');
        stopBtn.type = 'button';
        stopBtn.className = 'nmap-btn-stop';
        stopBtn.textContent = 'End Directions';
        stopBtn.addEventListener('click', () => {
          selectedId = '';
          srSelect.value = '';
          ctx.setWaypoint?.(null);
          renderSheet();
        });
        actions.appendChild(stopBtn);
      } else {
        const goBtn = document.createElement('button');
        goBtn.type = 'button';
        goBtn.className = 'nmap-btn-primary';
        goBtn.textContent = 'Directions';
        goBtn.addEventListener('click', () => selectPlace(chosen, true));
        const dismissBtn = document.createElement('button');
        dismissBtn.type = 'button';
        dismissBtn.className = 'nmap-btn-ghost';
        dismissBtn.textContent = 'Browse';
        dismissBtn.addEventListener('click', () => {
          selectedId = '';
          renderSheet();
        });
        actions.append(goBtn, dismissBtn);
      }
      sheet.appendChild(actions);
      return;
    }

    // Browse mode: quick-pick horizontal strip
    const list = filteredDestinations();
    const strip = document.createElement('div');
    strip.className = 'nmap-quick-places';
    for (const d of list) {
      const cat = categoryOf(d);
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'nmap-quick-card';
      const dot = document.createElement('span');
      dot.className = 'nmap-result-dot';
      dot.style.background = cat.color;
      const lbl = document.createElement('span');
      lbl.textContent = d.name;
      card.append(dot, lbl);
      card.addEventListener('click', () => selectPlace(d, true));
      strip.appendChild(card);
    }
    sheet.appendChild(strip);
  }

  searchInput.addEventListener('input', () => {
    query = searchInput.value;
    renderResults();
    renderSheet();
  });
  clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    query = '';
    resultsBox.hidden = true;
    clearBtn.hidden = true;
    renderSheet();
  });

  root.append(srSelect, mapWrap, topOverlay, sheet);
  screen.appendChild(root);
  renderSheet();

  if (ctx && typeof ctx.attachMap === 'function') {
    return ctx.attachMap(
      mapWrap,
      (label) => {
        if (routeLabel !== label) {
          routeLabel = label || '';
          renderSheet();
        }
      },
      (pinId) => {
        const found = destinations.find((d) => d.id === pinId);
        if (found) selectPlace(found, false);
      }
    );
  }
  return null;
}

export default renderMapApp;
