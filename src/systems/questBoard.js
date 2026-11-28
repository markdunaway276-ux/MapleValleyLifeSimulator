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
    rewardFriendship: 8,
    photoGig: 'any'
  },
  {
    id: 'board-photo-wildlife',
    source: 'notice-board',
    title: 'Park Wildlife Snap',
    step: 'Use Phone Camera zoom (1.5× or 2×) to photograph wildlife at Maple Lane Park, then show Sam.',
    npcId: 'sam',
    rewardCash: 26,
    rewardMood: 12,
    rewardFriendship: 10,
    photoGig: 'zoom'
  },
  {
    id: 'board-photo-golden',
    source: 'notice-board',
    title: 'Golden-Hour Maple Lane',
    step: 'Snap a photo with the Warm Film or Golden filter (or at sunset), then show June.',
    npcId: 'june',
    rewardCash: 30,
    rewardMood: 14,
    rewardFriendship: 12,
    photoGig: 'golden'
  },
  {
    id: 'board-photo-bw',
    source: 'notice-board',
    title: 'Vintage Valley Portrait',
    step: 'Take a Cozy B&W photo in town with your Phone Camera, then show Dottie at the Laundromat.',
    npcId: 'dottie',
    rewardCash: 25,
    rewardMood: 12,
    rewardFriendship: 10,
    photoGig: 'bw'
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
  getPhotoIds = () => [],
  getPhotos = null
} = {}) {
  const active = new Set();
  const completed = new Set();
  // Photo ids already in the Gallery when each photo gig was taken: only a new photo counts.
  let postcardBaseline = [];
  const photoBaselines = Object.create(null);

  const readPhotosList = () => {
    if (typeof getPhotos === 'function') {
      try {
        const list = getPhotos();
        if (Array.isArray(list)) return list.filter((p) => p && typeof p.id === 'string');
      } catch { /* fall through */ }
    }
    try {
      const ids = getPhotoIds();
      return Array.isArray(ids) ? ids.filter((id) => typeof id === 'string').map((id) => ({ id })) : [];
    } catch {
      return [];
    }
  };
  const photoIds = () => readPhotosList().map((p) => p.id);

  function matchesPhotoGig(questId, mode) {
    const base = questId === 'board-park-photo' ? postcardBaseline : (photoBaselines[questId] || []);
    const fresh = readPhotosList().filter((p) => !base.includes(p.id));
    if (!fresh.length) return false;
    if (mode === 'any') return true;
    if (mode === 'zoom') return fresh.some((p) => (p.zoom || 1) >= 1.5);
    if (mode === 'golden') {
      return fresh.some((p) => p.filterId === 'warm' || p.filterId === 'golden'
        || (typeof p.hour === 'number' && p.hour >= 16.5 && p.hour <= 20));
    }
    if (mode === 'bw') return fresh.some((p) => p.filterId === 'bw');
    return false;
  }

  const byId = (id) => QUEST_CATALOG.find(q => q.id === id) || null;

  function accept(id, { silent = false } = {}) {
    const def = byId(id);
    if (!def || active.has(id) || completed.has(id)) return false;
    active.add(id);
    if (id === 'board-park-photo') postcardBaseline = photoIds();
    if (def.photoGig) photoBaselines[id] = photoIds();
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
    if (npcId === 'hank' && active.has('board-park-photo') && matchesPhotoGig('board-park-photo', 'any')) {
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

    // 2b) Sam: "Park Wildlife Snap" (zoomed photo)
    if (npcId === 'sam' && active.has('board-photo-wildlife') && matchesPhotoGig('board-photo-wildlife', 'zoom')) {
      return {
        lines: [
          'Whoa, awesome zoom shot! You caught the Maple Lane wildlife up close without spooking them.'
        ],
        action: {
          label: 'Share wildlife photo (+$26)',
          run: () => complete('board-photo-wildlife')
        },
        response: [
          "Love it! Here's $26 — you should hang a copy on your wall at home too!"
        ]
      };
    }

    // 2c) June: "Golden-Hour Maple Lane" (Warm/Golden filter or sunset)
    if (npcId === 'june' && active.has('board-photo-golden') && matchesPhotoGig('board-photo-golden', 'golden')) {
      return {
        lines: [
          'Oh, that warm golden light makes Maple Lane look like a painting!'
        ],
        action: {
          label: 'Share golden-hour photo (+$30)',
          run: () => complete('board-photo-golden')
        },
        response: [
          "Thank you! Here's $30 — you've really got an eye for photography."
        ]
      };
    }

    // 2d) Dottie: "Vintage Valley Portrait" (Cozy B&W filter)
    if (npcId === 'dottie' && active.has('board-photo-bw') && matchesPhotoGig('board-photo-bw', 'bw')) {
      return {
        lines: [
          'Now THAT is classic black-and-white charm, hon! Looks right out of an old Maple Valley album.'
        ],
        action: {
          label: 'Share B&W photo (+$25)',
          run: () => complete('board-photo-bw')
        },
        response: [
          "Bless you, hon! Here's $25 — I'm pinning this right behind the counter."
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
    serialize: () => ({
      active: [...active],
      completed: [...completed],
      postcardBaseline: [...postcardBaseline],
      photoBaselines: { ...photoBaselines }
    }),
    apply(data) {
      active.clear();
      completed.clear();
      const qb = data?.questBoard;
      postcardBaseline = [];
      for (const k of Object.keys(photoBaselines)) delete photoBaselines[k];
      if (!qb || typeof qb !== 'object') return;
      if (Array.isArray(qb.postcardBaseline)) postcardBaseline = qb.postcardBaseline.filter((id) => typeof id === 'string');
      if (qb.photoBaselines && typeof qb.photoBaselines === 'object') {
        for (const [k, v] of Object.entries(qb.photoBaselines)) {
          if (Array.isArray(v)) photoBaselines[k] = v.filter((id) => typeof id === 'string');
        }
      }
      for (const id of qb.completed || []) if (byId(id)) completed.add(id);
      for (const id of qb.active || []) if (byId(id) && !completed.has(id)) active.add(id);
    }
  };
}
