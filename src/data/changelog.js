/**
 * "What's New" patch notes shown from the title screen.
 *
 * Whoever ships an update (Claude, ChatGPT, Gemini) adds an entry at the TOP
 * with a higher version. The title screen shows a NEW badge until the
 * player opens What's New for the latest version.
 */

export const CHANGELOG = [
  {
    version: '0.15.2',
    date: '2026-11-28',
    title: 'Sleek Phone Style & Wardrobe Layout',
    notes: [
      'Removed the old 2D ghost character from appearing behind the live 3D character in the Phone Style app.',
      'Redesigned the Style & Wardrobe layout into a compact, sleek 3D stage with Wardrobe / Colors tabs and inline color rows so you can customize without bulky scrolling.'
    ]
  },
  {
    version: '0.15.1',
    date: '2026-11-28',
    title: 'Phone Hand Alignment & Mesh Fix',
    notes: [
      'Fixed the duplicate floating hand in front of the camera when opening your phone in first-person.',
      'Fixed missing wrist/palm triangles on the realistic first-person hand mesh and reseated the fingers behind the phone case so they wrap cleanly around the edge without poking through the screen.'
    ]
  },
  {
    version: '0.15',
    date: '2026-11-28',
    title: 'Home Cooking & Backyard Gardening',
    notes: [
      'Interactive Kitchen Stove Recipe Menu: cook 7 home-cooked meals (Home Meal, Morning Pancakes, Garden Salad, Fresh Tomato Soup, Pan-Seared Trout, Hearty Harvest Stew, and Warm Cocoa) for stronger Hunger & Energy buffs.',
      'Share any home-cooked meal with Maple Lane neighbours during conversation for a big Friendship boost.',
      'Backyard Kitchen Garden: 4 cedar raised garden beds behind your house — buy Tomato, Herb, or Pumpkin Seeds at Vince\'s Market, water them (rain waters them automatically!), grow crops overnight, and harvest produce to cook or sell back to Vince.'
    ]
  },
  {
    version: '0.14',
    date: '2026-11-28',
    title: 'Realism Pass 5: Park Squirrels (Phase A Complete)',
    notes: [
      'Upgraded Maple Lane Park\'s scurrying squirrels with a realistic 3D tree squirrel model, completing the Phase A 3D realism pass alongside the pond mallard ducks and roadside deer.'
    ]
  },
  {
    version: '0.13',
    date: '2026-11-28',
    title: '3D Wardrobe & Style Viewer',
    notes: [
      'Upgraded the Phone Style app with a live interactive 3D turntable character viewer—drag to spin 360° and toggle Idle/Walk poses.',
      'Added 5 switchable 3D Outfits (Casual Jacket, Town Clerk, Relaxed Tee, Cozy Sweater, Classic Coat) and 4 wearable 3D Accessories (Baseball Cap, Knit Beanie, Glasses, Daypack).',
      'Shirt, Pants, Hair, and Shoes color swatches now recolor your rigged 3D character live, with smoother walk/run animation blending.'
    ]
  },
  {
    version: '0.12.2',
    date: '2026-11-28',
    title: 'First-Person Rigged Body & Smooth Boot',
    notes: [
      'Looking down in first-person now shows your real rigged 3D character (torso, arms, clothes, and shoes) instead of the blocky placeholder body.',
      'Removed the extra blocky door from the pickup truck and throttled background asset loading for a smoother, faster startup.'
    ]
  },
  {
    version: '0.12.1',
    date: '2026-11-28',
    title: 'Real Hands on Your Phone',
    notes: [
      'Your phone is now held by the same realistic hand: palm on the back, fingers curled around the left edge, and your thumb reaching onto the screen as you tap.'
    ]
  },
  {
    version: '0.12',
    date: '2026-11-28',
    title: 'Real First-Person Hands',
    notes: [
      'Your first-person hands are now a detailed, textured 3D model with knuckles, nails and natural skin colour that follows your skin choice.',
      'Fingers move with what you do: they grip doors, baskets and the steering wheel, make a fist to knock, point to press buttons, open to wave, close around your new keys and tap while typing.'
    ]
  },
  {
    version: '0.11',
    date: '2026-11-28',
    title: 'Welcoming Title Screen Overhaul',
    notes: [
      'Replaced the plain boot box with a warm golden-hour Maple Lane welcome splash and hid the controls box and crosshair while on the title screen.',
      'Redesigned the live 3D title screen with drifting autumn maple leaves, a glowing frosted-glass hero card, a live time-of-day postcard pill, a shimmering "Enter Maple Lane" button, and a clean 2-column menu.'
    ]
  },
  {
    version: '0.10',
    date: '2026-11-28',
    title: 'Realism Pass 4: Town Traffic & Pond Ducks',
    notes: [
      'Upgraded passing AI traffic on Maple Lane & Route 9 with 3 realistic 3D vehicles (Silver Sedan, Black SUV, Red Coupe) while keeping dusk/night headlights, brake lights, and yielding.',
      'Upgraded Maple Lane Park\'s pond ducks with a realistic 3D Mallard Duck model.'
    ]
  },
  {
    version: '0.9',
    date: '2026-11-28',
    title: 'Realism Pass 3: Street, Yard & Park Props',
    notes: [
      'Upgraded Maple Lane Park with realistic wooden picnic tables, painted wooden benches, planter boxes, galvanized trash cans, and a sunny plaza patio set.',
      'Added realistic curbside benches and trash cans along Maple Lane, plus wooden planter boxes and a cozy porch rocking chair in your front yard.'
    ]
  },
  {
    version: '0.8.1',
    date: '2026-11-28',
    title: 'Fishing & Town Fixes',
    notes: [
      'Fish you catch now actually go in your bag (and fishing costs energy and lifts your mood), so you can sell them to Vince and finish the chowder and locket quests.',
      'Quest mood rewards now apply, and the postcard quest needs a new photo taken after you accept it.',
      'Passing cars are solid, drive the whole road from Route 9 to the park, and never pop in or out where you can see.',
      'House furniture swaps to the new models piece by piece, so pieces never double up.',
      'The radio remembers your station and volume, and the pond & breeze sounds play from the start.'
    ]
  },
  {
    version: '0.8',
    date: '2026-11-28',
    title: 'Realism Pass 2: Cozy Home Furniture',
    notes: [
      'Upgraded your house interior with realistic 3D furniture: sofa, coffee table, mid-century reading armchair, wooden kitchen dining set, desk chair, classic laptop, and bedroom nightstand.',
      'Upgraded the Home Decor Potted Plant and Walnut Bookshelf with realistic 3D models.'
    ]
  },
  {
    version: '0.7',
    date: '2026-11-28',
    title: 'Realism Pass 1: PBR Surfaces',
    notes: [
      'Upgraded Maple Lane\'s lawns, asphalt road, concrete sidewalks, driveway, trailer park gravel, and your house\'s hardwood floors with real CC0 photographic PBR textures (diffuse, normal, and roughness maps).'
    ]
  },
  {
    version: '0.6',
    date: '2026-11-28',
    title: 'Living Valley, Camera & Maple FM',
    notes: [
      'Passing AI traffic now cruises Maple Lane & Route 9 with headlights, brake lights, and polite yielding for you and your pickup.',
      'Neighbours pop open colorful umbrellas when it rains, and playful squirrels scurry around Maple Lane Park.',
      'Phone Camera now supports 1×/1.5×/2× zoom, live film filters (Warm Film, Golden, Cozy B&W), and a 12-photo Gallery.',
      'New Maple FM Radio phone app with 3 cozy procedural stations (press R while driving to cycle stations) plus pond & breeze ambience.',
      'Pond Fishing at Maple Lane Park: cast from the footbridge for valley fish (sellable to Vince) or rare clues, plus an interactive Community Notice Board inside the Post Office with open-ended multi-source quests.',
      'Major graphics polish: sky reflections, 3D lighting relief on siding/brick/roofs, 3D grass & leaves, Fresnel pond water, 3D parallax mountains, and live Look Presets in Settings.'
    ]
  },
  {
    version: '0.5',
    date: '2026-11-27',
    title: 'A Maple Lane story',
    notes: [
      'The title screen now looks out over Maple Lane with the pickup parked out front, lit to match your device\'s clock.',
      'The Route 9 opening has new titles, a "Welcome to Maple Lane" sign at the town entrance, and a smooth hand-off to the driver\'s seat.',
      'After watching the intro once, hold the skip button (or X) on later viewings to jump to the arrival.'
    ]
  },
  {
    version: '0.4',
    date: '2026-11-27',
    title: 'Weather & Main Menu',
    notes: [
      'Weather now changes gradually over game hours: clear → partly cloudy → overcast → drizzle → rain, and back again.',
      'Snow! Cold spells bring flurries that build into snowfall, and snow settles on the lawns and sidewalks, then slowly melts.',
      'The phone Weather app shows the temperature, cold spells and snow on the ground.',
      'New, gentler opening song for the Route 9 drive ("Heartwarming" by Kevin MacLeod).',
      'Title screen: press-start screen, What\'s New patch notes and a Credits page.'
    ]
  },
  {
    version: '0.3',
    date: '2026-11-27',
    title: 'Day One',
    notes: [
      'Route 9 now flows seamlessly into Maple Lane, with a grazing roadside deer and story captions.',
      'Step out of the pickup, open the hinged bed cover and tailgate, and drag your boxes off.',
      'Rita and the townsfolk are real 3D clothed characters; cutscene cameras now face whoever is talking.',
      'Bigger house with an open living room, a walk-in Post Office (PO Box #14) and a rebuilt playground.',
      'Phone redesign with a two-way Messages app, a Map app with search and pins, and a Fullscreen button.'
    ]
  },
  {
    version: '0.2',
    date: '2026-11-27',
    title: 'Road Trip',
    notes: [
      'A cinematic road-trip opening: drive into town in your pickup truck with the radio on.',
      'Your own character as the player, plus new neighbours made from the same rig.',
      'Shift to run, a gas station with fuel for the truck, and a community clinic.',
      'The Market restocks its shelves at night.'
    ]
  },
  {
    version: '0.1',
    date: '2026-11-26',
    title: 'Moving In',
    notes: [
      'Title screen with three save slots, a pause menu and settings.',
      'Laundromat and trailer park, animated neighbours with daily routines.',
      'Third-person actions, a debug menu, and in-game feedback (F9).'
    ]
  }
];

export const LATEST_VERSION = CHANGELOG[0].version;

const SEEN_KEY = 'mapleValleyLife_seenVersion';

/** Compare "0.10" > "0.9" correctly. */
export function compareVersions(a, b) {
  const pa = String(a || '0').split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b || '0').split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d < 0 ? -1 : 1;
  }
  return 0;
}

export function hasUnseenUpdate(seenVersion, latest = LATEST_VERSION) {
  return !seenVersion || compareVersions(latest, seenVersion) > 0;
}

export function readSeenVersion(storage = globalThis.localStorage) {
  try { return storage ? storage.getItem(SEEN_KEY) : null; } catch { return null; }
}

export function markUpdatesSeen(storage = globalThis.localStorage, latest = LATEST_VERSION) {
  try { storage?.setItem(SEEN_KEY, latest); } catch { /* private mode */ }
}

/** "2026-11-27" → "Nov 27, 2026" without timezone surprises. */
export function formatNoteDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  if (!m) return String(iso || '');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[Number(m[2]) - 1] || ''} ${Number(m[3])}, ${m[1]}`;
}
