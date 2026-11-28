import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CHANGELOG, LATEST_VERSION, compareVersions, hasUnseenUpdate, markUpdatesSeen, readSeenVersion, formatNoteDate
} from '../src/data/changelog.js';
import { parseCreditsMarkdown } from '../src/data/credits.js';

test('changelog is newest first with unique, rising versions', () => {
  assert.ok(CHANGELOG.length > 0);
  assert.equal(LATEST_VERSION, CHANGELOG[0].version);
  for (let i = 1; i < CHANGELOG.length; i++) {
    assert.equal(compareVersions(CHANGELOG[i - 1].version, CHANGELOG[i].version), 1, CHANGELOG[i].version);
  }
  for (const e of CHANGELOG) {
    assert.match(e.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(e.title && Array.isArray(e.notes) && e.notes.length > 0);
  }
});

test('version compare handles double digits', () => {
  assert.equal(compareVersions('0.10', '0.9'), 1);
  assert.equal(compareVersions('1.0', '1'), 0);
  assert.equal(compareVersions('0.3', '0.4'), -1);
});

test('NEW badge shows until the latest notes are read', () => {
  const store = new Map();
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  assert.equal(hasUnseenUpdate(readSeenVersion(storage)), true);
  markUpdatesSeen(storage);
  assert.equal(hasUnseenUpdate(readSeenVersion(storage)), false);
  assert.equal(hasUnseenUpdate('0.1', '0.2'), true);
});

test('note dates format without timezone shifts', () => {
  assert.equal(formatNoteDate('2026-11-27'), 'Nov 27, 2026');
});

test('CREDITS.md parses into titled sections with links', () => {
  const sections = parseCreditsMarkdown(readFileSync(new URL('../CREDITS.md', import.meta.url), 'utf8'));
  assert.ok(sections.length >= 2);
  const music = sections.find((s) => /music/i.test(s.title));
  assert.ok(music, 'music section');
  const links = music.paragraphs.flat().filter((p) => p.href);
  assert.ok(links.some((l) => /incompetech/.test(l.href)));
  assert.ok(links.some((l) => /creativecommons/.test(l.href)));
  for (const s of sections) assert.ok(s.paragraphs.length > 0, s.title);
});
