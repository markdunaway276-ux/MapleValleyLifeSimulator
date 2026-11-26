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
- `src/world/` — scene building (`interior.js` = the walk-in interior of the main house: floors, partitions, furniture, doorway colliders; `pickups.js` = snack and mailbox; `vending.js` = sidewalk vending machine; `playerBody.js` = the first-person stand-in body; `npc.js` = sidewalk neighbours; `props.js` = the car model; `rain.js` = the light-rain streaks)
- `src/data/` — item definitions (`items.js`), job definitions (`jobs.js`), shop stock (`shops.js`), appearance options (`appearance.js`), NPC registry (`npcs.js`), dialogue (`dialogue.js`) and the calendar (`calendar.js`)
- `src/systems/` — save, collision, doors, interactables, game clock (`time.js`), sound (`sfx.js`), sleep (`sleep.js`), needs (`needs.js`), money (`money.js`), work (`work.js`), shops (`shop.js`), appearance (`appearance.js`), weather (`weather.js`), the drivable car (`car.js`), skills (`skills.js`), sitting (`sit.js`), and optional debug tools (`debug.js`, `collisionViz.js`)
- `src/ui/` — inventory, door prompt, HUD screenshot button (`hudScreenshot.js`), HUD clock, mute, needs and cash (`hudClock.js`, `hudMute.js`, `hudNeeds.js`, `hudMoney.js`), phone (`phone/phone.js`, `phone/apps.js`, `phone/style.js`, `phone/calendar.js`, `phone/skills.js`), dialogue (`dialogue.js`), minimap (`minimap.js`), the save indicator (`hudSave.js`), and debug UI (`debugMenu.js`, `debugOverlay.js`, `feedback.js`)

## Main house interior
Open the front door (walk up and use the prompt) and walk in: a front room (sofa, dining table + chairs, and a small home-office desk), a bedroom and a kitchen. You can sit on the sofa and the dining chairs (front room and kitchen). The interior is a few merged single-sided meshes (2 draw calls, no shadow casters) plus one warm point light on desktop only. A wall switch just inside the front door (press E / tap to turn the lights off or on) toggles that point light on a desktop and the interior lamp glow / night boost on a phone; a short click plays when you flip it. With the lights off at night the rooms stay dark but readable, and by day daylight still comes through the windows. The switch state is stored in the merged save. The doorway collider is open only while the door is open (and never traps you if the door is closed while you stand in it). Exterior and other houses are unchanged.

## Day and night
A slow day/night cycle (one game day lasts 24 real minutes) tints the sky, fog and lights. Lighting is updated about 8 times a second so it stays cheap on a phone; shadows stay desktop-only. The house interior brightens a little at night (unless you have flipped the wall switch off). A small clock at the top-centre shows the day, the time and a weather icon (hidden under inventory or menus). The game clock is saved with your position and inventory, and later features (sleep, needs, daily mail, work, weather) can call `getTime`, `setTime`, `advance(minutes)` or listen for `onNewDay`.

## Weather
The sky shifts between **Clear**, **Cloudy** and **Light Rain**. A weighted roll every three game hours (and at the start of a new day) picks the next state, then the sky, fog and light intensities ease over about 25 real seconds. Weather only multiplies and tints the current day/night colours, so the darker lighting palette stays in charge. Light rain is a single streak field that follows you (fewer streaks on a phone) and hides while you are inside the main house. A very quiet synthesized rain loop goes through the existing sound mixer and respects mute. The same weather icon sits next to the HUD clock and in the phone status bar; the phone's **Weather** app names the current state. Debug → Weather can lock Auto, Clear, Cloudy or Rain. The current state is stored in the merged save.


## Neighbours
Sam, a low-poly stand-in neighbour (the same merged boxes as you, with their own shirt, pants and skin tones, plus a visible head), walks slowly back and forth along the south sidewalk in front of your house, idles at each end, and stops to face you when you get close. A moving circle collider keeps you from walking through each other, and the route stays clear of the mailbox, the vending machine and the parked car. Walk up and press E (or tap the prompt) to talk; a short, touch-friendly window shows Sam's name and a line or two, with Next and Close (Esc also closes it). Lines live in `src/data/dialogue.js` and can change with the time of day or the weather. The NPC list in `src/data/npcs.js` is the hook for later conversations and NPC-given jobs. Sam is an orange dot on the minimap.


## Driving
The parked car on the north side of the road (at 6.8, -0.2) is drivable. Walk up to any side and press **E** (or tap the prompt, "Press E to enter car" / "Tap to enter car") to get in: the camera moves to the driver's seat (left side), your body is hidden, and the engine hums very quietly through `sfx` (it respects the mute button). **W/S** (or the joystick's up/down) is throttle and reverse and **A/D** (or the joystick's left/right) steers; the mouse or a drag on the screen looks around a little and eases back to straight ahead. It is arcade physics, slow on purpose: top speed 7 m/s forward (3 m/s in reverse), and the wheel angle and turn rate depend on speed, so you cannot spin on the spot. The car is an oriented box that is stepped in short sub-steps, so it stops (or slides along) houses, trees, the mailbox, the vending machine, Sam and the ends and kerbs of the street, and it never passes through them at any frame rate. Press **E** or tap "Exit car" to get out at the driver's side (then the right, then behind, then in front, each checked with `unstick`, then back at the spawn as a last resort). While you drive the Bag, phone and Debug menus still open (the car brakes and ignores the controls while one is open); talking to Sam and the other interactions wait until you get out. The car's position and heading are saved with the rest of the game and its marker on both minimaps moves live.

## Sound
Footsteps change on grass, the road or sidewalk, and the main-house floor. Opening or closing a door (and the mailbox lid) has its own sound, and picking up the snack or the letter plays a short pickup chime. A very quiet ambient loop (soft wind and birds by day, crickets at night) follows the game clock. All of this is synthesized with the Web Audio API — there are no audio files to download. Sound unlocks when you press Start (required on a phone), and a small mute button sits under the camera button; the same mute toggle is in the Debug menu and is remembered in localStorage. Later systems can call `sfx.play('pickup')` (or `'sleep'`, `'eat'`, `'cash'`, `'vending'`, `'car'`, `'click'`).




## Money
You start with $50, shown as a compact **Cash** line on the HUD with the Hunger and Energy bars (top-left, under the info card). The bag no longer has a separate Cash item, so there is only one balance, and it is saved with your game. Later systems can call `get`, `add`, `spend` (returns false if you cannot afford it), `canAfford` or `onChange` — for example, work or a vending machine. Once per in-game day (when the clock rolls past midnight, including overnight while you sleep) the mailbox rolls a weighted table in `src/data/mail.js`: cash of $5–$15 and short messages are common, a Snack is occasional, and some days there is nothing — except a pity rule so the box is never empty for more than two days in a row. Open the mailbox to collect whatever arrived: cash goes through `money.add` with a "+$X" toast and a short cash sound, messages show a toast and land in the phone's Messages app, and items go into your bag. The first-time Letter is unchanged. The Debug menu has +$100 and Reset cash (back to $50) buttons.

## Hunger and Energy
Two needs, Hunger and Energy, sit as compact bars under the info card (top-left). Both run from 0 to 100 and are saved with your game. Hunger falls slowly with game time (a full bar lasts 24 game hours). Energy falls a little faster (20 game hours at rest, 50% quicker while you walk). Sitting on the sofa or a dining chair slowly restores Energy (about 5 points per game hour) while Hunger still ticks down. Sleeping restores Energy to full; Hunger still ticks down for the hours you slept, so you may wake a bit hungry. Open the bag, select a Snack, and tap **Eat** to restore 40 Hunger (the stack goes down by one, and a short eat sound plays). The bars turn amber at 25 or below; nothing else happens when they hit 0 (no death or penalties yet). Later systems can call `get`, `set`, `add` or `onChange` (for example, work can drain Energy). The Debug menu has Refill and Drain buttons.


## Work
A small desk with a laptop sits against the east wall of the main house's front room (to the right as you come in, past the picture). Walk up and press E (or tap the prompt: **Press E to work** / **Tap to work**). A short "Working…" bar fills for 3 real seconds (input is blocked, like sleep). When it finishes, the game clock jumps 2 hours (so midnight still rolls a new day and daily mail can arrive), you earn $20, Energy drops by 20, and you get a "+$20" toast with the cash sound. If Energy is below 15, the desk refuses with "Too tired to work." Jobs are defined in `src/data/jobs.js` so later spots or NPC-given work can plug in; later systems can call `spend` on money and listen for `maple-worked`.

## Sleep
Walk up to the bed in the main house's west bedroom and press E (or tap the prompt) to sleep. The screen fades to black, the game clock jumps to 07:00 the next morning (or the same day's 07:00 if it is still earlier than that), and you fade back in with a short "You slept." toast. Lighting and the HUD clock update immediately, and the new time is saved. A quiet sleep sound plays. Later systems (for example Energy) can listen for the `maple-slept` event or an `onSlept` hook.


## Vending
A small vending machine stands on the south sidewalk west of the main house's front door (the mailbox is on the east side), clear of the door path and the parked car. Walk up and press E (or tap the prompt: **Press E to buy Snack ($5)** / **Tap to buy Snack ($5)**). If you can afford it, $5 is spent, a Snack is added to your bag (it stacks), and you get a "-$5 · Snack" toast with a short vending sound. If you cannot, you see "Not enough cash." and nothing changes. The machine's front panel stays lit at night. Stock is defined in `src/data/shops.js` so later items or shops can plug in; cash and the bag are saved as usual.

## Minimap
A small north-up map sits in the bottom-left corner (just above the joystick on a phone), clear of the clock, camera, mute, phone, Bag, needs/cash card, Debug and the interact prompt. It shows the road and sidewalks, house footprints, trees, and markers for the mailbox, vending machine, the work desk in the main house, the parked car, and any neighbours out walking. You are a yellow arrow that points the way you are looking. The neighborhood is drawn once to an offscreen canvas; your arrow, the neighbours and the car (which moves) are redrawn about 10 times a second. Toggle it with **M** on a desktop, a tap on the map (or the small map button when it is hidden), or the Minimap switch in the Debug menu; the choice is remembered in localStorage. Like the other HUD bits, it hides under the bag, phone, Debug menu, sleep and work. The same map, larger, is the phone's **Map** app.

## Phone
The Phone in your bag has an **Open** button, and a small phone button sits in the top-right stack under mute (left of **Bag** on a phone, clear of the clock, needs/cash card, Debug, joystick and prompts). On a desktop, **P** opens it too. The phone-shaped overlay shows the game day and time (and a weather icon) in a status bar and a home grid of apps: **Messages** (an inbox of notes collected from the mailbox; "No new messages." when it is empty), **Bank** (your live cash balance), **Map** (a larger version of the neighborhood minimap), **Style** (shirt, pants and skin tones, with a live preview of you), **Weather** (the current conditions) **Calendar** (a 30-day month grid that highlights today) and **Skills** (Fitness and Cooking levels with progress bars). Close it with the X, the home button, Esc, or a tap outside. While it is open, pointer lock is released, look and movement are blocked, and the other HUD bits hide like they do under the bag. Apps are listed in `src/ui/phone/apps.js` so later ones are one entry each.


## Calendar
The HUD clock and the phone status bar show **Day N** next to the time, using the day count from the game clock (already saved with your game). The phone's **Calendar** app is a simple month-style grid: months are 30 days, with weekday names, and Day 1 is a Monday. Today's date is highlighted. After a reload the same day is still current, because it lives in the merged save.

## Skills
Fitness and Cooking each have XP and a level (up to 10), defined in `src/systems/skills.js` so later skills are one entry each. You earn a little Fitness XP for walking (not while driving or sitting) and for finishing a desk job, and Cooking XP for eating a snack or using **Cook** at the east kitchen counter (that takes 8 game minutes and a little Hunger). The phone's **Skills** app shows the current levels and a bar toward the next; a small "Fitness up! Lv. 2" toast appears on the right, clear of the other HUD bits. Skills are stored in the merged save. Debug → Skills can add +50 XP to either one.

## Sitting
Walk up to the front-room sofa, or to a dining chair at the front-room or kitchen table, and press **E** (or tap the prompt: "Press E to sit" / "Tap to sit"). Movement locks and the camera eases down to a seated eye height (1.1 m), facing forward; you can still look around with the mouse or by dragging on a phone. Press **E** or tap "Tap to stand" to get up at a safe spot beside the seat (checked with `unstick`). The bag, phone and Debug menus still open while you sit (look and movement stay parked until you close them). Sleeping, starting work or entering the car stands you up first. Your stand-in body is hidden while you are seated, the same way it is while driving. Seats are defined in `src/systems/sit.js`.

## Style
A simple stand-in body follows you: a low-poly torso, arms, legs and a head built from a few merged boxes. In first person the head is hidden so it never blocks your view, and looking down shows your shirt and pants. On a desktop the body casts a shadow. Open the phone's **Style** app to pick a skin tone, shirt colour and pants colour from touch-friendly swatches; a small drawing of the figure updates as you pick. Choices are stored in the same save as your position, inventory, needs and cash. The lists live in `src/data/appearance.js` so later features (hair, hats) can add a slot without rewriting the UI.

## Save
Your position, the game clock, the bag, pickups (the snack and mailbox, including any pending mail and the empty-day streak), Hunger and Energy, cash, your look, the weather, the car's position and heading, your skill XP, the Messages inbox, and the interior light switch are all written to one merged save in localStorage. An autosave runs every 10 seconds, and anything that changes the game (eating, sleeping, work, talking, sitting, buying a snack, changing your look or the weather, collecting mail, flipping the light switch) also writes immediately. If you save while sitting, the stored position is the stand spot, not the seat. A small **Saved ✓** fades in under the Hunger / Energy / Cash card after each successful save, then fades out; it stays clear of the clock, the camera / mute / phone / Bag cluster, the minimap and the interact prompt, and it hides under menus with the other HUD bits. Turn it off with **Debug → HUD → Save indicator**; that choice is remembered in localStorage (it is on by default).

## Pickups
A snack sits on the dining table inside the main house: walk up and press E (or tap the prompt) to add it to your bag — it stacks with the snacks you already have, then disappears from the table and stays gone after a save and reload. A mailbox stands on the sidewalk in front of the house (east of the front door). Opening it toggles the lid and, the first time, gives you a Letter. Once per in-game day a weighted roll (cash, a short message, a Snack, or nothing, with a two-day pity rule) also arrives; opening the mailbox collects it. Daily mail hooks into the mailbox's `userData.mail` (`pending`, `onOpen`, `emptyStreak`) without changing the first-time Letter path.

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
- Map: show or hide the minimap (same control as **M** / the HUD map; remembered in localStorage)
- Clear saved game (tap twice to confirm; you are returned to the street start)

Desktop shortcuts: `F2` or `` ` `` menu • `F3` overlay • `Shift+F3` perf stats • `F4` collision boxes • `Shift+F4` highlight interactables • `F8` teleport to street start • `Shift+F8` clear save (press twice within 4 s) • `F9` screenshot + markup • `M` minimap • `P` phone. In the markup dialog: `Esc` cancels, `Ctrl/Cmd+Enter` saves.

A short list of later debug ideas lives in `DEBUG-TODO.md`.

## Next steps
- Replace the placeholder house with your CC0 Quaternius / Elbolilloduro models
- Add more jobs and NPC-given work
- Improve touch controls and on-screen buttons for mobile
- Add a quality toggle in settings
