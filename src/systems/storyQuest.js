/**
 * Day 1 story quest: "The Last Tenant".
 *
 * Unlocked when you unpack Box #3 and find Kyle's folded note under the
 * floorboards. Guides you to talk to Walt down at the Trailer Park, then
 * check in with Vince at Maple Lane Market for a $15 welcome grocery credit.
 *
 * Stages: 'hidden' -> 'walt' -> 'vince' -> 'done'
 */

const VALID_STAGES = new Set(['hidden', 'walt', 'vince', 'done']);
export const STORY_QUEST_REWARD = 15;

export function createStoryQuest({ savedStage = null, money = null, save = null, toast = null } = {}) {
  let stage = VALID_STAGES.has(savedStage) ? savedStage : 'hidden';

  function commit() {
    if (typeof save === 'function') save();
  }

  function onNoteFound() {
    if (stage !== 'hidden') return false;
    stage = 'walt';
    commit();
    return true;
  }

  function askWalt() {
    if (stage !== 'walt') return false;
    stage = 'vince';
    if (typeof toast === 'function') toast('New lead: talk to Vince at Maple Lane Market.');
    commit();
    return true;
  }

  function meetVince() {
    if (stage !== 'vince') return false;
    stage = 'done';
    if (money && typeof money.add === 'function') {
      money.add(STORY_QUEST_REWARD, { category: 'Story', label: 'Vince welcome credit' });
    }
    if (typeof toast === 'function') toast(`Vince gave you $${STORY_QUEST_REWARD} toward groceries!`);
    commit();
    return true;
  }

  function task() {
    if (stage === 'hidden') return null;
    if (stage === 'walt') {
      return {
        id: 'story-last-tenant',
        title: 'The Last Tenant',
        npcId: 'walt',
        step: 'Ask Walt at the Trailer Park about Kyle’s note.',
        complete: false
      };
    }
    if (stage === 'vince') {
      return {
        id: 'story-last-tenant',
        title: 'The Last Tenant',
        npcId: 'vince',
        step: 'Meet Vince inside Maple Lane Market.',
        complete: false
      };
    }
    return {
      id: 'story-last-tenant',
      title: 'The Last Tenant',
      npcId: 'vince',
      step: 'Met Walt and Vince — Maple Lane is yours to explore.',
      complete: true
    };
  }

  function pageFor(npcId) {
    if (stage === 'walt' && npcId === 'walt') {
      return {
        lines: [
          'Kyle? Yeah, he had your house six months. Cleared out before dawn after a bad deal up on Route 9.',
          'Go see Vince at Maple Lane Market — he keeps track of everything on this block.'
        ],
        action: { label: 'Ask about Vince', run: askWalt },
        response: [
          'Vince acts gruff, but he looks out for newcomers who pull their weight.',
          'Tell him Walt sent you.'
        ]
      };
    }
    if (stage === 'vince' && npcId === 'vince') {
      return {
        lines: [
          'Walt sent you over? Figures. Kyle was alright, just owed the wrong folks out of town.',
          'Keep your head down, pick up shifts with Dottie or Danny, and you’ll do fine here.'
        ],
        action: { label: 'Take welcome credit (+$15)', run: meetVince },
        response: [
          'Consider it a neighbour discount on your first week of groceries.',
          'Welcome to Maple Lane.'
        ]
      };
    }
    return null;
  }

  return {
    get stage() { return stage; },
    onNoteFound,
    task,
    pageFor,
    serialize: () => stage
  };
}
