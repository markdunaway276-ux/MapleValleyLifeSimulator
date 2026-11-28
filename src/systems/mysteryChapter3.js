/**
 * "The Last Tenant — Chapter 3: The East Creek Signal"
 *
 * Continues Maple Lane's overarching mystery after Chapter 2 (PO Box #14):
 *   'locked'     -> 'walt' (Walt texts about a night-time glint by the pond & lends his Field Flashlight)
 *                -> 'night-clue' (Investigate the East Creek cairn at Maple Lane Park Pond after dark with Flashlight ON)
 *                -> 'vince' (Bring the East Creek Time Capsule to Vince — friendship-aware finale branch!)
 *                -> 'done'
 */

const VALID_STAGES = new Set(['locked', 'walt', 'night-clue', 'vince', 'done']);
export const CHAPTER3_REWARD = 75;
export const CHAPTER3_REWARD_FRIEND = 100;

export function isNightHour(minutes) {
  const hour = ((Number(minutes) / 60) % 24 + 24) % 24;
  return hour >= 19 || hour < 6;
}

export function createMysteryChapter3({
  savedStage = null,
  clock = null,
  money = null,
  needs = null,
  inventory = null,
  inbox = null,
  friendship = null,
  flashlight = null,
  sfx = null,
  save = null,
  toast = null
} = {}) {
  let stage = VALID_STAGES.has(savedStage) ? savedStage : 'locked';

  function commit() {
    if (typeof save === 'function') save();
  }

  function unlock() {
    if (stage !== 'locked') return false;
    stage = 'walt';
    inbox?.add?.({
      id: 'ch3-walt-signal',
      threadId: 'walt',
      from: 'Walt',
      sender: 'them',
      body: "Kid, spotted a faint brass glint over by the north-east bank of Maple Lane Park Pond after dark. Swing by my trailer and borrow my old field flashlight so you can check it out!",
      day: (clock?.getTime?.()?.day | 0) || 1
    });
    toast?.('Chapter 3 unlocked! New text from Walt about the East Creek Signal.');
    commit();
    return true;
  }

  function borrowFlashlightFromWalt() {
    if (stage !== 'walt') return false;
    stage = 'night-clue';
    if (inventory && typeof inventory.addItem === 'function') {
      const items = typeof inventory.getItems === 'function' ? inventory.getItems() : [];
      if (!items.some((it) => it && it.id === 'flashlight')) {
        inventory.addItem('flashlight', 1);
      }
    }
    sfx?.play?.('pickup');
    toast?.('Received Walt’s Field Flashlight! Press F after dark (7 PM–6 AM) by Maple Lane Pond.');
    commit();
    return true;
  }

  function inspectNightClue() {
    if (stage !== 'night-clue') return false;
    const mins = clock?.getTime?.()?.minutes ?? 0;
    if (!isNightHour(mins)) {
      toast?.('Too bright to spot the reflection — come back after dark (7 PM–6 AM) with your Flashlight [F]!');
      sfx?.play?.('click');
      return false;
    }
    if (flashlight && typeof flashlight.isOn === 'function' && !flashlight.isOn()) {
      toast?.('Turn on your Field Flashlight [F] to search the East Creek stone cairn!');
      sfx?.play?.('click');
      return false;
    }

    stage = 'vince';
    if (inventory && typeof inventory.addItem === 'function') {
      inventory.addItem('creek-capsule', 1);
    }
    needs?.add?.('mood', 18);
    sfx?.play?.('pickup');
    toast?.('Found the East Creek Time Capsule! Bring the spring-headwaters map to Vince at the Market.');
    commit();
    return true;
  }

  function finishWithVince() {
    if (stage !== 'vince') return false;
    stage = 'done';

    const vinceScore = friendship?.get?.('vince')?.score ?? 0;
    const closeFriend = vinceScore >= 45;
    const reward = closeFriend ? CHAPTER3_REWARD_FRIEND : CHAPTER3_REWARD;

    // Consume capsule from bag if present
    if (inventory && typeof inventory.getItems === 'function' && typeof inventory.consume === 'function') {
      const items = inventory.getItems();
      const idx = items.findIndex((it) => it && it.id === 'creek-capsule');
      if (idx >= 0) inventory.consume(idx, 1);
    }

    money?.add?.(reward, { category: 'Story', label: 'East Creek Town Discovery' });
    needs?.add?.('mood', 35);
    friendship?.add?.('vince', 15, 'Vince');
    friendship?.add?.('maya', 10, 'Dr. Maya');
    sfx?.play?.('cash');

    inbox?.add?.({
      id: 'ch3-maya-epilogue',
      threadId: 'maya',
      from: 'Dr. Maya',
      sender: 'them',
      body: "Vince just showed me the original East Creek spring map you found! The county's designating Maple Lane Pond a protected valley landmark. Maple Lane is lucky to have you!",
      day: (clock?.getTime?.()?.day | 0) || 1
    });
    toast?.(`Chapter 3 complete! Maple Lane Pond protected (+$${reward} · +35 Mood)`);
    commit();
    return true;
  }

  function task() {
    if (stage === 'locked') return null;
    if (stage === 'walt') {
      return {
        id: 'story-ch3',
        title: 'Chapter 3: The East Creek Signal',
        npcId: 'walt',
        step: 'Visit Walt at the Trailer Park to borrow his Field Flashlight.',
        complete: false
      };
    }
    if (stage === 'night-clue') {
      return {
        id: 'story-ch3',
        title: 'Chapter 3: The East Creek Signal',
        npcId: 'walt',
        step: 'Search the north-east bank of Maple Lane Park Pond after dark (7 PM–6 AM) with your Flashlight [F] ON.',
        complete: false
      };
    }
    if (stage === 'vince') {
      return {
        id: 'story-ch3',
        title: 'Chapter 3: The East Creek Signal',
        npcId: 'vince',
        step: 'Bring the East Creek Time Capsule to Vince at Maple Lane Market.',
        complete: false
      };
    }
    return {
      id: 'story-ch3',
      title: 'Chapter 3: The East Creek Signal',
      npcId: 'vince',
      step: 'Discovered the East Creek spring map and protected Maple Lane Pond as a valley landmark.',
      complete: true
    };
  }

  function pageFor(npcId) {
    if (stage === 'walt' && npcId === 'walt') {
      const waltScore = friendship?.get?.('walt')?.score ?? 0;
      const lines = waltScore >= 20
        ? [
            "Glad you came by, friend. Since I trust you, here's the exact spot: look for a little stacked stone cairn on the north-east bank of the Park Pond.",
            'Take my field flashlight — hit F after 7 PM and you’ll see the brass glint right away.'
          ]
        : [
            "Been seeing a faint glint over by Maple Lane Park Pond after dark — right where Kyle used to check the creek.",
            'Borrow my old field flashlight and check the north-east bank after 7 PM.'
          ];
      return {
        lines,
        action: { label: 'Borrow Field Flashlight [F]', run: borrowFlashlightFromWalt },
        response: [
          'Press F anytime to flip the beam on. Stay sharp out there after sundown!'
        ]
      };
    }

    if (stage === 'vince' && npcId === 'vince') {
      const vinceScore = friendship?.get?.('vince')?.score ?? 0;
      const closeFriend = vinceScore >= 45;
      const reward = closeFriend ? CHAPTER3_REWARD_FRIEND : CHAPTER3_REWARD;
      return {
        lines: closeFriend
          ? [
              "Wait a second... I recognize that brass cylinder. Kyle's dad and I buried that spring-headwaters map the summer we built the Park footbridge!",
              "You've been a true friend to this whole block. With this map, Maple Lane Pond is protected for good — take $100 from the community fund."
            ]
          : [
              'Hold everything — is that the original East Creek spring-headwaters map? Folks looked for that survey for years!',
              "With this on file with Dr. Maya, nobody can ever touch Maple Lane Pond. Here's $75 from the town fund."
            ],
        action: { label: `Hand over East Creek Capsule (+$${reward})`, run: finishWithVince },
        response: [
          "I'm framing a copy right behind the Market counter. You've really made Maple Lane home!"
        ]
      };
    }

    return null;
  }

  return {
    get stage() { return stage; },
    unlock,
    borrowFlashlightFromWalt,
    inspectNightClue,
    finishWithVince,
    task,
    pageFor,
    serialize: () => stage
  };
}
