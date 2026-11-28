import { FISH_IDS } from './fishing.js';

/**
 * Open-Ended Multi-Source Quest & Rumour Engine for Maple Valley.
 * Designed for a long-running story with multiple independent quest sources
 * (Post Office Notice Board, Neighbours, Pond/Exploration discoveries, Texts,
 * and future expanded map zones) without closing off the overarching narrative.
 */

export const QUEST_SOURCES = Object.freeze({
  'notice-board': 'Notice Board',
  pond: 'Pond Clue',
  neighbour: 'Neighbour',
  text: 'Phone Tip',
  world: 'Valley Lead'
});

export const QUEST_CATALOG = Object.freeze([
  {
    id: 'board-fresh-trout',
    source: 'notice-board',
    title: "Vince's Friday Chowder",
    step: 'Catch a fish at Maple Lane Park pond and bring it to Vince at the Market.',
    npcId: 'vince',
    rewardCash: 28,
    rewardFriendship: 10
  },
  {
    id: 'board-park-photo',
    source: 'notice-board',
    title: 'Maple Lane Postcard',
    step: 'Snap a photo with your phone Camera, then show Hank at the Post Office.',
    npcId: 'hank',
    rewardCash: 20,
    rewardMood: 15,
    rewardFriendship: 8
  },
  {
    id: 'pond-locket-lead',
    source: 'pond',
    title: 'The Tarnished Locket',
    step: 'Show the "K.M. — Route 9" locket you fished up to Walt at the Trailer Park.',
    npcId: 'walt',
    rewardCash: 35,
    rewardMood: 12,
    rewardFriendship: 12
  },
  {
    id: 'neighbour-late-shift',
    source: 'neighbour',
    title: 'Night Shift Coffee Run',
    step: 'Bring a Coffee or Sandwich from town to Hank at the Post Office.',
    npcId: 'hank',
    rewardCash: 24,
    rewardFriendship: 12
  }
]);

export function createQuestBoard({
  inventory = null,
  money = null,
  needs = null,
  sfx = null,
  toast = () => {},
  save = () => {},
  friendship = null,
  getPhotoIds = () => []
} = {}) {
  const active = new Set();
  const completed = new Set();
  // Photo ids already in the Gallery when the postcard quest was taken: only a new photo counts.
  let postcardBaseline = [];
  const photoIds = () => {
    try { const ids = getPhotoIds(); return Array.isArray(ids) ? ids : []; } catch { return []; }
  };
  const hasNewPhoto = () => photoIds().some((id) => !postcardBaseline.includes(id));

  const byId = (id) => QUEST_CATALOG.find(q => q.id === id) || null;

  function accept(id, { silent = false } = {}) {
    const def = byId(id);
    if (!def || active.has(id) || completed.has(id)) return false;
    active.add(id);
    if (id === 'board-park-photo') postcardBaseline = photoIds();
    if (!silent) {
      toast(`New quest (${QUEST_SOURCES[def.source] || 'Lead'}): ${def.title}`);
      sfx?.play?.('phone-notification');
    }
    save();
    return true;
  }

  function complete(id, message = null) {
    const def = byId(id);
    if (!def || !active.has(id)) return false;
    active.delete(id);
    completed.add(id);
    if (def.rewardCash) money?.add?.(def.rewardCash);
    if (def.rewardMood) needs?.add?.('mood', def.rewardMood);
    if (def.rewardFriendship && def.npcId) friendship?.add?.(def.npcId, def.rewardFriendship);
    sfx?.play?.('pickup');
    toast(message || `Quest complete: ${def.title}${def.rewardCash ? ` (+$${def.rewardCash})` : ''}`);
    save();
    return true;
  }

  /** Interact with the Post Office Community Notice Board to pick up available postings. */
  function interactBoard() {
    const available = QUEST_CATALOG.filter(q => q.source === 'notice-board' && !active.has(q.id) && !completed.has(q.id));
    if (!available.length) {
      toast('Community Notice Board: You have already grabbed all current postings. Check back as the valley grows!');
      sfx?.play?.('click');
      return false;
    }
    const next = available[0];
    accept(next.id);
    return next;
  }

  function findItemIndex(ids) {
    const items = inventory?.getItems?.() ?? [];
    for (let i = 0; i < items.length; i++) {
      if (items[i] && ids.includes(items[i].id)) return i;
    }
    return -1;
  }

  function pageFor(npcId) {
    // 1) Vince: "Vince's Friday Chowder"
    if (npcId === 'vince' && active.has('board-fresh-trout')) {
      const idx = findItemIndex(FISH_IDS);
      if (idx >= 0) {
        return {
          lines: [
            "You saw my note on the Post Office board! That catch is going straight into tonight's chowder."
          ],
          action: {
            label: 'Hand over fresh fish (+$28)',
            run: () => {
              inventory.consume(idx, 1);
              return complete('board-fresh-trout');
            }
          },
          response: [
            "Much obliged! Here's $28 — stop by whenever you've got another good catch."
          ]
        };
      }
    }

    // 2) Hank: "Maple Lane Postcard"
    if (npcId === 'hank' && active.has('board-park-photo') && hasNewPhoto()) {
      return {
        lines: [
          "Hey, nice shot on your phone! That'll make a great Maple Lane postcard for the lobby rack."
        ],
        action: {
          label: 'Share photo for postcard (+$20)',
          run: () => complete('board-park-photo')
        },
        response: [
          "Appreciate it! Here's $20 — keep snapping pictures as you explore the valley."
        ]
      };
    }

    // 3) Hank: "Night Shift Coffee Run"
    if (npcId === 'hank' && active.has('neighbour-late-shift')) {
      const idx = findItemIndex(['coffee', 'sandwich']);
      if (idx >= 0) {
        return {
          lines: [
            'Marcus sent you over with a pick-me-up? Lifesaver — sorting mail all day takes it out of you.'
          ],
          action: {
            label: 'Deliver coffee/snack (+$24)',
            run: () => {
              inventory.consume(idx, 1);
              return complete('neighbour-late-shift');
            }
          },
          response: [
            "Thanks a ton! Here's $24 — tell Marcus I owe him one."
          ]
        };
      }
    }

    // 4) Marcus: offers "Night Shift Coffee Run" rumour quest
    if (npcId === 'marcus' && !active.has('neighbour-late-shift') && !completed.has('neighbour-late-shift')) {
      return {
        lines: [
          'Hank over at the Post Office has been pulling double shifts since the valley mail route backed up.',
          "If you bring him a Coffee or Sandwich, he'll pay you well."
        ],
        action: {
          label: 'Accept: Night Shift Coffee Run',
          run: () => accept('neighbour-late-shift')
        },
        response: [
          "Awesome — Hank's right down the street at the Post Office."
        ]
      };
    }

    // 5) Walt: "The Tarnished Locket" — opens a broader valley lead without ending the story!
    if (npcId === 'walt' && active.has('pond-locket-lead')) {
      const idx = findItemIndex(['old-locket']);
      if (idx >= 0) {
        return {
          lines: [
            "Hold on... K.M. — Route 9? That's Kyle's mother's locket.",
            'If it ended up in Maple Lane Pond, somebody came back through the East Creek trail after he moved out.'
          ],
          action: {
            label: 'Show Walt the locket (+$35)',
            run: () => complete('pond-locket-lead', 'Lead logged: East Creek & Route 9 (+$35)')
          },
          response: [
            "Keep that locket safe and keep your eyes open as more of the valley opens up — this story's only getting started."
          ]
        };
      }
    }

    return null;
  }

  function getTasks() {
    const list = [];
    for (const q of QUEST_CATALOG) {
      if (active.has(q.id)) {
        list.push({
          id: q.id,
          title: q.title,
          step: q.step,
          npcId: q.npcId,
          source: q.source,
          sourceLabel: QUEST_SOURCES[q.source] || 'Quest',
          complete: false
        });
      } else if (completed.has(q.id)) {
        list.push({
          id: q.id,
          title: q.title,
          step: q.step,
          npcId: q.npcId,
          source: q.source,
          sourceLabel: QUEST_SOURCES[q.source] || 'Quest',
          complete: true
        });
      }
    }
    return list;
  }

  return {
    accept,
    complete,
    interactBoard,
    pageFor,
    getTasks,
    isActive: (id) => active.has(id),
    isCompleted: (id) => completed.has(id),
    serialize: () => ({ active: [...active], completed: [...completed], postcardBaseline: [...postcardBaseline] }),
    apply(data) {
      active.clear();
      completed.clear();
      const qb = data?.questBoard;
      postcardBaseline = [];
      if (!qb || typeof qb !== 'object') return;
      if (Array.isArray(qb.postcardBaseline)) postcardBaseline = qb.postcardBaseline.filter((id) => typeof id === 'string');
      for (const id of qb.completed || []) if (byId(id)) completed.add(id);
      for (const id of qb.active || []) if (byId(id) && !completed.has(id)) active.add(id);
    }
  };
}
