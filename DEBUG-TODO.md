# Debug tools to add later

Optional ideas for later, when they would help testing. Everything already in the Debug menu is off by default (see `src/systems/debug.js`).

- Time-of-day slider — done: Debug menu now has a time slider plus pause and speed controls (see `src/systems/time.js`).
- Mute toggle — done: Debug menu Sound section plus the HUD mute button (see `src/systems/sfx.js`). Mute is stored in localStorage.
- Needs refill / drain — done: Debug menu Needs section (see `src/systems/needs.js`).
- Money +$100 / reset — done: Debug menu Money section (see `src/systems/money.js`).
- Inventory debug (add/remove items) — drop test items into the bag.
- On-screen console log viewer (for phone) — a scrollable log overlay so errors are visible without a desktop inspector.
- Draw-call / triangle counter — partially done: Debug menu → Perf stats (Shift+F3) already shows draw calls, triangles, geometries and textures. A dedicated always-on counter or a more detailed breakdown could still be added later.
- Seed display + regenerate street button — show the current street seed and rebuild the neighbourhood from a new (or typed) seed.
- Slow-motion toggle — scale the sim timestep (e.g. 0.25×) to inspect door swings, jumps and collisions.
