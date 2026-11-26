/**
 * Dialogue trees keyed by NPC id. Each page has 1–2 lines. Optional
 * keys (dawn, day, dusk, night, clear, cloudy, rain) override `default`
 * when the game clock or weather matches.
 */

import { getNpc } from './npcs.js';

export const DIALOGUE = {
  sam: {
    default: [
      {
        lines: [
          'Hey there! I live just down the street.',
          'Nice to finally bump into a neighbour.'
        ]
      },
      {
        lines: [
          'I walk this sidewalk most days — past the mailbox and back again.'
        ]
      }
    ],
    night: [
      {
        lines: [
          'Evening. The valley gets quiet after dark.'
        ]
      },
      {
        lines: [
          'I should head in soon. Stay safe out here.'
        ]
      }
    ],
    dusk: [
      {
        lines: [
          'Golden hour is my favourite time to walk.',
          'The houses look warmer in this light.'
        ]
      }
    ],
    rain: [
      {
        lines: [
          "Light rain doesn't bother me.",
          "The sidewalk's still the nicest place to walk."
        ]
      },
      {
        lines: [
          'If you get soaked, the vending machine has a snack.'
        ]
      }
    ]
  }
};

DIALOGUE.june = {
  default: [
    {
      lines: [
        "Oh, hi! You must be the one who moved into the house across the street.",
        "I'm June. Welcome to Maple Valley."
      ]
    },
    {
      lines: [
        'I walk this side every day. Sam takes the other one, so we wave across the road.'
      ]
    }
  ],
  dawn: [
    {
      lines: [
        "Early start? Me too. It's the quietest time of day."
      ]
    }
  ],
  night: [
    {
      lines: [
        "Still out? I'm just getting a little air before bed."
      ]
    }
  ],
  rain: [
    {
      lines: [
        "A little rain never hurt anybody.",
        'Besides, the street smells nice after.'
      ]
    }
  ]
};

export function getDialoguePack(npcId, packs = DIALOGUE) {
  return (packs && packs[npcId]) || null;
}

/**
 * Pick the best page list for an NPC given optional { period, weather }.
 * Weather keys win over time-of-day keys, then `default`.
 */
export function getDialogue(npcId, ctx = {}, packs = DIALOGUE) {
  const def = getNpc(npcId);
  const id = (def && def.dialogueId) || npcId;
  const pack = getDialoguePack(id, packs);
  const name = (def && def.name) || npcId;
  if (!pack) return { id, name, pages: [] };

  const weather = ctx.weather && (typeof ctx.weather === 'string' ? ctx.weather : ctx.weather.id);
  const period = ctx.period || (ctx.time && ctx.time.period);
  let pages = pack.default || [];
  if (weather && pack[weather]) pages = pack[weather];
  else if (period && pack[period]) pages = pack[period];

  const out = [];
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    let lines = [];
    if (page && Array.isArray(page.lines)) lines = page.lines.filter(Boolean);
    else if (typeof page === 'string') lines = [page];
    else if (page && typeof page.text === 'string') lines = [page.text];
    if (lines.length) out.push({ lines: lines.slice(0, 2) });
  }
  return { id, name, pages: out };
}
