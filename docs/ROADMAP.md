# Maple Lane — Project Roadmap

A running list of planned visual upgrades and future gameplay builds for Maple Lane.

---

## Phase A — 3D Assets & Visual Realism (Complete)

All committed assets must be **CC0** or **CC-BY** (credited in `assets/models/CREDITS.md` / `CREDITS.md`), with real brand logos removed and textures compressed (256–512 px WebP) for fast browser loading.

- [x] **Batch 1 — Real CC0 PBR Surface Textures**
  - Upgraded core world surfaces (lawn grass, Maple Lane asphalt road, concrete sidewalks & driveway, trailer park gravel, and player house hardwood floors) with real CC0 albedo, normal, and roughness maps (512 px WebP from Poly Haven) with procedural fallbacks.
- [x] **Batch 2 — Player House Interior & Decor**
  - Replaced procedural living room, bedroom, kitchen, and decor items (`src/world/interior.js`, `src/world/homeDecor.js`) — sofa, coffee table, reading armchair, dining table & chairs, desk chair, laptop, nightstand, potted houseplant, and wooden bookshelf — with 9 optimized CC0 Poly Haven `.glb` models while preserving all sitting anchors and colliders.
- [x] **Batch 3 — Street, Front Yard & Park Props**
  - Upgraded Maple Lane Park, front yard, and street props (`src/world/park.js`, `src/world/frontYard.js`, `src/world/atmosphere.js`) with 6 CC0 Poly Haven `.glb` models: wooden park benches, picnic tables, galvanized trash cans, planter boxes, front-yard rocking chair, and plaza patio set.
- [x] **Batch 4 — Realistic AI Traffic Vehicles**
  - Replaced boxy passing cars in `src/world/traffic.js` with 3 optimized, unbranded CC0 realistic vehicles (`traffic-sedan.glb`, `traffic-suv.glb`, `traffic-coupe.glb`) while preserving dusk/night headlights, beams, brake lights, and polite yielding.
- [x] **Batch 5 — Wildlife (Pond Ducks & Park Squirrels)**
  - Upgraded Maple Lane Park pond ducks (`mallard-duck.glb` in `src/world/park.js`) and park squirrels (`squirrel.glb` in `src/world/livingWorld.js`) with realistic CC0 `.glb` models to match `assets/models/scenery/deer.glb`.

---

## Phase B — Planned Gameplay Builds

- [x] **1. Home Cooking & Backyard Gardening**
  - Cook real meals at your kitchen stove using Market groceries, backyard produce, and pond-caught fish (Home Meal, Morning Pancakes, Garden Salad, Fresh Tomato Soup, Pan-Seared Trout, Hearty Harvest Stew, Warm Cocoa) for stronger hunger/energy buffs and neighbour gifts.
  - Added 4 cedar raised garden beds in the backyard: buy seeds at Vince's Market, plant & water them (rain counts automatically), grow crops over game days, and harvest produce to cook or sell to Vince.
- [x] **2. Photo Gigs, Framed Gallery Photos & Seasonal Odd Jobs**
  - Notice Board photo commissions using the Phone Camera's zoom & filters (Park Wildlife Snap for Sam, Golden-Hour Maple Lane for June, Vintage Valley Portrait for Dottie).
  - Hang photos from your Phone Gallery in 3 wooden picture frames inside your house (Living Room, Kitchen, Bedroom), or press E on any frame to cycle photos.
  - Weather-reactive daily odd jobs for neighbours (Snow Shoveling during snowy/cold spells, Yard Cleanup in mild weather, and Supply Haul Runs).
- [x] **3. Weekly Town Events (Live Calendar)**
  - Saturday Park Farmers' Market (8 AM–6 PM) with 3 striped pop-up stalls, rotating weekly seeds & treats, and +20% produce/fish sale bonus.
  - Sunday Pond Fishing Derby (7 AM–7 PM) with a live leaderboard stand, $45 grand prize, and a permanent 3D Golden Trout Trophy displayed inside your house, plus live event markers in the Phone Calendar app.
- [x] **4. Adoptable Pet & Cozy Home Upgrade**
  - Befriend Maple the ginger tabby cat with treats/fish or daily pets so she moves into your house, follows you on walks, and naps indoors on her Cozy Pet Bed.
  - Added 4 switchable interior Home Themes (Classic, Valley Sage, Autumn Cabin, Misty Morning) and 3 new cozy 3D decor items (Cozy Pet Bed, Warm String Lights, Kitchen Espresso Corner).
- [ ] **5. Mystery Chapter 3 (Next Story Arc)**
  - Continue from `src/systems/mysteryChapter2.js` and rare pond clues: night-time investigation with a flashlight, friendship-aware dialogue branches, and a new town discovery.
