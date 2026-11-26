/**
 * Player cash for Maple Valley. One wallet (not an inventory stack).
 * Later systems (work, vending) can call get, add, spend, canAfford, or onChange.
 *
 * Daily mail: once per in-game day (time.js newDay / maple-new-day) a payment
 * of MAIL_MIN–MAIL_MAX is queued on the mailbox's userData.mail.pending.
 * Opening the mailbox collects it (the first-time Letter is unchanged).
 */

export const STARTING_CASH = 50;
export const MAIL_MIN = 5;
export const MAIL_MAX = 15;

/** Deterministic whole dollars in [MAIL_MIN, MAIL_MAX] for a 1-based day. */
export function mailAmountForDay(day) {
  const span = MAIL_MAX - MAIL_MIN + 1;
  const d = Math.max(1, day | 0);
  return MAIL_MIN + ((d * 7 + 3) % span);
}

export function formatCash(amount) {
  const n = Number(amount);
  const v = Number.isFinite(n) ? n : 0;
  const shown = Number.isInteger(v) ? String(v) : v.toFixed(2);
  return '$' + shown;
}

/**
 * Pull any leftover 'cash' inventory stacks out of a bag list so the HUD
 * wallet is the only cash value. Returns { cash, items }.
 */
export function extractCashFromItems(list) {
  let cash = 0;
  if (!Array.isArray(list)) return { cash: 0, items: list };
  const items = [];
  for (let i = 0; i < list.length; i++) {
    const it = list[i];
    if (it && it.id === 'cash') cash += Number(it.count) || 0;
    else items.push(it);
  }
  return { cash, items };
}

function clampCash(value, fallback = STARTING_CASH) {
  const n = Number(value);
  const v = Number.isFinite(n) ? n : fallback;
  return v < 0 ? 0 : v;
}

export function queueDailyMail(mail, day) {
  if (!mail) return null;
  const d = Math.max(1, day | 0);
  if (!Array.isArray(mail.pending)) mail.pending = [];
  if (mail.lastMailDay === d) return null;
  if (mail.pending.some((p) => p && p.type === 'cash')) {
    mail.lastMailDay = d;
    return null;
  }
  const amount = mailAmountForDay(d);
  mail.pending.push({ type: 'cash', amount, day: d });
  mail.lastMailDay = d;
  return amount;
}

export function collectPendingMail(mail) {
  if (!mail || !Array.isArray(mail.pending) || !mail.pending.length) return [];
  const items = mail.pending.slice();
  mail.pending = [];
  return items;
}

/** Hook mailbox.userData.mail.onOpen to pay pending cash, toast, and play sfx. */
export function attachMailboxMoney({ mailbox, money, sfx, toast } = {}) {
  if (!mailbox || !mailbox.userData) return null;
  if (!mailbox.userData.mail) mailbox.userData.mail = { letterTaken: false, pending: [] };
  const mail = mailbox.userData.mail;
  mail.onOpen = () => {
    const collected = collectPendingMail(mail);
    let total = 0;
    for (let i = 0; i < collected.length; i++) {
      const item = collected[i];
      if (item && item.type === 'cash') total += Number(item.amount) || 0;
    }
    if (total > 0 && money && typeof money.add === 'function') {
      money.add(total);
      if (sfx && typeof sfx.play === 'function') sfx.play('cash');
      if (typeof toast === 'function') toast('+' + formatCash(total));
    }
  };
  return mail;
}

export function createMoney({ cash = STARTING_CASH } = {}) {
  let balance = clampCash(cash, STARTING_CASH);
  const listeners = [];

  function emit() {
    const value = balance;
    for (let i = 0; i < listeners.length; i++) listeners[i](value);
    return value;
  }

  function get() {
    return balance;
  }

  function set(amount) {
    const next = clampCash(amount, balance);
    if (next === balance) return balance;
    balance = next;
    return emit();
  }

  function add(amount) {
    const n = Number(amount);
    if (!Number.isFinite(n) || n === 0) return balance;
    return set(balance + n);
  }

  function canAfford(amount) {
    const n = Number(amount);
    if (!Number.isFinite(n) || n < 0) return false;
    return balance >= n;
  }

  /** Deduct `amount` and return true, or leave the balance and return false. */
  function spend(amount) {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) return false;
    if (balance < n) return false;
    set(balance - n);
    return true;
  }

  function reset() {
    return set(STARTING_CASH);
  }

  function onChange(fn) {
    if (typeof fn !== 'function') return () => {};
    listeners.push(fn);
    return () => off(fn);
  }

  function off(fn) {
    const i = listeners.indexOf(fn);
    if (i >= 0) listeners.splice(i, 1);
  }

  function serialize() {
    return { cash: balance };
  }

  function apply(data) {
    const src = data && data.money != null ? data.money : data;
    if (src == null) return get();
    if (typeof src === 'number') return set(src);
    if (typeof src === 'object' && src.cash != null) return set(src.cash);
    return get();
  }

  return {
    get,
    set,
    add,
    spend,
    canAfford,
    reset,
    onChange,
    on: (name, fn) => (name === 'change' ? onChange(fn) : () => {}),
    off,
    serialize,
    apply
  };
}
