# Handoff for ChatGPT (Codex): Road-trip opening, realistic car interior, new trees

Written by Claude on Nov 27, 2026. The user picked **option 2, "Road trip"**, for the new-game opening and wants it to **look good: cinematic and polished, but not over the top**. Claude reviews your `test` branch and moves it into `main`.

**Before you start:** update `test` from `main` (it is far behind: the park merge, the move-in story, the hand fixes and the new scenery assets are all on `main`). Follow AGENTS.md (Codex section): push to `test`, never to `main`. Run `node --test` before pushing.

---

## 0. What already exists (read these first)

| Area | File | Notes |
|---|---|---|
| Day One story + current intro | `src/game/dayOne.js` | `shots` array, `driveCar()`, `draw()` (renders the intro instead of the game camera), stages `realtor → unload → unpack → phone → market → day → done`. The new opening **replaces the `shots` intro only**. Keep the stages, Rita, the boxes and the saves exactly as they are. |
| Car mesh | `src/world/props.js` (`createCarAssets`, `createParkedCar`) | The cabin's inside faces are culled, so from the seat you only see a steering wheel (`car-steering`). Front of the car = local **+x**, tail lights at local x ≈ -2.0, `CAR_SEAT` = { x: -0.1, y: 1.38, z: -0.42 }. |
| Driving | `src/systems/car.js` | Camera at the driver's seat, `state.speed`, `state.steer`, fuel (`createFuelTank`), `enter()` / exit, `seatWorld()`. The player's car parks at x 6.8, z 10.05 (north parking lane). |
| Trees | `src/world/trees.js` (`TREE_PLACEMENTS`, `scatterTrees`) + `parkTrees` in `src/world/scene.js` | Procedural low-poly trees with circle colliders. |
| Ground | `src/world/scene.js` | Grass plane 180 × 125 m, shifted +40 on x (covers roughly x -50..130), so it must grow west for Route 9. |
| Street | `src/world/street.js` | Maple Lane runs x -44..44 (west end x -44, trailer park at the west end, south side). Road is 14 m wide **on purpose. Do not narrow it.** |
| Hands | `src/systems/playerActions.js` | First-person arms. Forearms are laid from the wrist toward a fixed shoulder point (`layForearm`). `play(name, { hold })` freezes a pose for testing. |
| Sound | `src/systems/sfx.js` | Everything is synthesized with Web Audio (no sample files), respects the mute / volume settings. |
| Loader | `src/world/gltf.js` (`loadGltf`, `getGltfLoader`) | GLB loading. |
| Camera | `src/game/rendering.js` | near 0.1, far `quality.far`. |

## 1. New assets already in the repo (license-checked by Claude)

All in `assets/models/scenery/`, credits already added to `assets/models/CREDITS.md`. Only use these (plus what is already in the repo). The user's car downloads (Hyundai Santa Cruz, Kia Carnival, Hyundai Kona) **may not be used**: Sketchfab Standard / non-commercial licenses and real car brands.

| File | Contents | Notes |
|---|---|---|
| `trees.glb` (650 KB) | 8 nodes, trunk base at origin, Y-up, metres: `shade-tree-large` (15.6 × 19.9 m), `pine-tall` (15.3 m), `pine-slender` (10.4 m), `spruce-a` (9.2 m), `spruce-b` (9.2 m), `pine-young` (7.8 m), `leafy-small` (8.1 m), `sapling` (4.4 m) | Elbolilloduro, CC0. Leaf cards use `alphaTest` 0.5 and are double-sided. Scale per placement (0.6–1.1), random yaw. |
| `road-signs.glb` (500 KB) | 8 nodes: `speed-limit` (says 55), `slow-down`, `pedestrian-ahead`, `stop`, `two-way`, `merge-ahead`, `railroad-ahead`, `narrow-road` | CC BY 4.0, Paul Cheeseburger (credited). Post base at origin. They are **4.5 m tall: scale about 0.65**. |
| `deer.glb` (1.7 MB) | One static buck, about 1 m tall | CC BY 4.0, iRahulRajput (credited). **Scale about 1.6.** No animation. |
| `kenney-fence-large.glb`, `kenney-fence-wide.glb` | White picket / rail fence pieces | Kenney, CC0. |

Keep the asset rules from AGENTS.md: only CC0 / CC-BY, credit CC-BY, no real brand logos (the car interior must have **no badges or logos**, including on the steering wheel).

---

## 2. The opening: "Road trip" (about 45–55 seconds, skippable)

### Feel
Late-morning golden light, a quiet two-lane country road through forest, music playing on the car radio, then the town opening up. Calm, warm and confident, like the first minute of a cozy indie game. Camera moves are slow and eased (no shaky cam, no fast cuts, no lens-flare spam). Use **letterbox bars** (2.35:1) that slide in at the start and slide away when play begins.

### New place: the approach road (Route 9)
- Extend the road **west** from Maple Lane's west end (x -44) out to about **x -300**, as a normal **two-lane country road, about 8 m wide**: dashed yellow centre line, white edge lines, gravel shoulders, grass verges. Blend it into Maple Lane's 14 m road over the last 25 m before x -44 (a short widening, not a hard step).
- Extend the ground (and the minimap, `surfaceHeightAt`, `sfx.surfaceAt`) to cover it. Add it to the car's drivable area (like `STREET.expansion.drive` / `scene.userData.driveAreas`), so the player can drive out on it later, with a gentle invisible end at x -300 (the road fades into fog there).
- **Forest** on both sides from x -60 to x -300: mostly `pine-tall`, `pine-slender`, `spruce-a/b`, some `leafy-small` and `sapling` at the edges, set back 4–7 m from the road edge, with a few gaps (a field with `kenney-fence-*` farm fence, about x -150..-190 on the south side). Use **InstancedMesh per tree type** (one draw call per tree part), seeded random placement, no colliders needed past the verge.
- **Signs** along the road (scaled 0.65, 3 m off the edge): `narrow-road` (x -260), `speed-limit` (x -230), `two-way` (x -200), `railroad-ahead` is optional, `slow-down` (x -90), `pedestrian-ahead` (x -60).
- **"Welcome to Maple Lane" sign** at x -75, south verge: build it in code. A painted wooden sign with two posts, a maple-leaf emblem, "Welcome to **Maple Lane**", a small line "Est. 1952", and a little flower bed at its base. Canvas texture for the lettering (serif), MeshStandardMaterial. It must read clearly from the driver's seat.
- **Deer** (scaled about 1.6) standing at the forest edge, north side around x -170, facing the road. It is a static model, so place it mid-step as if it paused to watch the car. Seen in shot 3.
- Fog: use the existing scene fog / sky, and make sure the far end of the road disappears into haze rather than ending visibly.

### Shot list (times are a guide)
All shots render through the existing `dayOne.draw()` path (it already swaps the camera for the intro and restores it). The car is the real player car mesh, moved along the road (as `driveCar()` does now). Front wheels should spin (rotate the wheel meshes by distance / radius).

1. **Fade up, canopy (0–7 s).** Black, music starts. Letterbox slides in, fade up. Camera high above the trees at about x -280, slowly tilting down and pushing forward until it finds the car on the road below. Small caption, lower left, fades in and out: *"Route 9 — 8:12 AM"*.
2. **Driver's seat (7–17 s).** First person from the driver's seat (see section 3): both hands on the wheel (small steering corrections), the speedometer needle at about 40 mph, trees streaming past the side windows, **sunlight flickering** through the trees across the dashboard (modulate the sun / a key light intensity with a smooth noise as tree trunks pass). Moving boxes on the passenger seat and the back seat (visible in the rear-view mirror). About 12 s in, the **phone in the cupholder lights up**: a small notification *"Rita: Keys are ready! See you at 8:30."* The music sounds like it is coming from the car radio (see section 5).
3. **Roadside, low (17–24 s).** Camera low at the forest edge on the north side, near the deer; the car passes from left to right, the camera pans with it. The music opens up to full (we are outside now).
4. **Welcome sign (24–32 s).** Back in the driver's seat: the "Welcome to Maple Lane" sign comes up on the right, the car eases off (needle drops toward 25 mph). As it passes, the **title card** fades in over the letterbox: **MAPLE LANE** (large serif, letter-spaced, warm off-white) with a small line *"a small-town life"*. Hold for 3 s, fade out.
5. **Into town (32–44 s).** Exterior crane: the trees thin out, the road widens into Maple Lane, the car passes the trailer park, the clinic and Fuel & Go; the camera rises slowly to show the whole street with the Market and the park in the distance, then settles toward your house.
6. **Arrival (44–52 s).** The car pulls into its parking spot (x 6.8, z 10.05). Driver's seat: the engine sound stops, the radio cuts off with the engine (or fades within 1 s), birds and ambience come up, Rita waves from across the street. Letterbox bars slide away, the HUD fades in, and **play starts with the player sitting in the driver's seat** (use the car's own enter state). Task panel: *"You made it. Press E to get out of the car."* (mobile: "Tap to get out"). When the player gets out, continue with the existing `realtor` stage.

### Rules
- **Skip** at any time: the existing button / X key, and also Esc / tap. Skipping jumps to the end of shot 6 (car parked, player in the seat), never half-way.
- `prefers-reduced-motion`: use hard cuts with gentle fades between still framings instead of moving cameras.
- Phone screens: the letterbox and the title must fit at 380 px wide (title font `clamp(...)`).
- Old saves and Continue never see the opening (as now: only fresh saves). Do not change the save format, apart from anything the opening itself needs.
- Keep the existing `dayOne` stage logic working (Rita, keys, boxes, unpacking, saving mid-story). Remove the old intro shots ("Moving Day", "Your new home", "Maple Lane Market", "Maple Lane Park").

## 3. Car interior: make it look real

The user wants the inside of the car to look **a lot more realistic**. There is no usable downloaded interior (licenses), so build it in code, carefully. It is used for **both the opening and normal driving**.

**Structure.** A new module, for example `src/world/carInterior.js`, builds a `THREE.Group` that is added to the car and is **only visible while the camera is in the car** (driving or interior shots), for performance. Merge static parts by material. Target under about 25k triangles, a few shared MeshStandardMaterials, canvas or small WebP textures (512 px max). Bevel edges (RoundedBoxGeometry from three/addons, or ExtrudeGeometry with bevels) so nothing looks like a raw box.

**Parts (proportions of a mid-size hatchback; the seat eye point is `CAR_SEAT`):**
- **Dashboard:** a long, softly curved upper dash (dark charcoal soft-touch: roughness 0.85, a subtle grain normal map from a canvas noise), a lighter lower dash, a thin satin-silver trim strip across the width, air vents (slatted, two in the middle and one at each end).
- **Instrument cluster** behind the wheel, under a hooded binnacle: a **speedometer** (mph, 0–120) and a **tachometer**, drawn on canvas textures with animated needles; small fuel and temperature gauges. **The speedometer follows `state.speed`, the fuel gauge follows the real fuel tank**, and the tach follows speed plus idle. Gauges glow softly (emissive) and a little more at night.
- **Steering wheel:** a proper three-spoke wheel (torus rim with a thicker grip section, a padded centre hub with **no logo**), turn-signal and wiper stalks, a steering column shroud. The wheel rotates with `state.steer`.
- **Centre stack:** an **infotainment screen** (canvas texture; shows the radio station *"WMPL 98.1 · Maple Lane Radio"* and the track title during the opening, and a simple clock / map tile when driving), climate knobs, hazard button.
- **Centre console:** gear selector, two cupholders (a Fuel & Go coffee cup in one during the opening), the phone lying in a tray (used for Rita's notification), parking brake.
- **Seats:** driver and passenger, with seat base, backrest and headrest; stitched panel look (an inset centre panel in a slightly different fabric tone). Seat belt over the driver's shoulder.
- **Door panels:** armrest, door pull, window switches, speaker grille, a soft-touch upper strip.
- **Pillars, roof and glass:** A-pillars, a fabric headliner, sun visors, a **rear-view mirror** (a simple dark reflective surface; a low-res render target is optional, only if it costs little), the windshield and side windows as thin glass (very slight tint, low opacity, faint reflections from the environment) so the outside is clearly visible. Make sure the exterior shell does not block the view from inside.
- **Moving-day props** (opening only, also kept while the story stage is `realtor`): two or three taped cardboard boxes on the passenger seat and back seat, a lamp sticking out of one, a rolled rug.
- **Lighting:** the interior must not be pitch black. Give the cabin an environment map / hemisphere fill, a slightly brighter dash in daytime, and soft emissive gauges at night.
- **First-person hands on the wheel** while driving and in the interior shots: add a `drive` pose to `playerActions.js` (hands at 9 and 3 on the rim, following the wheel's rotation). The forearm code already keeps the sleeves out of the camera.

## 4. Trees in town (use the downloaded trees)

- Replace the procedural trees in `scatterTrees` with the `trees.glb` trees, keeping the same placements, seeds and colliders (`TREE_PLACEMENTS` and `parkTrees`). Back yards: `shade-tree-large` at scale 0.5–0.65 (so about 10–13 m) and `pine-tall` at 0.7–0.8. Front-yard and park edges: `leafy-small`, `sapling`. Keep the old procedural tree as the fallback if the GLB fails to load.
- Add a **subtle wind sway** to the leaf materials (vertex shader via `onBeforeCompile`, stronger higher up the tree, slow; a few centimetres). It must look calm, not stormy, and should respond to the existing weather (a bit more in rain).
- Shadows: only trees near the camera cast shadows (or use the existing contact blob); forest trees on Route 9 do not.

## 5. Music

Default: an **original track composed in code** with Web Audio (no audio files), in a new `src/systems/music.js`, following the existing mute / volume settings:
- Warm, hopeful, gentle indie-acoustic. About 84 BPM, key of G major, progression I–V–vi–IV (G–D–Em–C) with a lift at the title card.
- Layers: a soft pad (detuned oscillators through a low-pass filter), a plucked guitar-like part (Karplus-Strong), a simple piano-like arpeggio (sine with a short harmonic attack), and very light percussion (soft kick and a filtered-noise shaker) that only comes in for shots 3–5.
- About 50 s with an intro, a verse, the lift at the title, and an ending that resolves when the car parks.
- **Radio effect:** while the camera is inside the car, route the music through a band-pass (about 300–3500 Hz) plus a touch of saturation, and cross-fade to the full mix for exterior shots. The radio stops with the engine in shot 6.
- **Optional file override:** if `assets/audio/opening.mp3` (or `.ogg`) exists, play that instead (the user may add a CC0 / CC-BY track later; credit it in CREDITS.md).
- Add simple car sounds: engine hum that follows speed, tyre/road noise, a turn-signal tick if you use the indicator, engine-off, then birds.

## 6. Fix the start-up lag (important)

The user noticed stutter when the game first starts. The cause is models and textures still loading, plus shaders compiling on the first frames, while the camera is already moving. Fix it before the opening plays:

1. **Load gate:** track every GLB / texture load (wrap `loadGltf`) and wait for all of them, with a 15 s timeout so a failed asset never blocks the game. Show a calm loading card (*"Getting Maple Lane ready…"* with a thin progress bar, on black, matching the title-screen style).
2. **Warm-up:** call `renderer.compileAsync(scene, camera)` (three r169 has it), then render each opening camera position once into a small off-screen render target (shot 1 canopy, the interior, roadside, town crane), so textures and shadow maps are uploaded and the shaders compiled.
3. **Settle:** after that, keep rendering (still black) until about 20 frames in a row are under about 22 ms, or 3 s at most, then fade up and start the music and the shots.
4. Only then does `dayOne` start counting shot time. Shot timing must use real elapsed time, clamped per frame, so a slow frame does not make the camera jump.

## 7. Done means

- New game: loading card → smooth opening with music → seated in the car → E to get out → Rita. No stutter after the fade-up on a normal PC; still runs on a phone (check `?mobile=1`).
- Skip works at every point, and reduced motion works.
- Driving at any time shows the new interior with working gauges and hands on the wheel.
- Town trees are the new trees, swaying gently; Route 9 is drivable with its forest, signs, welcome sign and deer.
- `node --test` passes; no console errors; push to `test` and report what changed, with screenshots if you can.

Please keep changes in focused files (`carInterior.js`, `music.js`, an `approachRoad.js` or similar, `loadingGate.js`) rather than growing `main.js`.
