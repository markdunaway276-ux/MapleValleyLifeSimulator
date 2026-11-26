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
- `src/systems/` — save, collision, doors, interactables, and optional debug tools (`debug.js`, `collisionViz.js`)
- `src/ui/` — inventory, door prompt, HUD screenshot button (`hudScreenshot.js`), and debug UI (`debugMenu.js`, `debugOverlay.js`, `feedback.js`)

## Main house interior
Open the front door (walk up and use the prompt) and walk in: a front room (sofa, dining table + chairs), a bedroom and a kitchen. The interior is a few merged single-sided meshes (2 draw calls, no shadow casters) plus one warm point light on desktop only. The doorway collider is open only while the door is open (and never traps you if the door is closed while you stand in it). Exterior and other houses are unchanged.

## Pickups
A snack sits on the dining table inside the main house: walk up and press E (or tap the prompt) to add it to your bag — it stacks with the snacks you already have, then disappears from the table and stays gone after a save and reload. A mailbox stands on the sidewalk in front of the house (east of the front door). Opening it toggles the lid and, the first time, gives you a Letter. Later mail (for example daily letters that pay cash) can hook into the mailbox's `userData.mail` without changing this path.

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
- Clear saved game (tap twice to confirm; you are returned to the street start)

Desktop shortcuts: `F2` or `` ` `` menu • `F3` overlay • `Shift+F3` perf stats • `F4` collision boxes • `Shift+F4` highlight interactables • `F8` teleport to street start • `Shift+F8` clear save (press twice within 4 s) • `F9` screenshot + markup. In the markup dialog: `Esc` cancels, `Ctrl/Cmd+Enter` saves.

A short list of later debug ideas lives in `DEBUG-TODO.md`.

## Next steps
- Replace the placeholder house with your CC0 Quaternius / Elbolilloduro models
- Add more systems (economy, needs, jobs)
- Improve touch controls and on-screen buttons for mobile
- Add a quality toggle in settings
