# Maple Valley Life Simulator

Modular Three.js web game. Runs in any browser (PC + phone).

## Local development
1. Open `index.html` in a browser, or serve the folder:
   ```bash
   python -m http.server 8080
   ```
2. Go to `http://localhost:8080`

## GitHub Pages (permanent link for phone checking)
1. Create a new repo on GitHub (public or private — Pages works with both on free accounts for public).
2. Upload these files (or push the folder).
3. Go to Settings → Pages → Source: Deploy from a branch → `main` / root.
4. Your link will be: `https://YOUR_USERNAME.github.io/REPO_NAME/`

Push any change and the link updates in ~1 minute. Open it on your phone anytime.

## Structure
- `src/main.js` — entry, quality detection, loop
- `src/core/` — player + input
- `src/world/` — scene building (`interior.js` = the walk-in interior of the main house: floors, partitions, furniture, doorway colliders; `pickups.js` = snack and mailbox)
- `src/data/` — item definitions (`items.js`) and job definitions (`jobs.js`)
- `src/systems/` — save, collision, doors, interactables, game clock (`time.js`), sound (`sfx.js`), sleep (`sleep.js`), needs (`needs.js`), money (`money.js`), work (`work.js`), and optional debug tools (`debug.js`, `collisionViz.js`)
- `src/ui/` — inventory, door prompt, HUD screenshot button (`hudScreenshot.js`), HUD clock, mute, needs and cash (`hudClock.js`, `hudMute.js`, `hudNeeds.js`, `hudMoney.js`), and debug UI (`debugMenu.js`, `debugOverlay.js`, `feedback.js`)

## Main house interior
Open the front door (walk up and use the prompt) and walk in: a front room (sofa, dining table + chairs, and a small home-office desk), a bedroom and a kitchen. The interior is a few merged single-sided meshes (2 draw calls, no shadow casters) plus one warm point light on desktop only. The doorway collider is open only while the door is open (and never traps you if the door is closed while you stand in it). Exterior and other houses are unchanged.

## Day and night
A slow day/night cycle (one game day lasts 24 real minutes) tints the sky, fog and lights. Lighting is updated about 8 times a second so it stays cheap on a phone; shadows stay desktop-only. The house interior brightens a little at night. A small clock at the top-centre shows the day and time (hidden under inventory or menus). The game clock is saved with your position and inventory, and later features (sleep, needs, daily mail, work) can call `getTime`, `setTime`, `advance(minutes)` or listen for `onNewDay`.


## Sound
Footsteps change on grass, the road or sidewalk, and the main-house floor. Opening or closing a door (and the mailbox lid) has its own sound, and picking up the snack or the letter plays a short pickup chime. A very quiet ambient loop (soft wind and birds by day, crickets at night) follows the game clock. All of this is synthesized with the Web Audio API — there are no audio files to download. Sound unlocks when you press Start (required on a phone), and a small mute button sits under the camera button; the same mute toggle is in the Debug menu and is remembered in localStorage. Later systems can call `sfx.play('pickup')` (or `'sleep'`, `'eat'`, `'cash'`, `'vending'`, `'car'`).




## Money
You start with $50, shown as a compact **Cash** line on the HUD with the Hunger and Energy bars (top-left, under the info card). The bag no longer has a separate Cash item, so there is only one balance, and it is saved with your game. Later systems can call `get`, `add`, `spend` (returns false if you cannot afford it), `canAfford` or `onChange` — for example, work or a vending machine. Once per in-game day (when the clock rolls past midnight, including overnight while you sleep) a letter with $5–$15 waits in the mailbox. Open it to collect the money; you get a "+$X" toast and a short cash sound. The first-time Letter is unchanged. The Debug menu has +$100 and Reset cash (back to $50) buttons.

## Hunger and Energy
Two needs, Hunger and Energy, sit as compact bars under the info card (top-left). Both run from 0 to 100 and are saved with your game. Hunger falls slowly with game time (a full bar lasts 24 game hours). Energy falls a little faster (20 game hours at rest, 50% quicker while you walk). Sleeping restores Energy to full; Hunger still ticks down for the hours you slept, so you may wake a bit hungry. Open the bag, select a Snack, and tap **Eat** to restore 40 Hunger (the stack goes down by one, and a short eat sound plays). The bars turn amber at 25 or below; nothing else happens when they hit 0 (no death or penalties yet). Later systems can call `get`, `set`, `add` or `onChange` (for example, work can drain Energy). The Debug menu has Refill and Drain buttons.


## Work
A small desk with a laptop sits against the east wall of the main house's front room (to the right as you come in, past the picture). Walk up and press E (or tap the prompt: **Press E to work** / **Tap to work**). A short "Working…" bar fills for 3 real seconds (input is blocked, like sleep). When it finishes, the game clock jumps 2 hours (so midnight still rolls a new day and daily mail can arrive), you earn $20, Energy drops by 20, and you get a "+$20" toast with the cash sound. If Energy is below 15, the desk refuses with "Too tired to work." Jobs are defined in `src/data/jobs.js` so later spots or NPC-given work can plug in; later systems can call `spend` on money and listen for `maple-worked`.

## Sleep
Walk up to the bed in the main house's west bedroom and press E (or tap the prompt) to sleep. The screen fades to black, the game clock jumps to 07:00 the next morning (or the same day's 07:00 if it is still earlier than that), and you fade back in with a short "You slept." toast. Lighting and the HUD clock update immediately, and the new time is saved. A quiet sleep sound plays. Later systems (for example Energy) can listen for the `maple-slept` event or an `onSlept` hook.

## Pickups
A snack sits on the dining table inside the main house: walk up and press E (or tap the prompt) to add it to your bag — it stacks with the snacks you already have, then disappears from the table and stays gone after a save and reload. A mailbox stands on the sidewalk in front of the house (east of the front door). Opening it toggles the lid and, the first time, gives you a Letter. Once per in-game day a small cash letter ($5–$15) also arrives; opening the mailbox collects it. Daily mail hooks into the mailbox's `userData.mail` (`pending`, `onOpen`) without changing this path.

## Screenshot
After Start, a camera button (📷) sits in the top-right corner (just left of **Bag** on a phone). Tap it to capture the current view, mark it up, add an optional note, and save a PNG. Tools: pen, line, arrow, double arrow, box, circle, X, check (green by default), question mark, numbered pin, plus a few colours. The same markup dialog opens from `F9` or Debug → Screenshot + markup. `Esc` cancels, `Ctrl/Cmd+Enter` saves.

## Debug tools (all off by default)
After pressing Start a small **Debug** button appears in the bottom-right corner (works on phone). It opens a menu with big toggles and buttons:
- FPS & position overlay (FPS, x/y/z, facing, quality tier mobile/desktop)
- Collision boxes (red = houses/car, cyan = trees, green ring = you)
- Highlight interactables (gold outline + 3 m ring on every door; turns green when you are in range)
- Perf stats (draw calls, triangles, geometries, textures)
- Screenshot + markup (same dialog as the HUD camera button: pen/line/arrow/double arrow/box/circle/X/check/question/numbered pin, colours, a note, and a PNG with a caption band)
- Teleport list: street start, front of my house, inside my house, each neighbour door (SW, SE, NW, NE), west/east ends of the street, by the parked car
- Time of day: a slider plus pause and speed (1×, 4×, 16×, 60×)
- Sound: mute (same control as the HUD mute button; remembered in localStorage)
- Needs: refill or drain Hunger and Energy
- Money: +$100 or reset cash to $50
- Clear saved game (tap twice to confirm; you are returned to the street start)

Desktop shortcuts: `F2` or `` ` `` menu • `F3` overlay • `Shift+F3` perf stats • `F4` collision boxes • `Shift+F4` highlight interactables • `F8` teleport to street start • `Shift+F8` clear save (press twice within 4 s) • `F9` screenshot + markup. In the markup dialog: `Esc` cancels, `Ctrl/Cmd+Enter` saves.

A short list of later debug ideas lives in `DEBUG-TODO.md`.

## Next steps
- Replace the placeholder house with your CC0 Quaternius / Elbolilloduro models
- Add more jobs and NPC-given work
- Improve touch controls and on-screen buttons for mobile
- Add a quality toggle in settings
