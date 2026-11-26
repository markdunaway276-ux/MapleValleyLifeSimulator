// Run from the repo root with: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGithubFeedback, feedbackEntry, LIST_FILE } from '../src/systems/githubFeedback.js';

function fakeGithub({ listExists = true, push = true } = {}) {
  const files = new Map();
  if (listExists) files.set(LIST_FILE, { text: '# Maple Valley feedback\n\n## #1 · old · a.png\n- Note: old\n', sha: 's1' });
  const calls = [];
  const fetchFn = async (url, init = {}) => {
    calls.push({ url, init });
    const json = (o, status = 200) => ({ ok: status < 300, status, json: async () => o });
    if (url.endsWith('/repos/me/game')) return json({ permissions: { push } });
    const m = url.match(/contents\/(.+?)(\?|$)/);
    const path = m ? decodeURIComponent(m[1]) : '';
    if (!init.method) {
      const f = files.get(path);
      return f ? json({ content: Buffer.from(f.text).toString('base64'), sha: f.sha }) : json({ message: 'Not Found' }, 404);
    }
    const body = JSON.parse(init.body);
    files.set(path, { text: Buffer.from(body.content, 'base64').toString('utf8'), sha: 'new', bin: body.content, sha_in: body.sha });
    return json({ content: { path } }, 201);
  };
  return { files, calls, fetchFn };
}

const config = { token: 't', repo: 'me/game', branch: 'main' };

test('upload puts the PNG and appends a numbered entry to the list', async () => {
  const gh = fakeGithub();
  const fb = createGithubFeedback({ getConfig: () => config, fetchFn: gh.fetchFn });
  const png = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3])], { type: 'image/png' });
  const r = await fb.upload(png, { note: 'Sam looks angry', marked: true, info: { where: 'outside', clock: 'Day 1 14:00' } });
  assert.equal(r.n, 2);
  assert.match(r.file, /^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.png$/);
  const pic = gh.files.get('feedback/' + r.file);
  assert.deepEqual([...Buffer.from(pic.bin, 'base64')].slice(0, 4), [0x89, 0x50, 0x4e, 0x47]);
  const list = gh.files.get(LIST_FILE);
  assert.match(list.text, /## #2 · .* · .*\.png\n- Note: Sam looks angry\n- Where: outside\n- Game time: Day 1 14:00\n- Marked: yes/);
  assert.equal(list.sha_in, 's1');
  assert.ok(gh.calls.every((c) => c.init.headers.Authorization === 'Bearer t'));
});

test('upload starts the list when it does not exist yet', async () => {
  const gh = fakeGithub({ listExists: false });
  const fb = createGithubFeedback({ getConfig: () => config, fetchFn: gh.fetchFn });
  const r = await fb.upload(new Blob([new Uint8Array([1])]), { note: '' });
  assert.equal(r.n, 1);
  assert.match(gh.files.get(LIST_FILE).text, /^# Maple Valley feedback[\s\S]*## #1 [\s\S]*- Note: \(no note\)/);
});

test('not set up: upload returns null so the PNG downloads instead', async () => {
  const fb = createGithubFeedback({ getConfig: () => null, fetchFn: async () => { throw new Error('should not fetch'); } });
  assert.equal(await fb.upload(new Blob([new Uint8Array([1])])), null);
});

test('test() reports a read-only token', async () => {
  const gh = fakeGithub({ push: false });
  const r = await createGithubFeedback({ getConfig: () => config, fetchFn: gh.fetchFn }).test();
  assert.equal(r.ok, false);
  assert.match(r.message, /Read and write/);
});

test('entry format matches the play.bat server', () => {
  const e = feedbackEntry(3, new Date(2026, 10, 26, 10, 34), 'x.png', 'line one\nline two', { doing: 'walking', device: 'desktop' });
  assert.match(e, /^\n## #3 · Nov 26, 2026, 10:34 AM · x\.png\n- Note: line one\n  line two\n- Doing: walking\n- Device: desktop\n- Status: open\n$/);
});
