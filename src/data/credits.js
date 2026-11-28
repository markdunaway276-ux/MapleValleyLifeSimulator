/**
 * Credits for the title screen. Asset credits come from CREDITS.md (the one
 * place CC-BY credits are kept), parsed into simple sections here.
 */

export const CREDITS_URL = new URL('../../CREDITS.md', import.meta.url);

export const BUILT_WITH = [
  { text: 'Three.js — 3D engine (MIT License)', href: 'https://threejs.org/' }
];

/**
 * Parse the small subset of Markdown CREDITS.md uses into
 * [{ title, paragraphs: [[{ text, href? }, ...], ...] }].
 */
export function parseCreditsMarkdown(md) {
  const sections = [];
  let current = null;
  const blocks = String(md || '').replace(/\r/g, '').split(/\n\s*\n/);
  for (const raw of blocks) {
    for (const line of raw.split('\n')) {
      const h = /^(#{1,3})\s+(.*)$/.exec(line.trim());
      if (h) {
        if (h[1].length === 1) continue; // page title
        current = { title: h[2].trim(), paragraphs: [] };
        sections.push(current);
      }
    }
    const body = raw.split('\n').filter((l) => !/^#{1,3}\s/.test(l.trim())).join(' ').trim();
    if (!body) continue;
    if (!current) { current = { title: '', paragraphs: [] }; sections.push(current); }
    current.paragraphs.push(parseInline(body));
  }
  return sections;
}

function parseInline(text) {
  const parts = [];
  const re = /\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let m;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push({ text: text.slice(last, m.index) });
    parts.push({ text: m[1], href: m[2] });
    last = re.lastIndex;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts.map((p) => ({ ...p, text: p.text.replace(/\*\*/g, '') }));
}

export async function loadCredits(fetchFn = globalThis.fetch) {
  try {
    const res = await fetchFn(CREDITS_URL);
    if (!res.ok) throw new Error(String(res.status));
    return parseCreditsMarkdown(await res.text());
  } catch {
    return null;
  }
}
