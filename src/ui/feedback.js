/**
 * Screenshot markup ("feedback") dialog. Optional debug tool, built lazily the
 * first time a screenshot is taken. Nothing here runs during normal play.
 *
 * Flow: debug.screenshot() (HUD camera button, F9, or Debug menu) snapshots the
 * 3D canvas, opens this dialog, the user draws on it (pen, line, arrow, double
 * arrow, box, circle, X, green check, question mark, numbered pin; a few colours),
 * types an optional note and saves a PNG = marked screenshot + gold divider +
 * caption band (note + meta). Pointer events + touch-action:none so it works
 * with mouse, pen and touch. The toolbar wraps (and can scroll) on a phone.
 */

export const NOTE_MAX = 2000;
export const MAX_SIDE = 2560;
export const MARK_COLOR = '#ff3b30';
export const DIVIDER_COLOR = '#d4a72c';

export const TOOLS = [
  { id: 'pen', label: 'Pen' },
  { id: 'line', label: 'Line' },
  { id: 'arrow', label: 'Arrow' },
  { id: 'darrow', label: '2-Arrow' },
  { id: 'box', label: 'Box' },
  { id: 'circle', label: 'Circle' },
  { id: 'x', label: 'X' },
  { id: 'check', label: 'Check' },
  { id: 'question', label: '?' },
  { id: 'pin', label: 'Pin' }
];

export const COLORS = [
  { id: 'red', value: '#ff3b30' },
  { id: 'gold', value: '#ffcc00' },
  { id: 'green', value: '#22c55e' },
  { id: 'blue', value: '#3b82f6' },
  { id: 'white', value: '#ffffff' }
];

export const CHECK_COLOR = '#22c55e';

export function colorForOp(op) {
  if (op && op.color) return op.color;
  if (op && op.tool === 'check') return CHECK_COLOR;
  return MARK_COLOR;
}

/** Stamp tools are placed with a tap; the rest are dragged. */
export const STAMP_TOOLS = ['x', 'pin', 'check', 'question'];

const STYLE_ID = 'debug-feedback-styles';

const CSS = `
#debug-feedback {
  position: fixed; inset: 0; z-index: 70; display: none; flex-direction: column;
  background: #0d0d0d; color: #fff; font: 14px system-ui, sans-serif;
  touch-action: none; -webkit-user-select: none; user-select: none;
}
#debug-feedback.is-open { display: flex; }
#debug-feedback .fb-toolbar {
  display: flex; flex-wrap: wrap; gap: 6px; padding: 8px; background: #1a1a1a;
  border-bottom: 1px solid #333; overflow-x: auto; align-items: center;
}
#debug-feedback button {
  margin: 0; min-height: 44px; min-width: 44px; padding: 8px 10px; font: 600 14px system-ui, sans-serif;
  color: #fff; background: #2b2b2b; border: 1px solid #555; border-radius: 8px; cursor: pointer;
  touch-action: manipulation; -webkit-tap-highlight-color: transparent;
}
#debug-feedback button[aria-pressed="true"] { background: #b3261e; border-color: #ff6b61; }
#debug-feedback button.fb-primary { background: #1f6f3a; border-color: #3fbf6a; }
#debug-feedback button:disabled { opacity: 0.45; }
#debug-feedback .fb-spacer { flex: 1 1 auto; min-width: 8px; }
#debug-feedback .fb-colors { display: flex; gap: 6px; align-items: center; flex: 0 0 auto; }
#debug-feedback button.fb-color {
  width: 44px; min-width: 44px; padding: 0; background: var(--swatch); border-width: 2px;
}
#debug-feedback button.fb-color[aria-pressed="true"] {
  background: var(--swatch); border-color: #fff; box-shadow: 0 0 0 2px #111, 0 0 0 4px #fff;
}
#debug-feedback .fb-stage {
  flex: 1 1 auto; min-height: 0; display: flex; align-items: center; justify-content: center;
  overflow: hidden; padding: 6px;
}
#debug-feedback canvas { display: block; touch-action: none; cursor: crosshair; background: #000; }
#debug-feedback .fb-footer { padding: 8px; background: #1a1a1a; border-top: 1px solid #333; }
#debug-feedback textarea {
  box-sizing: border-box; width: 100%; height: 56px; resize: none; padding: 8px; font: 16px system-ui, sans-serif;
  color: #fff; background: #111; border: 1px solid #555; border-radius: 8px;
  -webkit-user-select: text; user-select: text; touch-action: auto;
}
#debug-feedback .fb-row { display: flex; gap: 8px; align-items: center; margin-top: 8px; flex-wrap: wrap; }
#debug-feedback .fb-status { color: #bbb; font-size: 13px; flex: 1 1 120px; min-width: 0; }
`;

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

export function makeFilename(date = new Date()) {
  const d = `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  const t = `${pad2(date.getHours())}-${pad2(date.getMinutes())}-${pad2(date.getSeconds())}`;
  return `maplevalley-${d}_${t}.png`;
}

function newCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

/** Copy a source (canvas / image) into a fresh canvas, capped to MAX_SIDE. Call right after render. */
export function snapshotCanvas(source, maxSide = MAX_SIDE) {
  const sw = source.width || source.naturalWidth || 1;
  const sh = source.height || source.naturalHeight || 1;
  const k = Math.min(1, maxSide / Math.max(sw, sh));
  const out = newCanvas(sw * k, sh * k);
  const ctx = out.getContext('2d');
  ctx.drawImage(source, 0, 0, out.width, out.height);
  return out;
}

export function markUnit(width) {
  return Math.max(3, Math.round(width / 300));
}

function strokeShaft(ctx, ax, ay, bx, by) {
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(bx, by);
  ctx.stroke();
}

function strokeHead(ctx, ax, ay, bx, by, head) {
  const ang = Math.atan2(by - ay, bx - ax);
  ctx.beginPath();
  ctx.moveTo(bx, by);
  ctx.lineTo(bx - head * Math.cos(ang - 0.45), by - head * Math.sin(ang - 0.45));
  ctx.moveTo(bx, by);
  ctx.lineTo(bx - head * Math.cos(ang + 0.45), by - head * Math.sin(ang + 0.45));
  ctx.stroke();
}

export function drawOp(ctx, op, unit) {
  ctx.save();
  const color = colorForOp(op);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = unit;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  switch (op.tool) {
    case 'pen': {
      const pts = op.points;
      if (pts.length === 1) {
        // single tap = small circle
        ctx.beginPath();
        ctx.arc(pts[0][0], pts[0][1], unit * 3, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.stroke();
      }
      break;
    }
    case 'line': {
      strokeShaft(ctx, op.a[0], op.a[1], op.b[0], op.b[1]);
      break;
    }
    case 'arrow': {
      strokeShaft(ctx, op.a[0], op.a[1], op.b[0], op.b[1]);
      strokeHead(ctx, op.a[0], op.a[1], op.b[0], op.b[1], unit * 5);
      break;
    }
    case 'darrow': {
      strokeShaft(ctx, op.a[0], op.a[1], op.b[0], op.b[1]);
      strokeHead(ctx, op.a[0], op.a[1], op.b[0], op.b[1], unit * 5);
      strokeHead(ctx, op.b[0], op.b[1], op.a[0], op.a[1], unit * 5);
      break;
    }
    case 'box': {
      const [ax, ay] = op.a;
      const [bx, by] = op.b;
      ctx.strokeRect(Math.min(ax, bx), Math.min(ay, by), Math.abs(bx - ax), Math.abs(by - ay));
      break;
    }
    case 'circle': {
      const r = Math.hypot(op.b[0] - op.a[0], op.b[1] - op.a[1]);
      ctx.beginPath();
      ctx.arc(op.a[0], op.a[1], r, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case 'x': {
      const [x, y] = op.p;
      const s = unit * 5;
      ctx.beginPath();
      ctx.moveTo(x - s, y - s);
      ctx.lineTo(x + s, y + s);
      ctx.moveTo(x + s, y - s);
      ctx.lineTo(x - s, y + s);
      ctx.stroke();
      break;
    }
    case 'check': {
      const [x, y] = op.p;
      const s = unit * 6;
      ctx.lineWidth = unit * 1.3;
      ctx.beginPath();
      ctx.moveTo(x - s, y + s * 0.05);
      ctx.lineTo(x - s * 0.25, y + s * 0.8);
      ctx.lineTo(x + s, y - s * 0.85);
      ctx.stroke();
      break;
    }
    case 'question': {
      const [x, y] = op.p;
      const s = unit * 9;
      ctx.font = `700 ${Math.round(s)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = Math.max(2, unit / 2);
      ctx.strokeStyle = color === '#ffffff' ? '#111111' : '#ffffff';
      ctx.strokeText('?', x, y);
      ctx.fillText('?', x, y);
      break;
    }
    case 'pin': {
      const [x, y] = op.p;
      const r = unit * 5;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = Math.max(1, unit / 2);
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = `700 ${Math.round(r * 1.3)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(op.n), x, y + unit * 0.2);
      break;
    }
    default:
      break;
  }
  ctx.restore();
}

export function drawOps(ctx, ops, unit) {
  for (let i = 0; i < ops.length; i++) drawOp(ctx, ops[i], unit);
}

function wrapText(ctx, text, maxWidth) {
  const lines = [];
  for (const para of String(text).split(/\r?\n/)) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) { lines.push(''); continue; }
    let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (line && ctx.measureText(test).width > maxWidth) {
        lines.push(line);
        line = w;
      } else {
        line = test;
      }
    }
    lines.push(line);
  }
  return lines;
}

/**
 * Compose the final PNG canvas: marked screenshot, gold divider, caption band
 * with the note and meta line(s). Returns a canvas (use canvasToBlob to encode).
 */
export function composeMarkedImage(base, ops = [], { note = '', meta = [] } = {}) {
  const w = base.width || base.naturalWidth;
  const h = base.height || base.naturalHeight;
  const unit = markUnit(w);
  const fs = Math.max(14, Math.round(w / 70));
  const lh = Math.round(fs * 1.35);
  const pad = Math.round(fs * 0.9);
  const divider = Math.max(3, Math.round(fs / 4));

  const measure = newCanvas(8, 8).getContext('2d');
  measure.font = `${fs}px system-ui, sans-serif`;
  const noteText = String(note || '').trim().slice(0, NOTE_MAX);
  const noteLines = noteText ? wrapText(measure, noteText, w - pad * 2) : [];
  const metaText = (meta || []).filter(Boolean).join('   |   ');
  measure.font = `${Math.round(fs * 0.85)}px system-ui, sans-serif`;
  const metaLines = metaText ? wrapText(measure, metaText, w - pad * 2) : [];
  const mlh = Math.round(fs * 1.15);

  const bandH = pad * 2 + noteLines.length * lh + (noteLines.length && metaLines.length ? Math.round(pad / 2) : 0) + metaLines.length * mlh;
  const out = newCanvas(w, h + divider + Math.max(bandH, pad * 2));
  const ctx = out.getContext('2d');
  ctx.drawImage(base, 0, 0, w, h);
  drawOps(ctx, ops, unit);

  ctx.fillStyle = DIVIDER_COLOR;
  ctx.fillRect(0, h, w, divider);
  ctx.fillStyle = '#14110c';
  ctx.fillRect(0, h + divider, w, out.height - h - divider);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  let y = h + divider + pad;
  ctx.fillStyle = '#ffffff';
  ctx.font = `${fs}px system-ui, sans-serif`;
  for (const line of noteLines) { ctx.fillText(line, pad, y); y += lh; }
  if (noteLines.length && metaLines.length) y += Math.round(pad / 2);
  ctx.fillStyle = '#b8b8b8';
  ctx.font = `${Math.round(fs * 0.85)}px system-ui, sans-serif`;
  for (const line of metaLines) { ctx.fillText(line, pad, y); y += mlh; }
  return out;
}

export function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    if (typeof canvas.toBlob === 'function') {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png');
      return;
    }
    try {
      const url = canvas.toDataURL('image/png');
      const bin = atob(url.split(',')[1]);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      resolve(new Blob([bytes], { type: 'image/png' }));
    } catch (e) {
      reject(e);
    }
  });
}

export function isIOSDevice() {
  const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
  const touchMac = typeof navigator !== 'undefined' && navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return /iPhone|iPad|iPod/i.test(ua) || touchMac;
}

export function canShareFile(file) {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
}

/**
 * Hand the PNG to the user. Default: <a download>. iOS Safari often ignores
 * downloads, so there we prefer the share sheet, then fall back to opening the
 * image in a tab so it can be long-pressed and saved.
 */
export async function deliverBlob(blob, filename, { preferShare = false } = {}) {
  const file = typeof File === 'function' ? new File([blob], filename, { type: 'image/png' }) : null;
  const ios = isIOSDevice();
  if (file && (preferShare || ios) && canShareFile(file)) {
    try {
      await navigator.share({ files: [file], title: filename });
      return { method: 'share', filename };
    } catch (e) {
      if (e && e.name === 'AbortError') return { method: 'cancelled', filename };
      // fall through to download
    }
  }
  const url = URL.createObjectURL(blob);
  if (ios) {
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return { method: 'open', filename };
  }
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return { method: 'download', filename };
}

export function createFeedback({
  getMeta = () => [],
  onOpen = () => {},
  onClose = () => {},
  onSaved = () => {},
  container = document.body
} = {}) {
  let root = null;
  let canvas = null;
  let ctx = null;
  let stage = null;
  let noteEl = null;
  let statusEl = null;
  let saveBtn = null;
  let shareBtn = null;
  let toolButtons = [];
  let base = null;
  let ops = [];
  let current = null;
  let tool = 'pen';
  let color = MARK_COLOR;
  let opened = false;
  let unit = 3;
  let busy = false;
  let colorButtons = [];

  function build() {
    if (root) return;
    ensureStyles();
    root = document.createElement('div');
    root.id = 'debug-feedback';
    root.className = 'debug-ui';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-label', 'Screenshot markup');
    root.setAttribute('aria-hidden', 'true');

    const toolbar = document.createElement('div');
    toolbar.className = 'fb-toolbar';
    toolButtons = TOOLS.map((t) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = t.label;
      b.dataset.tool = t.id;
      b.setAttribute('aria-pressed', t.id === tool ? 'true' : 'false');
      b.addEventListener('click', () => setTool(t.id));
      toolbar.appendChild(b);
      return b;
    });
    const colors = document.createElement('span');
    colors.className = 'fb-colors';
    colorButtons = COLORS.map((c) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'fb-color';
      b.dataset.color = c.value;
      b.dataset.colorId = c.id;
      b.style.setProperty('--swatch', c.value);
      b.setAttribute('aria-label', c.id);
      b.setAttribute('aria-pressed', c.value === color ? 'true' : 'false');
      b.title = c.id;
      b.addEventListener('click', () => setColor(c.value));
      colors.appendChild(b);
      return b;
    });
    toolbar.appendChild(colors);
    const spacer = document.createElement('span');
    spacer.className = 'fb-spacer';
    toolbar.appendChild(spacer);
    const undoBtn = document.createElement('button');
    undoBtn.type = 'button';
    undoBtn.textContent = 'Undo';
    undoBtn.dataset.action = 'undo';
    undoBtn.addEventListener('click', undo);
    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.textContent = 'Clear';
    clearBtn.dataset.action = 'clear';
    clearBtn.addEventListener('click', clearMarks);
    toolbar.append(undoBtn, clearBtn);

    stage = document.createElement('div');
    stage.className = 'fb-stage';
    canvas = document.createElement('canvas');
    canvas.className = 'fb-canvas';
    stage.appendChild(canvas);

    const footer = document.createElement('div');
    footer.className = 'fb-footer';
    noteEl = document.createElement('textarea');
    noteEl.placeholder = 'What needs fixing? (optional note)';
    noteEl.maxLength = NOTE_MAX;
    noteEl.setAttribute('aria-label', 'Note');
    const row = document.createElement('div');
    row.className = 'fb-row';
    statusEl = document.createElement('span');
    statusEl.className = 'fb-status';
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.dataset.action = 'cancel';
    cancelBtn.addEventListener('click', () => close());
    shareBtn = document.createElement('button');
    shareBtn.type = 'button';
    shareBtn.textContent = 'Share';
    shareBtn.dataset.action = 'share';
    shareBtn.style.display = 'none';
    shareBtn.addEventListener('click', () => save({ share: true }));
    saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'fb-primary';
    saveBtn.textContent = 'Save PNG';
    saveBtn.dataset.action = 'save';
    saveBtn.addEventListener('click', () => save());
    row.append(statusEl, cancelBtn, shareBtn, saveBtn);
    footer.append(noteEl, row);

    root.append(toolbar, stage, footer);
    container.appendChild(root);

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    root.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
  }

  function setTool(id) {
    tool = id;
    for (const b of toolButtons) b.setAttribute('aria-pressed', b.dataset.tool === id ? 'true' : 'false');
    // Check mark is green in Career Sim; switch the swatch so a tap is green
    // unless the user then picks a different colour.
    if (id === 'check') setColor(CHECK_COLOR);
  }

  function setColor(value) {
    color = value || MARK_COLOR;
    for (const b of colorButtons) b.setAttribute('aria-pressed', b.dataset.color === color ? 'true' : 'false');
  }

  function toCanvasPoint(e) {
    const rect = canvas.getBoundingClientRect();
    const sx = rect.width ? canvas.width / rect.width : 1;
    const sy = rect.height ? canvas.height / rect.height : 1;
    return [(e.clientX - rect.left) * sx, (e.clientY - rect.top) * sy];
  }

  function pinCount() {
    let n = 0;
    for (const o of ops) if (o.tool === 'pin') n++;
    return n;
  }

  function redraw() {
    if (!ctx || !base) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(base, 0, 0);
    drawOps(ctx, ops, unit);
    if (current) drawOp(ctx, current, unit);
  }

  function onDown(e) {
    if (!opened || (e.button !== undefined && e.button > 0)) return;
    e.preventDefault();
    if (canvas.setPointerCapture && e.pointerId !== undefined) {
      try { canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    }
    const p = toCanvasPoint(e);
    if (tool === 'pen') current = { tool: 'pen', points: [p], color };
    else if (tool === 'x') { ops.push({ tool: 'x', p, color }); redraw(); return; }
    else if (tool === 'check') { ops.push({ tool: 'check', p, color }); redraw(); return; }
    else if (tool === 'question') { ops.push({ tool: 'question', p, color }); redraw(); return; }
    else if (tool === 'pin') { ops.push({ tool: 'pin', p, n: pinCount() + 1, color }); redraw(); return; }
    else current = { tool, a: p, b: p, color };
    redraw();
  }

  function onMove(e) {
    if (!current) return;
    e.preventDefault();
    const p = toCanvasPoint(e);
    if (current.tool === 'pen') {
      const last = current.points[current.points.length - 1];
      if (Math.hypot(p[0] - last[0], p[1] - last[1]) >= unit * 0.5) current.points.push(p);
    } else {
      current.b = p;
    }
    redraw();
  }

  function onUp(e) {
    if (!current) return;
    if (e && e.preventDefault) e.preventDefault();
    const op = current;
    current = null;
    if (op.tool === 'pen') {
      ops.push(op); // a single point renders as a small circle
    } else if (Math.hypot(op.b[0] - op.a[0], op.b[1] - op.a[1]) >= unit * 2) {
      ops.push(op);
    }
    redraw();
  }

  function undo() {
    ops.pop();
    redraw();
  }

  function clearMarks() {
    ops = [];
    current = null;
    redraw();
  }

  function fit() {
    if (!canvas || !base || !stage) return;
    const aw = stage.clientWidth - 12;
    const ah = stage.clientHeight - 12;
    if (aw <= 0 || ah <= 0) return;
    const k = Math.min(aw / base.width, ah / base.height);
    canvas.style.width = Math.floor(base.width * k) + 'px';
    canvas.style.height = Math.floor(base.height * k) + 'px';
  }

  function setStatus(text) {
    if (statusEl) statusEl.textContent = text || '';
  }

  function onKey(e) {
    if (!opened) return;
    if (e.code === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.code === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      e.stopPropagation();
      save();
    }
  }

  function open(source) {
    build();
    base = source;
    ops = [];
    current = null;
    unit = markUnit(base.width);
    canvas.width = base.width;
    canvas.height = base.height;
    ctx = canvas.getContext('2d');
    noteEl.value = '';
    setStatus('');
    busy = false;
    saveBtn.disabled = false;
    shareBtn.style.display = typeof navigator !== 'undefined' && typeof navigator.canShare === 'function' &&
      typeof navigator.share === 'function' ? '' : 'none';
    setColor(MARK_COLOR);
    setTool('pen');
    opened = true;
    root.classList.add('is-open');
    root.setAttribute('aria-hidden', 'false');
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', fit);
    fit();
    redraw();
    onOpen();
  }

  function close() {
    if (!opened) return;
    opened = false;
    current = null;
    root.classList.remove('is-open');
    root.setAttribute('aria-hidden', 'true');
    document.removeEventListener('keydown', onKey, true);
    window.removeEventListener('resize', fit);
    base = null;
    ops = [];
    onClose();
  }

  async function compose() {
    const meta = getMeta() || [];
    return composeMarkedImage(base, ops, { note: noteEl.value, meta });
  }

  async function save({ share = false } = {}) {
    if (!opened || busy) return null;
    busy = true;
    saveBtn.disabled = true;
    setStatus('Saving…');
    try {
      const out = await compose();
      const blob = await canvasToBlob(out);
      const filename = makeFilename(new Date());
      const result = await deliverBlob(blob, filename, { preferShare: share });
      if (result.method === 'cancelled') {
        busy = false;
        saveBtn.disabled = false;
        setStatus('Share cancelled');
        return null;
      }
      const info = { ...result, blob, width: out.width, height: out.height };
      close();
      onSaved(info);
      return info;
    } catch (e) {
      busy = false;
      if (saveBtn) saveBtn.disabled = false;
      setStatus('Save failed: ' + (e && e.message ? e.message : e));
      return null;
    }
  }

  return {
    open,
    close,
    save,
    undo,
    clear: clearMarks,
    setTool,
    setColor,
    compose,
    isOpen: () => opened,
    getOps: () => ops,
    getNote: () => (noteEl ? noteEl.value : ''),
    setNote: (v) => { build(); noteEl.value = v; },
    getColor: () => color,
    getTool: () => tool,
    get element() { return root; },
    get canvas() { return canvas; }
  };
}
