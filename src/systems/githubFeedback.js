/**
 * Uploads F9 / camera-button feedback straight to the game's GitHub repo, in
 * the same format play.bat's local server uses (tools/dev-server.py):
 *
 *   feedback/<date>_<time>.png   the marked-up screenshot (with the note band)
 *   feedback/feedback-list.md    one numbered entry per snapshot
 *
 * so ChatGPT (with its GitHub connector), Claude or anyone with the repo can
 * read them. It needs a fine-grained GitHub token that the player creates
 * (Contents: read and write, this repository only) and pastes into
 * Settings > Feedback. The token stays in this browser's localStorage on this
 * device only; it is never part of the game or the repo.
 */

export const GH_FEEDBACK_KEY = 'mapleValleyLife_githubFeedback';
export const DEFAULT_REPO = 'markdunaway276-ux/MapleValleyLifeSimulator';
export const FEEDBACK_DIR = 'feedback';
export const LIST_FILE = FEEDBACK_DIR + '/feedback-list.md';
const LIST_HEADER = '# Maple Valley feedback\n\n'
  + 'Made with F9 (or the camera button) in the game. Each entry has its picture in this folder.\n'
  + 'Status: open = still to fix, fixed = done.\n';

function storage() {
  try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; }
}

export function readGithubFeedbackConfig(ls = storage()) {
  try {
    const raw = ls && ls.getItem(GH_FEEDBACK_KEY);
    const c = raw ? JSON.parse(raw) : null;
    if (!c || typeof c.token !== 'string' || !c.token.trim()) return null;
    return { token: c.token.trim(), repo: c.repo || DEFAULT_REPO, branch: c.branch || 'main' };
  } catch {
    return null;
  }
}

export function writeGithubFeedbackConfig(config, ls = storage()) {
  try {
    if (!ls) return false;
    if (!config || !config.token) { ls.removeItem(GH_FEEDBACK_KEY); return true; }
    ls.setItem(GH_FEEDBACK_KEY, JSON.stringify({ token: config.token.trim(), repo: config.repo || DEFAULT_REPO, branch: config.branch || 'main' }));
    return true;
  } catch {
    return false;
  }
}

const clean = (v, limit) => String(v == null ? '' : v).replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '').slice(0, limit);

function b64FromBytes(bytes) {
  let s = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) s += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  return btoa(s);
}
const b64FromText = (text) => b64FromBytes(new TextEncoder().encode(text));
const textFromB64 = (b64) => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, '')), (c) => c.charCodeAt(0)));

function stampFor(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
}

/** One feedback-list.md entry, matching tools/dev-server.py. */
export function feedbackEntry(n, when, file, note, info = {}) {
  const text = clean(note, 2000).trim().replace(/\r\n/g, '\n').replace(/\n/g, '\n  ');
  const whenText = when.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  let entry = `\n## #${n} · ${whenText} · ${file}\n- Note: ${text || '(no note)'}\n`;
  for (const [label, key] of [['Where', 'where'], ['Doing', 'doing'], ['Spot', 'spot'], ['Game time', 'clock'], ['Weather', 'weather'], ['Device', 'device']]) {
    const v = clean(info[key], 160).trim();
    if (v) entry += `- ${label}: ${v}\n`;
  }
  if (info.marked) entry += '- Marked: yes (drawn on the picture)\n';
  entry += '- Status: open\n';
  return entry;
}

export function createGithubFeedback({ getConfig = readGithubFeedbackConfig, fetchFn } = {}) {
  const doFetch = fetchFn || (typeof fetch === 'function' ? fetch.bind(globalThis) : null);

  async function api(config, path, init = {}) {
    const res = await doFetch(`https://api.github.com/repos/${config.repo}${path ? '/' + path : ''}`, {
      ...init,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${config.token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(init.body ? { 'Content-Type': 'application/json' } : {})
      }
    });
    const json = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, json };
  }

  /** Checks the token can read and write this repo's files. */
  async function test(config = getConfig()) {
    if (!config || !doFetch) return { ok: false, message: 'No token saved.' };
    const r = await api(config, '');
    if (!r.ok) return { ok: false, message: r.status === 401 ? 'GitHub did not accept that token.' : `Could not reach the repo (${r.status}).` };
    const push = r.json && r.json.permissions ? r.json.permissions.push : null;
    if (push === false) return { ok: false, message: 'That token can read the repo but not write to it. Give it Contents: Read and write.' };
    return { ok: true, message: `Connected to ${config.repo}.` };
  }

  async function putFile(config, path, base64, message, sha) {
    return api(config, 'contents/' + path.split('/').map(encodeURIComponent).join('/'), {
      method: 'PUT',
      body: JSON.stringify({ message, content: base64, branch: config.branch, ...(sha ? { sha } : {}) })
    });
  }

  /** Same contract as feedbackUpload.upload(): resolves { file, n } or null if not set up. */
  async function upload(blob, { note = '', marked = false, info = {} } = {}) {
    const config = getConfig();
    if (!config || !doFetch) return null;
    const now = new Date();
    const file = stampFor(now) + '.png';
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const short = clean(note, 60).trim().replace(/\s+/g, ' ');

    const pic = await putFile(config, `${FEEDBACK_DIR}/${file}`, b64FromBytes(bytes), `Feedback screenshot ${file}${short ? ': ' + short : ''}`);
    if (!pic.ok) throw new Error(pic.status === 401 ? 'GitHub token not accepted' : 'GitHub upload failed (' + pic.status + ')');

    // Append to the list; retry once if someone else changed it in between.
    for (let attempt = 0; attempt < 2; attempt++) {
      const cur = await api(config, `contents/${LIST_FILE}?ref=${encodeURIComponent(config.branch)}`);
      const listing = cur.ok && cur.json && cur.json.content ? textFromB64(cur.json.content) : LIST_HEADER;
      const n = (listing.match(/^## #\d+/gm) || []).length + 1;
      const next = listing + feedbackEntry(n, now, file, note, { ...info, marked });
      const put = await putFile(config, LIST_FILE, b64FromText(next), `Feedback #${n}${short ? ': ' + short : ''}`, cur.ok && cur.json ? cur.json.sha : undefined);
      if (put.ok) return { file, n };
      if (put.status !== 409 && put.status !== 422) break;
    }
    // The picture is up even if the list entry failed.
    return { file, n: 0 };
  }

  return { test, upload, isConfigured: () => !!getConfig() };
}
