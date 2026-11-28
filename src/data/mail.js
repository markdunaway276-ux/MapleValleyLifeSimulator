/**
 * Data-driven daily mail for the street mailbox. Each new day rolls one
 * outcome from MAIL_TABLE (deterministic for that day). Cash of $5–$15 and
 * short messages are common, a Snack is occasional, and some days there is
 * nothing — except a pity rule so the box is never empty for more than
 * MAIL_PITY_DAYS days in a row.
 *
 * The first-time Letter and the existing money.js cash helpers
 * (mailAmountForDay, queueDailyMail) are unchanged.
 */
import { MAIL_MIN, MAIL_MAX, mailAmountForDay } from '../systems/money.js';

export { MAIL_MIN, MAIL_MAX, mailAmountForDay };

/** Never leave the mailbox empty for more than this many days in a row. */
export const MAIL_PITY_DAYS = 2;

/**
 * Weighted table. Weights are relative; they need not sum to 100.
 * type: 'cash' | 'message' | 'item' | 'none'
 */
export const MAIL_TABLE = [
  { id: 'cash', type: 'cash', weight: 40 },
  { id: 'message', type: 'message', weight: 30 },
  { id: 'snack', type: 'item', itemId: 'snack', weight: 12 },
  { id: 'none', type: 'none', weight: 18 }
];

/** Short notes that can arrive as mail. Picked deterministically by day. */
export const MAIL_MESSAGES = [
  { id: 'welcome', from: 'Maple Valley Post', body: 'Welcome to the neighbourhood. Knock if you need anything.' },
  { id: 'sam', from: 'Sam', body: 'If you are free, come say hi — I am usually on the sidewalk out front.' },
  { id: 'town', from: 'Town Hall', body: 'Rain may move through later this week. Take a jacket if you are out walking.' },
  { id: 'watch', from: 'Neighbourhood Watch', body: 'A quiet night on our street. Thanks for keeping an eye out.' },
  { id: 'market', from: 'Corner Market', body: 'Fresh snacks are in. The sidewalk machine is stocked if you cannot stop by.' },
  { id: 'note', from: 'A neighbour', body: 'Just a note to say you are not alone here. Maple Valley looks after its own.' }
];

export function tableWeight(table = MAIL_TABLE) {
  let total = 0;
  for (let i = 0; i < table.length; i++) total += Math.max(0, Number(table[i].weight) || 0);
  return total;
}

/** Deterministic 32-bit roll for a 1-based day (and an optional salt). */
export function mailRoll(day, salt = 0) {
  const d = Math.max(1, day | 0);
  let x = (Math.imul(d + (salt | 0) * 9973, 1664525) + 1013904223) >>> 0;
  x ^= x << 13; x >>>= 0;
  x ^= x >>> 17;
  x ^= x << 5; x >>>= 0;
  return x;
}

function pickWeighted(table, roll) {
  const list = table && table.length ? table : MAIL_TABLE;
  const total = tableWeight(list);
  if (total <= 0) return list[0] || null;
  let n = roll % total;
  for (let i = 0; i < list.length; i++) {
    const w = Math.max(0, Number(list[i].weight) || 0);
    if (n < w) return list[i];
    n -= w;
  }
  return list[list.length - 1];
}

export function messageForDay(day) {
  const list = MAIL_MESSAGES;
  if (!list.length) return null;
  const i = mailRoll(day, 17) % list.length;
  return list[i];
}

/**
 * Roll the day's outcome (type, and cash amount / message / item).
 * If `emptyStreak` is already MAIL_PITY_DAYS, a 'none' result is replaced
 * with a non-empty row so the box is never empty three days in a row.
 */
export function rollMailForDay(day, emptyStreak = 0) {
  const d = Math.max(1, day | 0);
  let row = pickWeighted(MAIL_TABLE, mailRoll(d, 0));
  if (row && row.type === 'none' && (emptyStreak | 0) >= MAIL_PITY_DAYS) {
    const filled = MAIL_TABLE.filter((r) => r && r.type !== 'none');
    row = pickWeighted(filled, mailRoll(d, 31)) || filled[0];
  }
  return buildMailEntry(d, row);
}

export function buildMailEntry(day, row) {
  const d = Math.max(1, day | 0);
  if (!row || row.type === 'none') return { type: 'none', day: d };
  if (row.type === 'cash') {
    return { type: 'cash', amount: mailAmountForDay(d), day: d };
  }
  if (row.type === 'message') {
    const msg = messageForDay(d);
    return {
      type: 'message',
      day: d,
      messageId: msg && msg.id,
      from: (msg && msg.from) || 'Mail',
      body: (msg && msg.body) || ''
    };
  }
  if (row.type === 'item') {
    return { type: 'item', day: d, itemId: row.itemId || 'snack' };
  }
  return { type: 'none', day: d };
}

/**
 * Queue today's roll on `mail.pending`. No-op if this day was already
 * rolled, or if uncollected mail is still waiting (it is not replaced or
 * stacked). A 'none' day leaves pending empty and counts toward pity.
 */
export function queueMail(mail, day) {
  if (!mail) return null;
  const d = Math.max(1, day | 0);
  if (!Array.isArray(mail.pending)) mail.pending = [];
  if (mail.lastMailDay === d) return null;
  if (mail.pending.length) {
    mail.lastMailDay = d;
    return null;
  }
  const streak = mail.emptyStreak | 0;
  const entry = rollMailForDay(d, streak);
  mail.lastMailDay = d;
  if (!entry || entry.type === 'none') {
    mail.emptyStreak = streak + 1;
    return entry;
  }
  mail.emptyStreak = 0;
  mail.pending.push(entry);
  return entry;
}

/** Inbox of collected message-mail for the phone Messages app. */
export function createInbox({ messages = [] } = {}) {
  let list = Array.isArray(messages) ? messages.map(copyMessage) : [];
  const listeners = [];

  function copyMessage(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const msg = {
      id: raw.id || ((raw.day || 0) + ':' + (raw.messageId || raw.from || 'mail')),
      from: raw.from || 'Mail',
      body: raw.body || '',
      day: raw.day != null ? raw.day | 0 : undefined,
      messageId: raw.messageId
    };
    if (raw.sender === 'me' || raw.sender === 'them') msg.sender = raw.sender;
    if (raw.threadId) msg.threadId = String(raw.threadId);
    if (raw.time) msg.time = String(raw.time);
    if (typeof raw.read === 'boolean') msg.read = raw.read;
    return msg;
  }

  function emit() {
    const snap = get();
    for (let i = 0; i < listeners.length; i++) listeners[i](snap);
    return snap;
  }

  function get() {
    return list.map(copyMessage);
  }

  function add(raw) {
    const msg = copyMessage(raw);
    if (!msg) return null;
    if (!msg.id) msg.id = 'm' + (list.length + 1);
    // Newest first.
    list = [msg, ...list.filter((m) => m && m.id !== msg.id)];
    emit();
    return msg;
  }

  function markRead(key) {
    if (!key) return;
    let changed = false;
    list = list.map((m) => {
      if (!m) return m;
      const match = (m.threadId && m.threadId === key) || m.from === key || m.id === key;
      if (match && !m.read) {
        changed = true;
        return { ...m, read: true };
      }
      return m;
    });
    if (changed) emit();
  }

  function serialize() {
    return list.map(copyMessage);
  }

  function apply(data) {
    const raw = Array.isArray(data)
      ? data
      : (data && Array.isArray(data.inbox) ? data.inbox
        : (data && data.mail && Array.isArray(data.mail.inbox) ? data.mail.inbox : null));
    if (!raw) return get();
    list = raw.map(copyMessage).filter(Boolean);
    emit();
    return get();
  }

  function onChange(fn) {
    if (typeof fn !== 'function') return () => {};
    listeners.push(fn);
    return () => {
      const i = listeners.indexOf(fn);
      if (i >= 0) listeners.splice(i, 1);
    };
  }

  return { get, add, markRead, serialize, apply, onChange };
}
