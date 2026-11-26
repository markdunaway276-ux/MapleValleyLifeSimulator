/**
 * Saves F9 feedback snapshots into the game's `feedback` folder.
 *
 * Only works when the game runs from play.bat, whose local server
 * (tools/dev-server.py) accepts POST /__feedback and writes the PNG plus an
 * entry in feedback/feedback-list.md. Anywhere else (GitHub Pages, a plain
 * `python -m http.server`) the ping fails and upload() returns null, so the
 * markup dialog downloads the PNG as before.
 */
function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error || new Error('read failed'));
    r.readAsDataURL(blob);
  });
}

export function createFeedbackUploader({ getInfo = () => ({}), fetchFn } = {}) {
  const doFetch = fetchFn || (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
  let available = null; // null = not checked yet

  async function check() {
    if (!doFetch) return (available = false);
    try {
      const res = await doFetch('/__feedback/ping', { cache: 'no-store' });
      const json = res.ok ? await res.json() : null;
      available = !!(json && json.ok);
    } catch {
      available = false;
    }
    return available;
  }

  async function upload(blob, { note = '', marked = false } = {}) {
    if (available === null) await check();
    if (!available) return null;
    const png = await blobToDataURL(blob);
    let info = {};
    try { info = getInfo() || {}; } catch { info = {}; }
    const res = await doFetch('/__feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ png, note, info: { ...info, marked } })
    });
    const json = await res.json().catch(() => null);
    if (!json || !json.ok) throw new Error((json && json.error) || 'HTTP ' + res.status);
    return { file: json.file, n: json.n };
  }

  return { check, upload, isAvailable: () => available };
}
