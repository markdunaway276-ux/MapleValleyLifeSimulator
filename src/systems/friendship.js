/**
 * Neighbour Friendship & Proactive Texts system.
 *
 * Tracks friendship score (0..100) and tier per Maple Lane resident, grows
 * when chatting, texting in Messages, or completing deliveries/favours, and
 * delivers lively proactive texts on new days.
 */

export const FRIENDSHIP_TIERS = [
  { min: 0, label: 'Acquaintance', hearts: 1 },
  { min: 20, label: 'Friendly', hearts: 2 },
  { min: 45, label: 'Good Friend', hearts: 3 },
  { min: 70, label: 'Close Friend', hearts: 4 },
  { min: 90, label: 'Best Friend', hearts: 5 }
];

const PROACTIVE_TEXTS = [
  {
    id: 'proactive-sam-park',
    threadId: 'sam',
    from: 'Sam',
    body: "Gorgeous day out! I'm heading down toward Maple Lane Park — the ducks are out on the pond and the swings are open."
  },
  {
    id: 'proactive-dottie-shift',
    threadId: 'dottie',
    from: 'Dottie',
    body: "Hey hon! Laundry baskets are piling up at the Laundromat today — swing by if you want to earn some extra cash!"
  },
  {
    id: 'proactive-vince-groceries',
    threadId: 'vince',
    from: 'Vince',
    body: "Fresh groceries just hit the counter at Maple Lane Market ($8). Way better than snacks if you cook 'em up at home!"
  },
  {
    id: 'proactive-hank-parcels',
    threadId: 'hank',
    from: 'Hank',
    body: "Got another stack of local parcels at the Post Office whenever you feel like taking your pickup out on a delivery run!"
  },
  {
    id: 'proactive-june-coffee',
    threadId: 'june',
    from: 'June',
    body: "Hope you're settling in well! Don't forget you can furnish your house from the Home app on your phone."
  }
];

export function tierForScore(score) {
  const s = Math.max(0, Math.min(100, Number(score) || 0));
  let tier = FRIENDSHIP_TIERS[0];
  for (let i = 0; i < FRIENDSHIP_TIERS.length; i++) {
    if (s >= FRIENDSHIP_TIERS[i].min) tier = FRIENDSHIP_TIERS[i];
  }
  return { score: s, ...tier };
}

export function createFriendship({
  saved = null,
  inbox = null,
  save = null,
  toast = null
} = {}) {
  const scores = Object.create(null);
  const sentProactive = new Set(Array.isArray(saved?.sentProactive) ? saved.sentProactive : []);
  if (saved && typeof saved === 'object') {
    const src = saved.scores && typeof saved.scores === 'object' ? saved.scores : saved;
    for (const [id, val] of Object.entries(src)) {
      if (id === 'sentProactive') continue;
      if (typeof val === 'number' && Number.isFinite(val)) {
        scores[id] = Math.max(0, Math.min(100, val));
      }
    }
  }
  const listeners = [];

  function emit() {
    for (let i = 0; i < listeners.length; i++) listeners[i](scores);
  }

  function get(npcId) {
    const id = String(npcId || '').toLowerCase();
    return tierForScore(scores[id] || 0);
  }

  function add(npcId, points = 5, displayName = null) {
    const id = String(npcId || '').toLowerCase();
    if (!id) return null;
    const prev = tierForScore(scores[id] || 0);
    const nextScore = Math.max(0, Math.min(100, (scores[id] || 0) + (Number(points) || 0)));
    scores[id] = nextScore;
    const next = tierForScore(nextScore);
    if (next.hearts > prev.hearts && typeof toast === 'function') {
      const label = displayName || (id.charAt(0).toUpperCase() + id.slice(1));
      toast(`${label} is now a ${next.label}! ${'♥'.repeat(next.hearts)}`);
    }
    emit();
    save?.();
    return next;
  }

  function onNewDay(day = 2) {
    const nextMsg = PROACTIVE_TEXTS.find((m) => !sentProactive.has(m.id));
    if (!nextMsg) return false;
    sentProactive.add(nextMsg.id);
    inbox?.add?.({
      ...nextMsg,
      sender: 'them',
      day: day | 0
    });
    toast?.(`New text from ${nextMsg.from}!`);
    save?.();
    return true;
  }

  function onChange(fn) {
    if (typeof fn !== 'function') return () => {};
    listeners.push(fn);
    return () => {
      const i = listeners.indexOf(fn);
      if (i >= 0) listeners.splice(i, 1);
    };
  }

  function serialize() {
    return { scores: { ...scores }, sentProactive: [...sentProactive] };
  }

  return {
    get,
    add,
    onNewDay,
    onChange,
    serialize
  };
}
