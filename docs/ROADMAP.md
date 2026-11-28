# Maple Lane — Project Roadmap

A running list of planned visual upgrades and future gameplay builds for Maple Lane.

---

## Phase A — 3D Assets & Visual Realism (In Progress)

All committed assets must be **CC0** or **CC-BY** (credited in `assets/models/CREDITS.md` / `CREDITS.md`), with real brand logos removed and textures compressed (256–512 px WebP) for fast browser loading.

- [x] **Batch 1 — Real CC0 PBR Surface Textures**
  - Upgraded core world surfaces (lawn grass, Maple Lane asphalt road, concrete sidewalks & driveway, trailer park gravel, and player house hardwood floors) with real CC0 albedo, normal, and roughness maps (512 px WebP from Poly Haven) with procedural fallbacks.
- [x] **Batch 2 — Player House Interior & Decor**
  - Replaced procedural living room, bedroom, kitchen, and decor items (`src/world/interior.js`, `src/world/homeDecor.js`) — sofa, coffee table, reading armchair, dining table & chairs, desk chair, laptop, nightstand, potted houseplant, and wooden bookshelf — with 9 optimized CC0 Poly Haven `.glb` models while preserving all sitting anchors and colliders.
- [ ] **Batch 3 — Street, Front Yard & Park Props**
  - Upgrade repeating outdoor props (`src/world/props.js`, `src/world/park.js`, `src/world/frontYard.js`) — benches, picnic tables, trash cans, porch chairs, planters, fire hydrants, and mailboxes.
- [ ] **Batch 4 — Realistic AI Traffic Vehicles**
  - Replace boxy passing cars in `src/world/traffic.js` with 2–3 optimized, unbranded CC0/CC-BY vehicles (sedan, SUV/hatchback, van) with spinning wheels, headlights, and brake lights to match `pickup.glb`.
- [ ] **Batch 5 — Wildlife (Pond Ducks & Park Squirrels)**
  - Swap procedural ducks and squirrels for realistic low-poly CC0/CC-BY `.glb` models to match `assets/models/scenery/deer.glb`.

---

## Phase B — Planned Gameplay Builds

- [ ] **1. Home Cooking & Backyard Gardening**
  - Cook real meals at your kitchen stove using Market groceries and pond-caught fish (e.g., Pan-Seared Trout, Morning Pancakes, Hearty Stew, Warm Cocoa) for stronger hunger/energy/mood buffs and neighbour gifts.
  - Add raised garden beds in the yard: plant seeds, water them (rain counts automatically), grow crops over game days, and harvest produce to cook or sell to Vince.
- [ ] **2. Photo Gigs, Framed Gallery Photos & Seasonal Odd Jobs**
  - Notice Board photo commissions using the Phone Camera's zoom & filters (ducks, squirrels, golden-hour Maple Lane, neighbours).
  - Hang photos from your Phone Gallery in picture frames inside your house.
  - Weather-reactive odd jobs for neighbours (snow shoveling during cold spells, yard cleanup, pickup haul runs).
- [ ] **3. Weekly Town Events (Live Calendar)**
  - Saturday Park Farmers' Market / Yard Sale with pop-up stalls, rotating decor/treats, and mingling neighbours.
  - Sunday Pond Fishing Derby with a friendly leaderboard and a trophy for your house.
- [ ] **4. Adoptable Pet & Cozy Home Upgrade**
  - Befriend a wandering town cat or dog with treats or fish so it moves into your yard/house, follows you on walks, and naps indoors.
  - Deeper home customization (wall/floor themes, new cozy decor, framed photos).
- [ ] **5. Mystery Chapter 3 (Next Story Arc)**
  - Continue from `src/systems/mysteryChapter2.js` and rare pond clues: night-time investigation with a flashlight, friendship-aware dialogue branches, and a new town discovery.
