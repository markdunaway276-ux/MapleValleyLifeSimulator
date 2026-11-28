/**
 * Dialogue trees keyed by NPC id. Each page has 1–2 lines. Optional
 * keys (dawn, day, dusk, night, clear, cloudy, rain) override `default`
 * when the game clock or weather matches.
 */

import { getNpc } from './npcs.js';

export const DIALOGUE = {
  danny: {
    default: [
      { lines: ["Hey, welcome to Fuel & Go. I'm Danny.", 'Pumps are pay-at-the-pump, coffee is fresh-ish.'] },
      { lines: ['Boss is always looking for help on the register.', 'Clock in at the till if you want a shift.'] }
    ],
    night: [
      { lines: ['Night shift is mostly me, the slushie machine and the moths.'] }
    ],
    rain: [
      { lines: ['Rain brings everybody in for coffee. Not complaining.'] }
    ]
  },
  dottie: {
    default: [
      { lines: ["Welcome to Maple Lane Laundromat, hon. I'm Dottie.", 'Self-serve washers are on the center island, dryers in back — grab soap from the wall dispenser or right from me.'] },
      { lines: ['Need a little cash? Clock in back there and help me with the drop-off bags.', 'Wash, dry, fold, hand it back. Quick work gets tips.'] }
    ],
    night: [
      { lines: ["Open twenty-four hours, and some nights it feels like it.", "There's always somebody's laundry."] }
    ],
    rain: [
      { lines: ['Rainy days are my busiest. Everybody remembers their laundry at once.'] }
    ]
  },
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

DIALOGUE.vince = {
  default: [
    { lines: ["Name's Vince. I keep the lights on at Maple Lane Market.", 'Grab what you need off the shelves — fresh deli case just went in.'] },
    { lines: ['If your pockets get light, ask around town. Dottie and Danny always need extra hands.', "And if you want night-stock hours later, you know where to find me."] }
  ],
  night: [
    { lines: ["Quiet hours are the best time to restock.", "Nobody's breathing down your neck while you count crates."] }
  ],
  rain: [
    { lines: ["Wipe your boots at the door. Just mopped aisle two.", "Hot soup's on the middle shelf if you're soaked."] }
  ]
};

DIALOGUE.walt = {
  default: [
    { lines: ["You're the new face in the house down the block. I'm Walt.", 'Saw your pickup roll in off Route 9.'] },
    { lines: ["Last guy who lived there? Name was Kyle. Left before sunrise with half his stuff still packed.", "Keep your eyes open on Maple Lane. Quiet towns hide the loudest stories."] }
  ],
  night: [
    { lines: ["Out late, huh? Stick to the streetlights.", "Half the folks on this block are asleep, the other half are busy."] }
  ],
  rain: [
    { lines: ["Trailer roof sounds like a drum kit in this weather.", "Still beats paying city rent."] }
  ]
};

DIALOGUE.maya = {
  default: [
    { lines: ["Welcome to Maple Lane Clinic. I'm Dr. Maya.", "New in town? Make sure you're actually eating and getting sleep."] },
    { lines: ["People move out here thinking it'll be slow, then burn out in a week.", "My door's open if you ever need to check in."] }
  ],
  night: [
    { lines: ["Finishing up charts for the night.", "Don't push yourself too hard on your first few days here."] }
  ],
  rain: [
    { lines: ["Rainy stretch always brings in colds and sore backs.", "Stay dry out there."] }
  ]
};

DIALOGUE.marcus = {
  default: [
    { lines: ["Hey — I'm Marcus. Saw that pickup parked across from your place.", "Good bones on that truck. Keep the tank topped off at Fuel & Go."] },
    { lines: ["I come out to the park when my shift at the garage wraps up.", "Best spot in Maple Lane to clear your head."] }
  ],
  dusk: [
    { lines: ["Park lights are just kicking on.", "Not a bad view once the street slows down."] }
  ],
  rain: [
    { lines: ["Should've brought a jacket, huh? Still beats sitting inside."] }
  ]
};

DIALOGUE.hank = {
  default: [
    { lines: ["Welcome to Maple Lane Post Office! Name's Hank — I've sorted every letter on this block for twenty years.", "New tenant over at Kyle's old place, right?"] },
    { lines: ["He left in such a rush he never closed out PO Box #14 along the west wall.", "Go ahead and check it if you haven't — pretty sure there's an unclaimed money order still sitting in there."] }
  ],
  dusk: [
    { lines: ["Just bagging up the last outgoing parcels for the Route 9 truck.", "Drop box out front gets swept every afternoon at 4:30 sharp."] }
  ],
  rain: [
    { lines: ["Neither rain nor sleet, right? Though my boots sure wish it'd let up.", "Step on in and dry off."] }
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
  // Lighter steps of rain/snow reuse the heavier pack's lines when no own pack exists.
  const family = { drizzle: 'rain', flurries: 'snow' }[weather];
  if (weather && pack[weather]) pages = pack[weather];
  else if (family && pack[family]) pages = pack[family];
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
