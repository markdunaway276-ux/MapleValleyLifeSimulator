/**
 * "The Last Tenant — Chapter 2: PO Box #14"
 *
 * Continues Kyle's mystery after Chapter 1 (Walt & Vince):
 *   'locked' -> 'hank' (unclaimed parcel at Post Office PO Box #14)
 *            -> 'maya' (Dr. Maya at the Clinic reveals why Kyle really left)
 *            -> 'walt' (Walt at the Trailer Park hands over Kyle's ledger & $50 stash)
 *            -> 'done'
 */

const VALID_STAGES = new Set(['locked', 'hank', 'maya', 'walt', 'done']);
export const CHAPTER2_REWARD = 50;

export function createMysteryChapter2({
  savedStage = null,
  money = null,
  needs = null,
  inventory = null,
  inbox = null,
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
    stage = 'hank';
    inbox?.add?.({
      id: 'ch2-hank-parcel',
      threadId: 'hank',
      from: 'Hank',
      sender: 'them',
      body: "Hey, it's Hank at the Post Office. There's a dusty registered parcel sitting in PO Box #14 from the night Kyle left. Stop by the counter when you get a minute!",
      day: 1
    });
    toast?.('New text from Hank at the Post Office about PO Box #14!');
    commit();
    return true;
  }

  function claimFromHank() {
    if (stage !== 'hank') return false;
    stage = 'maya';
    inventory?.add?.({ id: 'kyle-parcel', count: 1 });
    sfx?.play?.('pickup');
    toast?.('Received Kyle’s Unclaimed Parcel — ask Dr. Maya at the Clinic about the stamp.');
    commit();
    return true;
  }

  function askMaya() {
    if (stage !== 'maya') return false;
    stage = 'walt';
    inbox?.add?.({
      id: 'ch2-maya-clue',
      threadId: 'maya',
      from: 'Dr. Maya',
      sender: 'them',
      body: "I'm glad you're looking into Kyle's ledger. Talk to Walt at the Trailer Park — he's the only one Kyle trusted before he left.",
      day: 1
    });
    toast?.('New lead: bring the cedar key tag to Walt at the Trailer Park.');
    commit();
    return true;
  }

  function finishWithWalt() {
    if (stage !== 'walt') return false;
    stage = 'done';
    if (money && typeof money.add === 'function') {
      money.add(CHAPTER2_REWARD, { category: 'Story', label: 'Kyle’s emergency stash' });
    }
    needs?.add?.('mood', 30);
    sfx?.play?.('cash');
    inbox?.add?.({
      id: 'ch2-walt-finale',
      threadId: 'walt',
      from: 'Walt',
      sender: 'them',
      body: "Good work, kid. With Kyle's survey ledger safe in your hands, Maple Lane's creek and deer are going to stay protected. Keep the $50 — you earned it.",
      day: 1
    });
    toast?.(`Mystery solved! Found Kyle’s ledger & $${CHAPTER2_REWARD} stash (+30 Mood).`);
    commit();
    return true;
  }

  function task() {
    if (stage === 'locked') return null;
    if (stage === 'hank') {
      return {
        id: 'story-ch2',
        title: 'Chapter 2: PO Box #14',
        npcId: 'hank',
        step: 'Ask Hank at Maple Lane Post Office about Kyle’s unclaimed parcel.',
        complete: false
      };
    }
    if (stage === 'maya') {
      return {
        id: 'story-ch2',
        title: 'Chapter 2: PO Box #14',
        npcId: 'maya',
        step: 'Show the clinic stamp from Kyle’s parcel to Dr. Maya at the Clinic.',
        complete: false
      };
    }
    if (stage === 'walt') {
      return {
        id: 'story-ch2',
        title: 'Chapter 2: PO Box #14',
        npcId: 'walt',
        step: 'Bring Kyle’s cedar key tag back to Walt at the Trailer Park.',
        complete: false
      };
    }
    return {
      id: 'story-ch2',
      title: 'Chapter 2: PO Box #14',
      npcId: 'walt',
      step: 'Uncovered the truth about Kyle’s survey ledger and protected Maple Lane.',
      complete: true
    };
  }

  function pageFor(npcId) {
    if (stage === 'hank' && npcId === 'hank') {
      return {
        lines: [
          'Been holding this registered parcel for PO Box #14 since the night Kyle cleared out. Stamped by Maple Lane Clinic.',
          "Since you're the new tenant at his place, figured you ought to see what's inside."
        ],
        action: { label: 'Claim Kyle’s parcel', run: claimFromHank },
        response: [
          "There's a clinic receipt and a little cedar key tag inside. Dr. Maya over at the Clinic might know what it's for."
        ]
      };
    }
    if (stage === 'maya' && npcId === 'maya') {
      return {
        lines: [
          "That's my stamp, alright. Kyle came in two nights before he left — sprained his ankle out by Route 9's deer creek.",
          "He wasn't running from debts. He found proof an out-of-town contractor was dumping runoff near the valley and hid the survey ledger."
        ],
        action: { label: 'Ask where Kyle hid the ledger', run: askMaya },
        response: [
          "He wouldn't put it in writing, only said Walt at the Trailer Park knew where that cedar key tag fits."
        ]
      };
    }
    if (stage === 'walt' && npcId === 'walt') {
      return {
        lines: [
          "Well I'll be — that's Kyle's cedar tag. He stashed the survey ledger and $50 in a weatherproof tin behind my trailer.",
          "Told me to hand it to whoever moved into his house if they had the grit to dig past the rumours."
        ],
        action: { label: `Take ledger & stash (+$${CHAPTER2_REWARD})`, run: finishWithWalt },
        response: [
          "You did right by this town, kid. Maple Lane's creek — and those deer off Route 9 — are safe now."
        ]
      };
    }
    return null;
  }

  return {
    get stage() { return stage; },
    unlock,
    task,
    pageFor,
    serialize: () => stage
  };
}
